# 📋 Plano Completo de Implementação - Correções do Sistema
## 🎯 Objetivo Geral
Implementar todas as correções necessárias para garantir:
- ✅ Separação correta por tenant e usuário (Judit)
- ✅ Remoção de valores hardcoded
- ✅ Uso correto de variáveis de ambiente
- ✅ Segurança adequada
- ✅ Sistema funcional após todas as alterações

**Documento complementar (Judit + isolamento + delete + Contador):**  
Ver **`docs/PLANO_MONITORAMENTO_JUDIT_E_ISOLAMENTO.md`** para análise do sistema de monitoramento, alinhamento à documentação Judit, regra do Contador Judit por tenant e ordem de implementação detalhada.
---
## ⚠️ VARIÁVEIS EXPOSTAS AO FRONTEND
**IMPORTANTE:** Variáveis com prefixo `VITE_` são expostas ao frontend e podem ser visualizadas no código fonte do navegador.
### **Variáveis Expostas:**
| Variável | Seguro? | Motivo |
|----------|---------|--------|
| `VITE_TEST_RECAPTCHA_SITE_KEY` | ✅ **SIM** | Site key do reCAPTCHA é pública por design. Não contém informações sensíveis. |
**⚠️ NUNCA exponha ao frontend:**
- Secrets (JWT, API keys)
- Senhas
- Tokens privados
- URLs internas
---
## 📦 PARTE 1: CORREÇÕES JUDIT (CRÍTICO)
### **1.1 Remover Quota de `listTrackings()`**
**Arquivo:** `src/services/juditService.ts`  
**Linha:** 330  
**Prioridade:** 🔴 CRÍTICO
**Problema:** VERIFIQUE (POIS AO CLICAR EM "Atualizar da API (1 request)")
- `listTrackings()` consome quota desnecessariamente ao listar trackings
- Listar não deveria consumir quota (apenas criar/atualizar)
**Correção:**
```typescript
async listTrackings(tenantId: string, params: { page?: number; page_size?: number; status?: string | string[] } = {}, opts: { skipLog?: boolean } = {}): Promise<any> {
  // REMOVER esta linha:
  // await this.enforceQueryQuota(tenantId);
  
  const apiKey = await this.getApiKey(tenantId);
  if (!apiKey) throw new Error('Judit API key not configured for tenant');
  // ... resto do código permanece igual
}
```
**Impacto:** ✅ Baixo - Apenas remove consumo de quota desnecessário  
**Risco:** ✅ Baixo - Não quebra funcionalidade existente
---
### **1.2 Filtrar Listagem por Usuário**
**Arquivo:** `src/services/juditService.ts`  
**Linha:** 506  
**Prioridade:** 🔴 CRÍTICO
**Problema:**
- `listLocalTrackings()` retorna TODOS os trackings do tenant
- Não filtra por `user_id`
**Correção:**
**1. Modificar assinatura do método:**
```typescript
async listLocalTrackings(tenantDB: TenantDatabase, userId: string): Promise<any[]> {
  await this.ensureTrackingsTable(tenantDB);
  const query = `SELECT * FROM ${schema}.judit_trackings 
                 WHERE is_active = TRUE AND user_id = $1 
                 ORDER BY created_at DESC`;
  const rows = await queryTenantSchema<any>(tenantDB, query, [userId]);
  return rows || [];
}
```
**2. Atualizar chamada em `publicationsController.ts` (linha 464):**
```typescript
dbTrackings = await codiloService.listLocalTrackings(tenantDB, req.user.id);
```
**Impacto:** ✅ Médio - Usuários verão apenas seus próprios trackings  
**Risco:** ✅ Baixo - Adiciona filtro, não remove funcionalidade
---
### **1.3 Identificar Dono na Sincronização**
**Arquivo:** `src/services/juditService.ts`  
**Nova função:** Adicionar método `identifyTrackingOwner()`  
**Arquivo:** `src/controllers/publicationsController.ts`  
**Linha:** 454-462  
**Prioridade:** 🔴 CRÍTICO
**Problema:**
- Todos os trackings são salvos com `req.user.id` ao sincronizar
- Não identifica o dono original do tracking
**Correção:**
**1. Adicionar função auxiliar em `juditService.ts` (após linha 517):**
```typescript
async identifyTrackingOwner(
  tenantDB: TenantDatabase, 
  tenantId: string, 
  tracking: any
): Promise<string | null> {
  const search = tracking?.search || {};
  const searchType = search?.search_type || '';
  const searchKey = search?.search_key || '';
  const notificationEmails = tracking?.notification_emails || [];
  
  // Tentar por email primeiro (mais confiável)
  if (notificationEmails.length > 0) {
    const user = await prisma.user.findFirst({
      where: { 
        tenantId,
        email: { in: notificationEmails },
        isActive: true
      }
    });
    if (user) return user.id;
  }
  
  // Tentar por OAB (se search_type === 'oab')
  if (searchType === 'oab' && searchKey) {
    const rows = await queryTenantSchema<any>(
      tenantDB,
      `SELECT DISTINCT user_id FROM ${schema}.judit_trackings 
       WHERE search->>'search_key' = $1 
       AND search->>'search_type' = 'oab'
       LIMIT 1`,
      [searchKey]
    );
    if (rows?.[0]?.user_id) {
      return rows[0].user_id;
    }
  }
  
  return null;
}
```
**2. Modificar `listJuditTrackings()` em `publicationsController.ts` (linha 454-462):**
```typescript
if (forceSync && external) {
  const items = Array.isArray(external?.page_data)
    ? external.page_data
    : (Array.isArray(external?.trackings) ? external.trackings : (Array.isArray(external) ? external : []));
  
  // Buscar trackings existentes para mapear donos
  const existingTrackings = await codiloService.listLocalTrackings(tenantDB);
  const trackingOwners = new Map<string, string>();
  for (const existing of existingTrackings) {
    trackingOwners.set(existing.tracking_id, existing.user_id);
  }
  
  // Buscar mapeamento em settings
  const cfg = await prisma.tenantApiConfig.findUnique({ 
    where: { tenantId: req.user.tenantId } 
  });
  const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings) : cfg.settings) : {};
  const trackingsMap = settings?.judit?.trackings || {};
  
  // Processar cada tracking
  for (const it of items) {
    const trackingId = it?.tracking_id || it?.id;
    let ownerUserId: string | null = null;
    
    // Nível 1: Buscar na tabela local
    if (trackingOwners.has(trackingId)) {
      ownerUserId = trackingOwners.get(trackingId)!;
    }
    // Nível 2: Buscar no mapeamento
    else if (trackingsMap[trackingId]?.userId) {
      ownerUserId = trackingsMap[trackingId].userId;
    }
    // Nível 3: Identificar por search_key/notification_emails
    else {
      ownerUserId = await codiloService.identifyTrackingOwner(
        tenantDB, 
        req.user.tenantId, 
        it
      );
    }
    
    // Se não encontrou dono, usar usuário atual (com log)
    if (!ownerUserId) {
      console.warn(`Tracking ${trackingId} sem dono identificado, atribuindo ao usuário atual`);
      ownerUserId = req.user.id;
    }
    
    // Salvar/atualizar com dono correto
    await codiloService.saveTrackingRecord(tenantDB, ownerUserId, it);
  }
}
```
**Impacto:** ✅ Alto - Corrige problema crítico de atribuição de trackings  
**Risco:** ⚠️ Médio - Lógica complexa, testar bem
---
### **1.4 Validar Ownership Antes de Deletar**
**Arquivo:** `src/controllers/publicationsController.ts`  
**Linha:** 556  
**Prioridade:** 🟡 IMPORTANTE
**Problema:**
- Usuário pode tentar deletar tracking de outro usuário
**Correção:**
```typescript
async deleteJuditTracking(req: TenantRequest, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { id } = req.params as any;
    
    // Verificar se o tracking pertence ao usuário
    const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
    const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
    
    if (tenantDB) {
      const rows = await queryTenantSchema<any>(
        tenantDB,
        `SELECT * FROM ${schema}.judit_trackings 
         WHERE tracking_id = $1 AND user_id = $2`,
        [String(id), req.user.id]
      );
      
      if (!rows || rows.length === 0) {
        return res.status(403).json({ 
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe'
        });
      }
    }
    
    // Tentar deletar na Judit
    try {
      const result = await codiloService.deleteTracking(req.user.tenantId, id);
      // ... resto do código de atualização existente (linhas 563-577)
    } catch (error: any) {
      // Se erro 404, tracking já foi deletado na Judit
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        if (tenantDB) {
          await codiloService.updateLocalTrackingStatus(tenantDB, String(id), 'deleted');
        }
        return res.json({ message: 'Tracking já estava deletado', deleted: true });
      }
      throw error;
    }
    
    // ... resto do código existente (linhas 563-577)
  } catch (error) {
    res.status(400).json({ 
      error: 'Failed to delete Judit tracking', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
```
**Impacto:** ✅ Médio - Adiciona segurança na deleção  
**Risco:** ✅ Baixo - Adiciona validação antes de deletar
---
### **1.5 Melhorar Webhook para Identificar Usuário**
**Arquivo:** `netlify/functions/judit-webhook.ts`  
**Linha:** 36-57  
**Arquivo:** `src/controllers/publicationsController.ts`  
**Linha:** 861-885  
**Prioridade:** 🟡 IMPORTANTE
**Problema:**
- Webhook pode não identificar `userId` correto
- Usa fallback para primeiro usuário do tenant (ruim)
**Correção:**
**Em `judit-webhook.ts` (substituir linhas 36-57):**
```typescript
let userId: string = userIdQS || (body?.userId as string) || '';
if (!userId && trackingId) {
  try {
    // Buscar userId pela tabela local primeiro
    const trackingRows = await queryTenantSchema<any>(
      tenantDB,
      `SELECT user_id FROM ${schema}.judit_trackings 
       WHERE tracking_id = $1 LIMIT 1`,
      [String(trackingId)]
    );
    if (trackingRows?.[0]?.user_id) {
      userId = trackingRows[0].user_id;
    }
  } catch { }
}
if (!userId) {
  try {
    // Fallback: buscar no mapeamento
    const cfg = await prisma.tenantApiConfig.findUnique({ 
      where: { tenantId: resolvedTenantId } 
    });
    const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings) : cfg.settings) : {};
    userId = settings?.judit?.trackings?.[String(trackingId)]?.userId || '';
  } catch { userId = '' }
}
// Se ainda não encontrou, usar fallback (último recurso)
if (!userId) {
  try {
    const firstUser = await prisma.user.findFirst({ 
      where: { tenantId: resolvedTenantId, isActive: true }, 
      orderBy: { createdAt: 'asc' } 
    });
    userId = (firstUser && String(firstUser.id)) || 'system';
  } catch { userId = 'system' }
}
// Validar se userId pertence ao tenant
if (userId && userId !== 'system') {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u || String(u.tenantId) !== String(resolvedTenantId) || !u.isActive) {
      const firstUser = await prisma.user.findFirst({ 
        where: { tenantId: resolvedTenantId, isActive: true }, 
        orderBy: { createdAt: 'asc' } 
      });
      userId = (firstUser && String(firstUser.id)) || 'system';
    }
  } catch { userId = 'system' }
}
```
**Mesma correção em `publicationsController.ts:juditWebhook()` (linha 861-885)**
**Impacto:** ✅ Alto - Garante que publicações sejam criadas para o usuário correto  
**Risco:** ✅ Baixo - Melhora lógica existente
---
## 📧 PARTE 2: CORREÇÕES DE EMAIL (SMTP)
### **2.1 Remover Host Hardcoded**
**Arquivo:** `src/controllers/emailsController.ts`  
**Linha:** 62  
**Prioridade:** 🟡 IMPORTANTE
**Problema:**
- Host está hardcoded: `'mail.optgrupo.com'`
- Ignora variável `MAIL_HOST` do `.env`
**Correção:**
```typescript
// ANTES (linha 61-62):
// const host = String(process.env.MAIL_HOST);
const host = 'mail.optgrupo.com';
// DEPOIS:
const host = String(process.env.MAIL_HOST || 'mail.optgrupo.com');
```
**Impacto:** ✅ Baixo - Permite configurar host via variável de ambiente  
**Risco:** ✅ Baixo - Mantém fallback para compatibilidade
---
### **2.2 Remover Código Resend Comentado**
**Arquivo:** `src/controllers/emailsController.ts`  
**Linhas:** 2, 5, 38-58  
**Prioridade:** 🟢 BAIXA (Limpeza)
**Problema:**
- Código do Resend está comentado e não será usado
- Polui o código
**Correção:**
**1. Remover import não usado (linha 2):**
```typescript
// REMOVER:
// import { Resend } from 'resend';
```
**2. Remover variável não usada (linha 5):**
```typescript
// REMOVER:
// const resendApiKey = process.env.RESEND_API_KEY || null;
```
**3. Remover bloco comentado (linhas 38-58):**
```typescript
// REMOVER completamente:
// if (resendApiKey) {
//   try {
//     ...
//   }
// }
```
**Impacto:** ✅ Baixo - Limpeza de código  
**Risco:** ✅ Nenhum - Código já está comentado
---
### **2.3 Corrigir From Header Hardcoded**
**Arquivo:** `src/controllers/emailsController.ts`  
**Linha:** 102  
**Prioridade:** 🟡 IMPORTANTE
**Problema:**
- From está hardcoded: `'habeasdesk@optgrupo.com'`
- Deveria usar `fromHeader` que já está configurado (linha 97)
**Correção:**
```typescript
// ANTES (linha 102):
from: 'habeasdesk@optgrupo.com',
// DEPOIS:
from: fromHeader,
```
**Impacto:** ✅ Baixo - Usa configuração correta do from  
**Risco:** ✅ Baixo - `fromHeader` já está sendo usado no fallback (linha 120)
---
## 🔒 PARTE 3: CORREÇÕES DE RECAPTCHA
### **3.1 Mover Site Key para Variável de Ambiente**
**Arquivo:** `client/pages/ClientPortal.tsx`  
**Linha:** 12  
**Prioridade:** 🟢 BAIXA
**Problema:**
- Site key está hardcoded no código
- Deveria usar variável de ambiente
**Correção:**
```typescript
// ANTES (linha 12):
const TEST_RECAPTCHA_SITE_KEY = '6Ld_Z1osAAAAADMCJmhbl30r6KKUhAvEtXyhs0IW';
// DEPOIS:
const TEST_RECAPTCHA_SITE_KEY = import.meta.env.VITE_TEST_RECAPTCHA_SITE_KEY || '6Ld_Z1osAAAAADMCJmhbl30r6KKUhAvEtXyhs0IW';
```
**⚠️ IMPORTANTE:**
- Variável `VITE_TEST_RECAPTCHA_SITE_KEY` é exposta ao frontend
- Site key do reCAPTCHA é pública por design (não é secreto)
- É seguro expor esta variável
**Impacto:** ✅ Baixo - Permite configurar via variável de ambiente  
**Risco:** ✅ Baixo - Mantém fallback para compatibilidade
---
## 📝 RESUMO DAS ALTERAÇÕES
### **Arquivos a Modificar:**
| Arquivo | Alterações | Prioridade |
|---------|------------|------------|
| `src/services/juditService.ts` | 3 alterações | 🔴 Crítico |
| `src/controllers/publicationsController.ts` | 3 alterações | 🔴 Crítico |
| `netlify/functions/judit-webhook.ts` | 1 alteração | 🟡 Importante |
| `src/controllers/emailsController.ts` | 3 alterações | 🟡 Importante |
| `client/pages/ClientPortal.tsx` | 1 alteração | 🟢 Baixa |
**Total:** 11 alterações em 5 arquivos
---
## ✅ CHECKLIST DE IMPLEMENTAÇÃO
### **FASE 1: Correções Judit (Crítico)**
- [ ] **1.1:** Remover quota de `listTrackings()`
- [ ] **1.2:** Filtrar `listLocalTrackings()` por `user_id`
- [ ] **1.3:** Criar função `identifyTrackingOwner()`
- [ ] **1.3:** Modificar sincronização para identificar dono
- [ ] **1.4:** Validar ownership antes de deletar
- [ ] **1.5:** Melhorar webhook para identificar `userId`
### **FASE 2: Correções Email (Importante)**
- [ ] **2.1:** Remover host hardcoded do email
- [ ] **2.2:** Remover código Resend comentado
- [ ] **2.3:** Corrigir from header do email
### **FASE 3: Correção reCAPTCHA (Baixa)**
- [ ] **3.1:** Mover site key para variável de ambiente
### **FASE 4: Testes**
- [ ] Testar: Usuário A cria tracking → Usuário B não vê
- [ ] Testar: Usuário A sincroniza → apenas seus trackings aparecem
- [ ] Testar: Usuário A tenta deletar tracking de B → erro 403
- [ ] Testar: Webhook cria publicação para usuário correto
- [ ] Testar: Quota não é consumida ao listar trackings
- [ ] Testar: Email enviado com `MAIL_HOST` configurado
- [ ] Testar: From header usa `MAIL_FROM_EMAIL`
- [ ] Testar: reCAPTCHA funciona com variável de ambiente
---
## ⚠️ CUIDADOS ESPECIAIS
### **1. Não Quebrar Sistema Existente:**
- ✅ Manter fallbacks para valores padrão
- ✅ Validar se variáveis existem antes de usar
- ✅ Não remover funcionalidades, apenas corrigir
- ✅ Testar cada alteração isoladamente
### **2. Variáveis de Ambiente:**
- ✅ Todas as variáveis devem ter valores padrão ou validação
- ✅ Documentar variáveis obrigatórias vs opcionais
- ✅ Não expor secrets ao frontend
### **3. Migração de Dados:**
- ⚠️ Trackings existentes podem não ter `user_id` correto
- ⚠️ Sistema funcionará, mas alguns trackings podem aparecer para usuário errado até sincronizar
- ⚠️ Após sincronização, donos serão identificados corretamente
### **4. Compatibilidade:**
- ✅ Manter compatibilidade com código existente
- ✅ Não alterar assinaturas de métodos públicos sem necessidade
- ✅ Adicionar novos parâmetros como opcionais quando possível
---
## 🚀 ORDEM DE IMPLEMENTAÇÃO RECOMENDADA
### **Ordem Sugerida:**
1. **FASE 1:** Correções Judit (crítico)
   - 1.1 → 1.2 → 1.3 → 1.4 → 1.5
   - Testar após cada alteração
