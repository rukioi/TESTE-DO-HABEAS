# Judit API — Monitoramento Processual | Documentação e Integração Habeas Desk

**Versão:** 1.0  
**Data:** Fevereiro 2026  
**Status:** Documentação de referência + Análise da integração Habeas Desk

---

## Índice

1. [Visão Geral Judit](#1-visão-geral-judit)
2. [APIs de Monitoramento — Documentação](#2-apis-de-monitoramento--documentação)
3. [Monitoramento de Novas Ações por Documento](#3-monitoramento-de-novas-ações-por-documento)
4. [Integração Habeas Desk — Estado Atual](#4-integração-habeas-desk--estado-atual)
5. [Banco de Dados — Modelo Judit](#5-banco-de-dados--modelo-judit)
6. [Configuração (.env)](#6-configuração-env)
7. [Gap Analysis — O que falta e o que precisa de adaptação](#7-gap-analysis--o-que-falta-e-o-que-precisa-de-adaptação)
8. [Checklist de Conformidade Judit](#8-checklist-de-conformidade-judit)

---

## 1. Visão Geral Judit

A **Judit** permite monitorar processos, CPFs, CNPJs, OAB ou Código CNJ, mantendo o usuário atualizado sobre novas movimentações.

### Características

- **Monitoramento processual:** Automatização das consultas aos tribunais.
- **Frequência:** Diariamente, a API busca em todos os tribunais do Brasil processos relacionados ao critério monitorado.
- **Webhooks:** Notificações em tempo real quando há nova movimentação.
- **Tipos de busca:** `cpf`, `cnpj`, `oab`, `name`, `lawsuit_cnj`, `lawsuit_id`, `rji`.

### URLs Base

| Serviço | URL |
|--------|-----|
| Tracking (monitoramentos) | `https://tracking.prod.judit.io` |
| Requests / Histórico | `https://requests.prod.judit.io` |

---

## 2. APIs de Monitoramento — Documentação

### 2.1 Criar Monitoramento

**Rota:** `POST /tracking`  
**Base:** `https://tracking.prod.judit.io`

**Headers:**
- `api-key`: obrigatório
- `Content-Type`: `application/json`

**Payload principal:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `recurrence` | integer | Sim | Recorrência em dias (ex.: 1 = diário) |
| `search` | object | Sim | Objeto de busca |
| `search.search_type` | string | Sim | `lawsuit_cnj`, `cpf`, `cnpj`, `oab`, `name`, `lawsuit_id` |
| `search.search_key` | string | Sim | Valor a buscar (CNJ, CPF, CNPJ, OAB, nome) |
| `search.search_params` | object | Não | Parâmetros adicionais (ex.: `lawsuit_instance`) |
| `notification_emails` | string[] | Não | Emails para notificação |
| `notification_filters.step_terms` | string[] | Não | Filtro por termos em movimentações |
| `with_attachments` | boolean | Não | Incluir anexos (apenas `lawsuit_cnj`) |
| `callback_url` | string | Não | URL do webhook |

**Exemplo (monitoramento por processo):**

```json
{
  "recurrence": 1,
  "search": {
    "search_type": "lawsuit_cnj",
    "search_key": "1111111-04.1111.1.11.1111"
  },
  "notification_emails": ["teste@teste.com"],
  "notification_filters": {
    "step_terms": ["petição", "acordo"]
  },
  "callback_url": "https://seu-dominio.com/api/judit/webhook?tenantId=xxx&userId=yyy"
}
```

**Resposta:** Retorna `tracking_id`, `status` (ex.: `created`), `hour_range`, etc.

> O monitoramento é executado pela primeira vez na melhor janela nas próximas 24h; o campo `hour_range` indica o horário previsto.

---

### 2.2 Atualizar Monitoramento

**Rota:** `PATCH /tracking/{tracking_id}`

**Campos editáveis:** `recurrence`, `tags`, `search` (exceto alguns internos).

---

### 2.3 Listar Monitoramentos

**Rota:** `GET /tracking`

**Query params:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `page` | integer | Página |
| `page_size` | integer | Itens por página |
| `search_type` | string | Filtrar por tipo |
| `search_key` | string | Filtrar por chave |
| `status` | string | `created`, `updating`, `updated`, `paused`, `deleted` |

> **Importante:** Listar monitoramentos não consome quota (conforme documentação Judit).

---

### 2.4 Obter um Monitoramento

**Rota:** `GET /tracking/{tracking_id}`

---

### 2.5 Histórico de um Monitoramento

**Rota:** `GET https://requests.prod.judit.io/responses/tracking/{TRACKING_ID}`

**Query params:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `page` | integer | Página |
| `page_size` | integer | Itens por página |
| `order` | string | `asc` / `desc` |
| `created_at_gte` | string (ISO) | Data inicial |
| `created_at_lte` | string (ISO) | Data final |

---

### 2.6 Pausar Monitoramento

**Rota:** `POST /tracking/{tracking_id}/pause`

---

### 2.7 Reativar Monitoramento

**Rota:** `POST /tracking/{tracking_id}/resume`

---

### 2.8 Deletar Monitoramento

**Rota:** `DELETE /tracking/{tracking_id}`

---

### 2.9 Webhook — Notificação de Movimentação

O webhook é chamado pela Judit quando há nova movimentação. O payload inclui:

- `reference_type`: `tracking`
- `reference_id`: ID do monitoramento
- `event_type`: ex.: `response_created`
- `payload.response_data`: dados do processo e movimentações

**Cadastro do webhook:**

1. Contato com suporte Judit, ou  
2. Uso do parâmetro `callback_url` no payload de criação do monitoramento.

---

## 3. Monitoramento de Novas Ações por Documento

Monitoramento de **novas ações** (processos distribuídos recentemente) por CPF, CNPJ ou OAB.

- **search_type:** `cpf`, `cnpj`, `oab`, `name`, `lawsuit_cnj`, `lawsuit_id`
- **Filtros opcionais em `search_params.filter`:**
  - `side`: `Passive`, `Active`, `Interested`, `Unknown`
  - `amount_gte` / `amount_lte`
  - `tribunals.keys`, `tribunals.not_equal`
  - `subject_codes.contains`, `subject_codes.not_contains`
  - `classification_codes.keys`, `classification_codes.not_equal`
  - `last_step_date_gte`, `last_step_date_lte`
  - `party_names`, `party_documents`

**Status possíveis do monitoramento:**
- `created`: nunca executado
- `updating`: requisição em processamento
- `updated`: já tem respostas; `request_id` indica última request
- `paused`: pausado
- `deleted`: cancelado

---

## 4. Integração Habeas Desk — Estado Atual

### 4.1 Módulo Painel de Publicações

O **Painel de Publicações** (`/publicacoes`) possui 3 abas principais:

| Aba | Descrição | Uso Judit |
|-----|-----------|-----------|
| **Publicações** | Lista de publicações (CNJ-DATAJUD, Codilo, JusBrasil, Judit) | Publicações geradas pelo webhook Judit |
| **Monitorar processos** | Registro e gestão de monitoramentos Judit | 100% Judit |
| **Minhas Consultas** | Histórico de consultas on-demand | Consultas Judit (requests) |

---

### 4.2 Fluxo de Monitoramento

1. **Registro de monitoramento**
   - Usuário escolhe: CPF, CNPJ, OAB, Name ou Nº Processo (CNJ).
   - Define recorrência, emails, filtros por termos, anexos.
   - Sistema chama `POST /tracking` com `callback_url` incluindo `tenantId` e `userId`.
   - Registo é salvo em `judit_trackings` (schema tenant) e em `tenantApiConfig.settings.judit.trackings`.

2. **Webhook**
   - Judit chama `JUDIT_WEBHOOK_URL?tenantId=...&userId=...` em cada movimentação.
   - `userId` é obtido da tabela `judit_trackings` (por `tracking_id`), depois de `settings.judit.trackings`.
   - São criados: publicação, notificação, registro em `judit_tracking_history`.
   - São enviados emails para os endereços configurados em `notification_emails`.

3. **Listagem**
   - Usuário vê apenas monitoramentos próprios (`listLocalTrackings(tenantDB, userId)`).
   - Botão "Atualizar da API" sincroniza com a Judit e persiste na tabela local.
   - Ownership é inferido por tabela local → settings → `identifyTrackingOwner` (email/OAB).

4. **Pausar / Retomar / Deletar**
   - Ownership verificado em `judit_trackings` antes de chamar a API Judit.
   - 403 se o monitoramento não pertencer ao usuário.
   - Deleção: tratamento de 404 (considerado sucesso e atualização local).

---

### 4.3 Rotas API (Habeas Desk)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/publications/external/judit/tracking` | Registrar monitoramento |
| GET | `/api/publications/external/judit/trackings` | Listar monitoramentos |
| GET | `/api/publications/external/judit/trackings/:id` | Obter um monitoramento |
| POST | `/api/publications/external/judit/trackings/:id/pause` | Pausar |
| POST | `/api/publications/external/judit/trackings/:id/resume` | Retomar |
| DELETE | `/api/publications/external/judit/trackings/:id` | Deletar |
| GET | `/api/publications/external/judit/trackings/:id/history` | Histórico |
| GET | `/api/publications/external/judit/quota` | Quota Judit do tenant |
| POST | `/api/judit/webhook` | Webhook Judit (rota pública) |

---

### 4.4 O que está funcionando bem

- Registro de monitoramentos com `callback_url` dinâmico (`tenantId` + `userId`).
- Webhook processando `event_type`, criando publicações e notificações.
- Isolamento por usuário: cada usuário vê apenas seus monitoramentos.
- Ownership na deleção, pausa e retomada (validação em `judit_trackings`).
- Tratamento de 404 ao deletar (considera sucesso e atualiza local).
- `last_webhook_received_at` para exibir "Última Atualização" na UI.
- Suporte a `notification_emails` e envio de emails.
- Histórico local em `judit_tracking_history` com sync da API Judit.
- Quota Judit por tenant, exibida no Dashboard e no Painel de Publicações.

---

## 5. Banco de Dados — Modelo Judit

### 5.1 Tabelas Globais (schema `public`)

| Tabela | Uso |
|--------|-----|
| `client_requests` | Consultas do portal do cliente (Judit, sem tenant) |
| `system_logs` | Logs `JUDIT_QUERY` para cálculo de quota |

### 5.2 Tabelas por Tenant (schema `tenant_xxx`)

| Tabela | Campos principais | Uso |
|--------|-------------------|-----|
| `judit_trackings` | `user_id`, `tracking_id`, `status`, `recurrence`, `search`, `notification_emails`, `notification_filters`, `with_attachments`, `last_webhook_received_at` | Monitoramentos do usuário |
| `judit_tracking_history` | `tracking_id`, `response_id`, `response_type`, `response_data` | Histórico de respostas do webhook |
| `judit_requests` | `user_id`, `request_id`, `search`, `status`, `result` | Consultas on-demand (aba "Minhas Consultas") |
| `publications` | `source: 'Judit'`, `metadata.trackingId`, `metadata.response_id` | Publicações vindas do webhook Judit |

### 5.3 Configuração (schema `public`)

| Tabela | Uso |
|--------|-----|
| `tenant_api_configs` | `codilo_api_key` (Judit por tenant); `settings.judit.trackings[trackingId]` (userId, status, etc.) |

---

## 6. Configuração (.env)

```env
# API Key padrão (fallback se tenant não tiver chave própria)
JUDIT_API_KEY=xxx

# URLs da Judit (produção)
JUDIT_BASE_URL=https://requests.prod.judit.io

# Webhook — URL que a Judit chama nas notificações
# IMPORTANTE: Incluir tenantId e userId na query string; o sistema os usa para rotear
# Formato Express: https://seu-dominio.com/api/judit/webhook
# Formato Netlify Functions: https://seu-dominio.netlify.app/.netlify/functions/judit-webhook
JUDIT_WEBHOOK_URL=https://habeas.netlify.app/api/judit/webhook
```

> **Observação:** O `callback_url` enviado na criação do monitoramento é montado como:  
> `JUDIT_WEBHOOK_URL?tenantId={tenantId}&userId={userId}`  
> Assim a Judit consegue direcionar as notificações ao tenant e ao usuário corretos.

---

## 7. Gap Analysis — O que falta e o que precisa de adaptação

### 7.1 Comportamento atual vs. documentação Judit

| Item | Estado | Observação |
|------|--------|------------|
| `listTrackings` consome quota | **Correto** | Não consome quota (conforme doc Judit) |
| Isolamento por usuário | **Implementado** | `listLocalTrackings(tenantDB, userId)` |
| Deleção com validação de ownership | **Implementado** | 403 se não for dono |
| Tratamento de 404 na deleção | **Implementado** | Sucesso e atualização local |
| `callback_url` na criação | **Implementado** | Com tenantId e userId |
| Resolução de userId no webhook | **Implementado** | Tabela → settings → fallback |
| PATCH (atualizar monitoramento) | **Não implementado** | Opcional |
| `search_params.filter` (filtros avançados) | **Parcial** | Campos básicos; filtros avançados não expostos na UI |

---

### 7.2 Melhorias sugeridas (não bloqueantes)

1. **Atualização de monitoramento (PATCH)**
   - Implementar endpoint para alterar `recurrence`, `notification_emails`, `notification_filters` ou `with_attachments` de um monitoramento existente, chamando `PATCH /tracking/{id}` na Judit.

2. **Filtros avançados na UI**
   - Expor filtros como `subject_codes`, `classification_codes`, `tribunals`, `amount_gte`, `amount_lte` para monitoramentos por documento (CPF, CNPJ, OAB).

3. **Monitoramento de novas ações**
   - Garantir que o fluxo de monitoramento de novas ações por CPF/CNPJ/OAB esteja totalmente coberto pela mesma lógica de registro, webhook e histórico usada para monitoramento por processo.

4. **Roteamento do webhook**
   - Validar se, em produção (Netlify), a URL `/api/judit/webhook` está corretamente roteada (proxy/redirect) para o backend Express ou para a função serverless Judit.

5. **Aviso de uso**
   - Exibir aviso sobre custos associados ao monitoramento de novas ações (on-demand), conforme documentação Judit.

---

### 7.3 Pontos de atenção

- **Consultas por documento inválido:** A Judit não se responsabiliza; podem haver cobranças por uso indevido.
- **Quota:** O sistema já controla `maxQueries` por tenant e notifica em 80% e no limite.
- **Anexos:** Só disponíveis quando `search_type === 'lawsuit_cnj'`.

---

## 8. Checklist de Conformidade Judit

- [x] Criar: payload com `recurrence`, `search.search_type`, `search.search_key`; opcionais: `notification_emails`, `notification_filters.step_terms`, `with_attachments`, `callback_url`
- [x] Listar: `GET /tracking` com `page`, `page_size`, `status`; **sem** consumir quota
- [x] Histórico: `GET requests.prod.judit.io/responses/tracking/<id>` com parâmetros de data e paginação
- [x] Pausar / Retomar / Deletar: rotas conforme doc; deleção com validação de ownership e tratamento de 404
- [x] Webhook: resolução de `userId` e criação de publicações/notificações
- [ ] PATCH para atualizar monitoramento (opcional)
- [ ] Filtros avançados na UI (opcional)

---

## Referências

- Documentação Judit fornecida (Monitoramento Processual + Monitoramento de Novas Ações)
- Código: `src/services/juditService.ts`, `src/controllers/publicationsController.ts`, `client/pages/Publications.tsx`
- Plano de isolamento: `docs/PLANO_MONITORAMENTO_JUDIT_E_ISOLAMENTO.md`
