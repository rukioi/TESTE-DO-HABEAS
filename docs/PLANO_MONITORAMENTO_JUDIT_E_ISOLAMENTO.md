# Plano de Implementação: Monitoramento Judit, Isolamento por Usuário e Correções

**Data:** 19/02/2026  
**Status:** Documentação pronta — **não implementar ainda**  
**Objetivo:** Corrigir isolamento de monitoramentos (cada usuário vê só os seus), alinhar à documentação Judit, garantir Contador Judit por tenant e corrigir deleção.

---

## 1. Visão do problema e comportamento desejado

### 1.1 Problemas atuais

| Problema | Descrição |
|--------|------------|
| **Monitoramentos compartilhados** | Os mesmos processos/monitoramentos aparecem para **todos** os usuários de todos os tenants. |
| **Deleção** | Usuário não consegue deletar monitoramentos já criados (erro de API ou falta de validação de ownership). |
| **Contador Judit** | Deve aparecer para **todos** os usuários do tenant e ser atualizado quando **qualquer** usuário utilizar. |

### 1.2 Comportamento desejado

- **Monitoramentos:** Cada usuário vê **apenas** os monitoramentos que **ele mesmo** registrou. Outras contas do mesmo tenant só veem os respectivos monitoramentos que elas registraram.
- **Contador Judit (quota):** Único por **tenant**. Visível para todos os usuários do tenant e atualizado sempre que qualquer usuário fizer consulta/monitoramento (comportamento já correto no código; apenas garantir que não seja alterado).
- **Deleção:** Usuário pode deletar **somente** os monitoramentos dos quais é dono; backend deve validar ownership antes de chamar a Judit e atualizar o estado local.

---

## 2. Alinhamento com a documentação Judit

### 2.1 Rotas e payloads (conferência)

| Operação | Doc Judit | Implementação atual | Observação |
|----------|-----------|----------------------|------------|
| **Criar** | `POST /tracking` | `POST https://tracking.prod.judit.io/tracking` | OK |
| **Payload criação** | `recurrence`, `search{search_type, search_key}`, `notification_emails` (opcional), `notification_filters.step_terms` (opcional), `with_attachments` (opcional), `callback_url` (opcional) | Envio de `recurrence`, `search`, `notification_emails`, `notification_filters`, `with_attachments`, `fixed_time`, `hour_range`, `callback_url` | Alinhado; doc aceita `callback_url`. |
| **Listar** | `GET /tracking?page=&page_size=&search_type=&search_key=&status=` | `GET /tracking` com `page`, `page_size`, `status` | OK |
| **Obter um** | `GET /tracking/{id}` | Implementado em `getTracking()` | OK |
| **Atualizar** | `PATCH /tracking/{id}` | Não usado no fluxo atual | Opcional |
| **Histórico** | `GET https://requests.prod.judit.io/responses/tracking/<TRACKING_ID>?order=asc&page=&page_size=&created_at_gte=&created_at_lte=` | `getTrackingHistory()` usa mesma URL | OK |
| **Pausar** | `POST /tracking/{id}/pause` | Implementado | OK |
| **Reativar** | `POST /tracking/{id}/resume` | Implementado | OK |
| **Deletar** | `DELETE /tracking/{id}` | Implementado em `deleteTracking()` | OK; falta só validar ownership antes de chamar. |

### 2.2 Pontos a ajustar (não quebram contrato Judit)

- **Listar não deve consumir quota:** Na doc, listar monitoramentos é consulta administrativa. Hoje `listTrackings()` chama `enforceQueryQuota(tenantId)`, o que gasta quota ao clicar em “Atualizar da API”. **Ação:** remover `enforceQueryQuota` de `listTrackings()`.
- **Deleção na Judit:** Se o monitoramento já foi deletado na Judit (404), o backend deve tratar como sucesso e apenas atualizar o estado local para `deleted` (evita erro para o usuário ao “deletar” algo já removido).

---

## 3. Contador Judit (quota) — por tenant

### 3.1 Comportamento atual (manter)

- **Fonte:** `getJuditQuota` em `publicationsController.ts` (linha ~798).
- **Cálculo:** `used` = contagem de `systemLog` com `message: 'JUDIT_QUERY'` e `tenantId` do usuário no período (mês).
- **Conclusão:** O contador é **por tenant**, não por usuário. Qualquer usuário do tenant que fizer consulta/monitoramento incrementa o mesmo `used`. A tela (Publications e Dashboard) já chama a mesma API; todos os usuários do tenant veem o mesmo número.