2. **FASE 2:** Correções de Email (importante)
   - 2.1 → 2.2 → 2.3
   - Testar envio de email após cada alteração
3. **FASE 3:** Correção reCAPTCHA (baixo impacto)
   - 3.1
   - Testar formulário público
4. **FASE 4:** Testes Completos
   - Testar todas as funcionalidades
   - Validar separação por usuário
   - Verificar emails funcionando
   - Validar reCAPTCHA
---
## 📊 IMPACTO ESPERADO
### **Antes das Correções:**
- ❌ Trackings de todos os usuários aparecem para qualquer usuário
- ❌ Quota consumida desnecessariamente ao listar trackings
- ❌ Host de email hardcoded (não configurável)
- ❌ From header hardcoded (não configurável)
- ❌ reCAPTCHA hardcoded (não configurável)
### **Depois das Correções:**
- ✅ Cada usuário vê apenas seus trackings
- ✅ Quota otimizada (não consome ao listar)
- ✅ Email totalmente configurável via `.env`
- ✅ From header configurável via `.env`
- ✅ reCAPTCHA configurável via `.env`
- ✅ Separação correta por tenant e usuário
- ✅ Webhook identifica usuário correto
---
## 🔍 VALIDAÇÕES PÓS-IMPLEMENTAÇÃO
### **Validações Obrigatórias:**
1. **Judit:**
   - [ ] Listar trackings não consome quota
   - [ ] Usuário vê apenas seus trackings
   - [ ] Sincronização identifica donos corretamente
   - [ ] Deleção valida ownership
   - [ ] Webhook cria publicação para usuário correto
2. **Email:**
   - [ ] Email enviado usando `MAIL_HOST` do `.env`
   - [ ] From header usa `MAIL_FROM_EMAIL`
   - [ ] Código Resend removido (não quebra sistema)
3. **reCAPTCHA:**
   - [ ] reCAPTCHA funciona com `VITE_TEST_RECAPTCHA_SITE_KEY`
   - [ ] Fallback funciona se variável não configurada
---
## 📝 NOTAS FINAIS
- ✅ **JWT permanece o mesmo** (não alterar)
- ✅ **Não usar Resend** (manter SMTP)
- ✅ **Todas as variáveis** devem estar no `.env.example`
- ✅ **Variáveis `VITE_*`** são expostas ao frontend (apenas reCAPTCHA, que é seguro)
- ✅ **Manter compatibilidade** com sistema existente
- ✅ **Testar cada alteração** antes de prosseguir
---

---
**Data do Plano:** 19/02/2026  
**Status:** 📋 Pronto para Implementação  
**Prioridade:** 🔴 Crítico (Judit) → 🟡 Importante (Email/reCAPTCHA)