### 3.2 O que NÃO fazer

- Não alterar a lógica de contagem para “por usuário”.
- Não remover ou restringir a exibição do contador por tipo de usuário (deve continuar visível para todos do tenant).

---

## 4. Isolamento por usuário — onde está o erro

### 4.1 Fluxo atual (resumo)

1. **Registro:** Ao criar monitoramento, o backend chama Judit e depois:
   - Salva em `judit_trackings` com `user_id = req.user.id` (correto).
   - Atualiza `tenantApiConfig.settings.judit.trackings[tracking_id]` com `userId: req.user.id`.
2. **Listagem:** `listJuditTrackings`:
   - Se `forceSync`: chama Judit `listTrackings()` (retorna **todos** do tenant na Judit) e para **cada** item chama `saveTrackingRecord(tenantDB, req.user.id, it)` — ou seja, **atribui todos ao usuário atual** (erro).
   - Lê `dbTrackings = await codiloService.listLocalTrackings(tenantDB)` **sem filtro por usuário** — ou seja, retorna **todos** os trackings do tenant (erro).
3. **Deleção:** `deleteJuditTracking` chama `codiloService.deleteTracking(tenantId, id)` **sem verificar** se o `id` pertence a `req.user.id` no banco local. Qualquer usuário do tenant pode deletar qualquer tracking (erro de segurança e UX). Além disso, se a Judit retornar 404, o front pode mostrar erro em vez de sucesso.

### 4.2 Resumo das correções necessárias

| Item | Onde | O que fazer |
|------|------|-------------|
| **Listagem local** | `juditService.listLocalTrackings()` | Incluir filtro `user_id = $1` e receber `userId`; retornar só trackings do usuário. |
| **Chamada da listagem** | `publicationsController.listJuditTrackings` | Passar `req.user.id` para `listLocalTrackings(tenantDB, req.user.id)` e usar o resultado como fonte principal para “Meus Monitoramentos”. |
| **Sincronização (forceSync)** | `publicationsController.listJuditTrackings` (bloco `forceSync && external`) | Em vez de salvar todos com `req.user.id`, **identificar o dono** de cada tracking (tabela local, depois `settings.judit.trackings`, depois heurística por email/OAB) e chamar `saveTrackingRecord(tenantDB, ownerUserId, it)`. Se dono não for encontrado, aí sim usar `req.user.id` e registrar log. |
| **Identificação de dono** | Novo método em `juditService` | Implementar `identifyTrackingOwner(tenantDB, tenantId, tracking)` (por exemplo: por `notification_emails` → usuário do tenant com esse email; ou por OAB em `search_key` se `search_type === 'oab'`; fallback null). |
| **Deleção** | `publicationsController.deleteJuditTracking` | Antes de chamar Judit: buscar em `judit_trackings` por `tracking_id = $1 AND user_id = $2`. Se não existir, responder 403 (“não pertence a você ou não existe”). Se existir, chamar Judit DELETE; se Judit retornar 404, considerar sucesso e apenas atualizar local para `deleted`. |
| **Quota em listagem** | `juditService.listTrackings()` | Remover `await this.enforceQueryQuota(tenantId)` para que “Atualizar da API” não consuma quota. |

---

## 5. Webhook Judit e dono do tracking

### 5.1 Problema

O webhook (`netlify/functions/judit-webhook.ts` e o handler em `publicationsController.juditWebhook`) precisa saber **qual usuário** é dono do tracking para:
- Criar notificação para o usuário correto.
- Criar publicação associada ao usuário correto.

Hoje o `userId` vem de:
1. Query string `userId`
2. `settings.judit.trackings[trackingId].userId`
3. Fallback: primeiro usuário ativo do tenant (ruim).

### 5.2 Melhoria

- **Prioridade 1:** Buscar na tabela `judit_trackings` por `tracking_id` e usar o `user_id` do registro.
- **Prioridade 2:** Manter o mapeamento em `settings.judit.trackings[trackingId].userId`.
- **Prioridade 3:** Fallback para primeiro usuário ativo do tenant somente se não houver registro nem em settings, e validar que o `userId` pertence ao tenant e está ativo.

Aplicar a mesma ordem em:
- `netlify/functions/judit-webhook.ts`
- `publicationsController.juditWebhook` (se existir branch equivalente).

---

## 6. Ajustes na deleção (detalhe)

### 6.1 Fluxo recomendado para `deleteJuditTracking`

1. Obter `tenantDB` (como já é feito).
2. Query: `SELECT * FROM ${schema}.judit_trackings WHERE tracking_id = $1 AND user_id = $2` com `[id, req.user.id]`.
3. Se nenhum registro: `return res.status(403).json({ error: 'Tracking not found or access denied', message: 'Este monitoramento não pertence a você ou não existe' })`.
4. Chamar `codiloService.deleteTracking(req.user.tenantId, id)`.
5. Em `catch` do `deleteTracking`: se a mensagem indicar 404 (ex.: `message?.includes('404')` ou `includes('not found')`), considerar sucesso, atualizar localmente o status para `deleted` (e `is_active = false` se aplicável) e responder `{ message: 'Tracking já estava deletado', deleted: true }`.
6. Em caso de sucesso normal: atualizar `tenantApiConfig.settings.judit.trackings[id]` e `judit_trackings` (status `deleted` / `is_active`) como hoje.

Isso resolve tanto “não conseguia deletar” (tratando 404) quanto “deletar só os meus” (403 quando não for dono).

---

## 7. Ordem de implementação sugerida

Não fazer alterações até validar este plano. Quando for implementar, seguir esta ordem:

1. **juditService.ts**
   - Remover `enforceQueryQuota` de `listTrackings()`.
   - Alterar `listLocalTrackings(tenantDB)` para `listLocalTrackings(tenantDB, userId: string)` e filtrar com `WHERE is_active = TRUE AND user_id = $1`.
   - Adicionar `identifyTrackingOwner(tenantDB, tenantId, tracking)` e usá-lo na sincronização (controller).

2. **publicationsController.ts**
   - Em `listJuditTrackings`: passar `req.user.id` para `listLocalTrackings(tenantDB, req.user.id)`.
   - No bloco `forceSync && external`: em vez de salvar todos com `req.user.id`, para cada item obter `ownerUserId` (tabela local → settings → `identifyTrackingOwner`); se null, usar `req.user.id` e logar; chamar `saveTrackingRecord(tenantDB, ownerUserId, it)`.
   - Em `deleteJuditTracking`: verificar ownership na tabela `judit_trackings` antes de chamar Judit; retornar 403 se não for dono; tratar 404 da Judit como sucesso e atualizar local.

3. **netlify/functions/judit-webhook.ts** (e `juditWebhook` no controller se aplicável)
   - Resolver `userId` primeiro pela tabela `judit_trackings` (por `tracking_id`), depois por `settings.judit.trackings`, depois fallback com validação de tenant/ativo.

4. **Testes manuais**
   - Usuário A cria tracking → só A vê na lista.
   - Usuário B (mesmo tenant) não vê o tracking de A.
   - Usuário B tenta deletar tracking de A (por ID) → 403.
   - Usuário A deleta próprio tracking → sucesso.
   - Contador Judit igual para A e B no mesmo tenant; sobe quando qualquer um usa.
   - “Atualizar da API” não aumenta o contador de quota.

---

## 8. Checklist de conformidade Judit (pós-implementação)

- [ ] Criar: payload com `recurrence`, `search.search_type`, `search.search_key`; opcionais: `notification_emails`, `notification_filters.step_terms`, `with_attachments`, `callback_url`.
- [ ] Listar: GET `/tracking` com `page`, `page_size`, `status`; **sem** consumir quota.
- [ ] Histórico: GET `requests.prod.judit.io/responses/tracking/<id>` com parâmetros de data e paginação.
- [ ] Pausar/Reativar/Deletar: rotas conforme doc; deleção com validação de ownership e tratamento de 404.

---

## 9. Referências no código

| Arquivo | Trechos relevantes |
|--------|---------------------|
| `src/services/juditService.ts` | `listTrackings` (linha ~329), `listLocalTrackings` (~506), `registerTracking` (~277), `deleteTracking` (~416), `ensureTrackingsTable` (schema `judit_trackings`) |
| `src/controllers/publicationsController.ts` | `listJuditTrackings` (~429), `deleteJuditTracking` (~556), `getJuditQuota` (~798), `juditWebhook` (~841) |
| `netlify/functions/judit-webhook.ts` | Resolução de `userId` (~35–56), `saveTrackingRecord` com `userId` |
| `client/pages/Publications.tsx` | `refreshJuditTrackings`, `handleForceSyncTrackings`, `handleDeleteTracking`, exibição de quota |

---

**Fim do plano.** Implementar somente após aprovação e na ordem indicada, com testes após cada etapa.
