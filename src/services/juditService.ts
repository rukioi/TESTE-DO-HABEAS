import { prisma, database, TenantDatabase } from '../config/database';
import { transactionsService } from './transactionsService';
import { notificationsService } from './notificationsService';
import { queryTenantSchema, insertInTenantSchema, updateInTenantSchema } from '../utils/tenantHelpers';

export class JuditService {
  private baseUrl = process.env.JUDIT_BASE_URL || 'https://requests.prod.judit.io';
  private trackingBaseUrl = process.env.JUDIT_TRACKING_BASE_URL || 'https://tracking.prod.judit.io';

  private async enforceQueryQuota(tenantId: string): Promise<void> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } });
    const maxQueries = tenant?.plan?.maxQueries ?? null;
    if (!maxQueries || maxQueries <= 0) return;
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    try {
      const sub = await prisma.subscription.findFirst({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
      if (sub?.currentPeriodStart) periodStart = new Date(sub.currentPeriodStart as any);
      if (sub?.currentPeriodEnd) periodEnd = new Date(sub.currentPeriodEnd as any);
    } catch { }
    if (!periodStart) {
      const s = new Date();
      s.setDate(1);
      s.setHours(0, 0, 0, 0);
      periodStart = s;
    }
    try {
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const raw = cfg?.settings as any;
      const settings = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
      const judit = settings?.judit || {};
      const lastPeriodStart = judit?.periodStart || null;
      const curPeriodStart = periodStart.toISOString();
      if (!lastPeriodStart || lastPeriodStart !== curPeriodStart) {
        const nextSettings = {
          ...settings,
          judit: {
            ...(settings.judit || {}),
            periodStart: curPeriodStart,
            quotaNotified80: false,
            quotaNotifiedLimit: false,
          }
        };
        await prisma.tenantApiConfig.upsert({
          where: { tenantId },
          update: { settings: nextSettings, updatedAt: new Date() },
          create: { tenantId, settings: nextSettings, isActive: true }
        });
      }
    } catch { }
    const where: any = { tenantId, message: 'JUDIT_QUERY', createdAt: { gte: periodStart } };
    if (periodEnd) {
      where.createdAt = { ...(where.createdAt || {}), lt: periodEnd };
    }
    const used = await prisma.systemLog.count({ where });
    const threshold80 = Math.floor(maxQueries * 0.8);
    try {
      if (used >= threshold80 && used < maxQueries) {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
        const raw = cfg?.settings as any;
        const settings = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        const judit = settings?.judit || {};
        if (!judit.quotaNotified80) {
          const t = await database.getTenantById(tenantId);
          if (t) {
            const tenantDB = new TenantDatabase(tenantId, (t as any).schemaName);
            const users = await prisma.user.findMany({ where: { tenantId, isActive: true }, select: { id: true } });
            for (const u of users) {
              await notificationsService.createNotification(tenantDB, {
                userId: u.id,
                actorId: 'system',
                type: 'system',
                title: 'Uso de consultas Judit',
                message: `Você usou ${used}/${maxQueries} consultas neste período`,
                payload: { used, max: maxQueries }
              });
            }
            const nextSettings = { ...settings, judit: { ...(settings.judit || {}), quotaNotified80: true } };
            await prisma.tenantApiConfig.upsert({ where: { tenantId }, update: { settings: nextSettings, updatedAt: new Date() }, create: { tenantId, settings: nextSettings, isActive: true } });
          }
        }
      }
    } catch { }
    if (used >= maxQueries) {
      const fee = Number(tenant?.plan?.additionalQueryFee || 0);
      if (fee > 0) {
        const t = await database.getTenantById(tenantId);
        if (t) {
          const tenantDB = new TenantDatabase(tenantId, (t as any).schemaName);
          await transactionsService.createTransaction(tenantDB, {
            type: 'income',
            amount: fee,
            categoryId: 'overage_query',
            category: 'Overage Query',
            description: 'Query overage fee',
            date: new Date().toISOString().slice(0, 10),
            paymentMethod: 'credit_card',
            status: 'confirmed',
            tags: [ 'overage', 'codilo' ]
          } as any, 'system');
          try {
            const users = await prisma.user.findMany({ where: { tenantId, isActive: true }, select: { id: true } });
            for (const u of users) {
              await notificationsService.createNotification(tenantDB, {
                userId: u.id,
                actorId: 'system',
                type: 'system',
                title: 'Consulta extra cobrada (Judit)',
                message: `Limite mensal atingido. Consulta extra cobrada: R$ ${fee.toFixed(2)}`,
                payload: { used, max: maxQueries, fee }
              });
            }
            const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
            const raw = cfg?.settings as any;
            const settings = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
            const nextSettings = { ...settings, judit: { ...(settings.judit || {}), quotaNotifiedLimit: true } };
            await prisma.tenantApiConfig.upsert({ where: { tenantId }, update: { settings: nextSettings, updatedAt: new Date() }, create: { tenantId, settings: nextSettings, isActive: true } });
          } catch { }
        }
      } else {
        try {
          const t = await database.getTenantById(tenantId);
          if (t) {
            const tenantDB = new TenantDatabase(tenantId, (t as any).schemaName);
            const users = await prisma.user.findMany({ where: { tenantId, isActive: true }, select: { id: true } });
            for (const u of users) {
              await notificationsService.createNotification(tenantDB, {
                userId: u.id,
                actorId: 'system',
                type: 'system',
                title: 'Limite do período de consultas atingido (Judit)',
                message: 'Novas consultas foram bloqueadas até o próximo ciclo.',
                payload: { used, max: maxQueries }
              });
            }
          }
        } catch { }
        throw new Error('Period query limit reached for current plan');
      }
    }
  }

  private async getApiKey(tenantId: string): Promise<string | null> {
    const config = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
    if (!config || !config.codiloApiKey || config.isActive === false) return process.env.JUDIT_API_KEY;
    return config.codiloApiKey;
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt === maxRetries - 1) throw e;
        const wait = (2 ** attempt) * 500 + Math.floor(Math.random() * 500);
        await this.sleep(wait);
      }
    }
  }

  private async createRequest(apiKey: string, payload: any): Promise<string> {
    const res = await fetch(`https://requests.prod.judit.io/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Judit request create failed: ${res.status} ${text}`);
    }
    const data: any = await res.json().catch(() => ({}));
    const id = data?.request_id || data?.id;
    if (!id) throw new Error('Invalid Judit request response');
    return String(id);
  }

  private async waitForCompletion(apiKey: string, requestId: string, timeoutMs = 20000) {
    const start = Date.now();
    let status = 'created';
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`https://requests.prod.judit.io/requests/${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Judit request status failed: ${res.status} ${text}`);
      }
      const data: any = await res.json().catch(() => ({}));
      status = data?.status || data?.result?.status || status;
      if (status === 'completed' || status === 'failed') return data;
      await this.sleep(1000);
    }
    throw new Error('Judit request timeout');
  }

  async searchProcessesByOAB(tenantId: string, oabNumber: string, uf: string): Promise<any[]> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const searchKey = `${oabNumber}/${uf}`;
    const requestId = await this.retryWithBackoff(() => this.createRequest(apiKey, {
      search: {
        search_type: 'oab',
        search_key: searchKey,
        response_type: 'lawsuits',
        search_params: {}
      }
    }));
    console.log("🚀 ~ JuditService ~ searchProcessesByOAB ~ requestId:", requestId)
    const resultData = await this.waitForCompletion(apiKey, requestId);
    console.log("🚀 ~ JuditService ~ searchProcessesByOAB ~ resultData:", resultData)
    let items: any[] = [];
    const responses = resultData?.responses || resultData?.result || resultData?.response_data || [];
    if (Array.isArray(responses)) items = responses;
    else if (Array.isArray(responses?.data)) items = responses.data;
    const normalized = items.map((it: any) => {
      const d = it?.response_data || it;
      const numero = d?.code || d?.lawsuit_cnj || d?.id || '';
      const cnj = d?.lawsuit_cnj || d?.code || '';
      const parties = Array.isArray(d?.parties) ? d.parties : (Array.isArray(d?.crawler?.parties?.data) ? d.crawler.parties.data : []);
      const cliente = parties?.[ 0 ]?.name || parties?.[ 0 ]?.document || '';
      const cover = d?.cover || d?.crawler?.cover?.data || {};
      const vara = cover?.court_name || cover?.court || d?.tribunal || '';
      const ultima = d?.last_step?.summary || '';
      const dataUltima = d?.last_step?.date || d?.updated_at || undefined;
      const classe = d?.classification?.value || '';
      const valor = d?.amount || '';
      return {
        id: String(d?.id || numero || Math.random()),
        numero,
        cnj,
        cliente,
        vara,
        status: d?.status || 'Em Andamento',
        ultima_movimentacao: ultima,
        data_ultima_movimentacao: dataUltima,
        classe,
        valor,
      };
    });
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { oabNumber, uf } }
    }).catch(() => { });
    return normalized;
  }

  async getProcessDetails(tenantId: string, codigoCnj: string): Promise<any> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const requestId = await this.retryWithBackoff(() => this.createRequest(apiKey, {
      search: {
        search_type: 'lawsuit_cnj',
        search_key: codigoCnj,
        response_type: 'lawsuit',
        search_params: {}
      }
    }));
    const resultData = await this.waitForCompletion(apiKey, requestId);
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { cnj: codigoCnj } }
    }).catch(() => { });
    return resultData;
  }

  async registerTracking(tenantId: string, payload: {
    recurrence?: number;
    search: { search_type: string; search_key: string; response_type?: string; search_params?: any };
    notification_emails?: string[];
    notification_filters?: { step_terms?: string[] };
    with_attachments?: boolean;
    plan_config_type?: string;
    fixed_time?: boolean;
    hour_range?: number;
    callbackurl?: string;
    tags?: any;
  }): Promise<any> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    console.log("🚀 ~ JuditService ~ registerTracking ~ payload:", payload)

    const body = {
      recurrence: payload.recurrence ?? 1,
      notification_emails: payload.notification_emails || [],
      notification_filters: payload.notification_filters || { step_terms: [] },
      with_attachments: payload.with_attachments ?? false,
      plan_config_type: payload.plan_config_type || 'simple_lawsuit_tracking',
      fixed_time: payload.fixed_time ?? false,
      hour_range: payload.hour_range ?? 21,
      search: {
        search_type: payload.search?.search_type,
        search_key: payload.search?.search_key,
        // search_params: payload.search?.search_params || { filter: {}, pagination: {} }
      },
      tags: payload.tags || {},
      callback_url: payload.callbackurl,
    };

    const res = await fetch(`https://tracking.prod.judit.io/tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(body)
    });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      throw new Error(`Judit tracking create failed: ${res.status} ${text}`);
    }
    console.log("🚀 ~ JuditService ~ registerTracking ~ res:", data)
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'tracking_create', search: payload?.search } }
    }).catch(() => { });
    return data;
  }

  async listTrackings(tenantId: string, params: { page?: number; page_size?: number; status?: string | string[] } = {}, opts: { skipLog?: boolean } = {}): Promise<any> {
    // Listar monitoramentos não consome quota (conforme doc Judit)
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 20;
    const url = new URL(`https://tracking.prod.judit.io/tracking`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(pageSize));
    if (params.status) {
      const s = Array.isArray(params.status) ? params.status.join(',') : params.status;
      if (s) url.searchParams.set('status', s);
    }
    const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', 'api-key': apiKey } });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      throw new Error(`Judit tracking list failed: ${res.status} ${text}`);
    }
    if (!opts?.skipLog) {
      await prisma.systemLog.create({
        data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'tracking_list', params: { page, page_size: pageSize, status: params.status } } }
      }).catch(() => { });
    }
    return data;
  }

  async getTracking(tenantId: string, trackingId: string): Promise<any> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const res = await fetch(`https://tracking.prod.judit.io/tracking/${encodeURIComponent(trackingId)}`, {
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey }
    });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      throw new Error(`Judit tracking get failed: ${res.status} ${text}`);
    }
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'tracking_get', trackingId } }
    }).catch(() => { });
    return data;
  }

  async pauseTracking(tenantId: string, trackingId: string): Promise<any> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const res = await fetch(`https://tracking.prod.judit.io/tracking/${encodeURIComponent(trackingId)}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey }
    });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      throw new Error(`Judit tracking pause failed: ${res.status} ${text}`);
    }
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'tracking_pause', trackingId } }
    }).catch(() => { });
    return data;
  }

  async resumeTracking(tenantId: string, trackingId: string): Promise<any> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const res = await fetch(`https://tracking.prod.judit.io/tracking/${encodeURIComponent(trackingId)}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey }
    });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      throw new Error(`Judit tracking resume failed: ${res.status} ${text}`);
    }
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'tracking_resume', trackingId } }
    }).catch(() => { });
    return data;
  }

  async deleteTracking(tenantId: string, trackingId: string): Promise<any> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const res = await fetch(`https://tracking.prod.judit.io/tracking/${encodeURIComponent(trackingId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey }
    });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      throw new Error(`Judit tracking delete failed: ${res.status} ${text}`);
    }
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'tracking_delete', trackingId } }
    }).catch(() => { });
    return data;
  }

  async getTrackingHistory(tenantId: string, trackingId: string, params: { page?: number; page_size?: number; created_at_gte?: string; created_at_lte?: string } = {}): Promise<any> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const url = new URL(`https://requests.prod.judit.io/responses/tracking/${encodeURIComponent(trackingId)}`);
    if (params.page) url.searchParams.set('page', String(params.page));
    if (params.page_size) url.searchParams.set('page_size', String(params.page_size));
    if (params.created_at_gte) url.searchParams.set('created_at_gte', params.created_at_gte);
    if (params.created_at_lte) url.searchParams.set('created_at_lte', params.created_at_lte);
    const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', 'api-key': apiKey } });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      throw new Error(`Judit tracking history failed: ${res.status} ${text}`);
    }
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'tracking_history', trackingId, params } }
    }).catch(() => { });
    return data;
  }

  private async ensureTrackingsTable(tenantDB: TenantDatabase): Promise<void> {
    const create = `
      CREATE TABLE IF NOT EXISTS \${schema}.judit_trackings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        tracking_id VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'created',
        recurrence INT DEFAULT 1,
        notification_emails JSONB DEFAULT '[]',
        notification_filters JSONB DEFAULT '{}',
        with_attachments BOOLEAN DEFAULT FALSE,
        plan_config_type VARCHAR,
        fixed_time BOOLEAN DEFAULT FALSE,
        hour_range INT DEFAULT 21,
        search JSONB NOT NULL DEFAULT '{}',
        tags JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        last_webhook_received_at TIMESTAMPTZ DEFAULT NULL
      )
    `;
    await queryTenantSchema(tenantDB, create);
    await queryTenantSchema(tenantDB, `CREATE UNIQUE INDEX IF NOT EXISTS idx_judit_trackings_tracking ON \${schema}.judit_trackings(tracking_id)`);
    await queryTenantSchema(tenantDB, `CREATE INDEX IF NOT EXISTS idx_judit_trackings_user ON \${schema}.judit_trackings(user_id)`);
    try {
      await queryTenantSchema(tenantDB, `ALTER TABLE \${schema}.judit_trackings ADD COLUMN IF NOT EXISTS last_webhook_received_at TIMESTAMPTZ DEFAULT NULL`);
    } catch {
      // Coluna já existe ou outro erro; ignorar para não quebrar o fluxo
    }
  }

  async saveTrackingRecord(tenantDB: TenantDatabase, userId: string, data: any): Promise<any> {
    await this.ensureTrackingsTable(tenantDB);
    const record = {
      user_id: userId,
      tracking_id: data?.tracking_id || data?.id,
      status: data?.status || 'created',
      recurrence: data?.recurrence ?? 1,
      notification_emails: Array.isArray(data?.notification_emails) ? data.notification_emails : [],
      notification_filters: data?.notification_filters || {},
      with_attachments: !!data?.with_attachments,
      plan_config_type: data?.plan_config_type || null,
      fixed_time: !!data?.fixed_time,
      hour_range: data?.hour_range ?? 21,
      search: data?.search || {},
      tags: data?.tags || {},
      created_at: data?.created_at || new Date().toISOString(),
      updated_at: data?.updated_at || new Date().toISOString(),
      is_active: true,
    };
    return insertInTenantSchema<any>(tenantDB, 'judit_trackings', record);
  }

  async listLocalTrackings(tenantDB: TenantDatabase, userId: string): Promise<any[]> {
    await this.ensureTrackingsTable(tenantDB);
    const query = `SELECT * FROM \${schema}.judit_trackings WHERE is_active = TRUE AND user_id = $1 ORDER BY created_at DESC`;
    const rows = await queryTenantSchema<any>(tenantDB, query, [userId]);
    return rows || [];
  }

  /** Mapa tracking_id -> user_id para identificar donos na sincronização. */
  async getLocalTrackingsOwnerMap(tenantDB: TenantDatabase): Promise<Map<string, string>> {
    await this.ensureTrackingsTable(tenantDB);
    const rows = await queryTenantSchema<any>(tenantDB, `SELECT tracking_id, user_id FROM \${schema}.judit_trackings WHERE is_active = TRUE`);
    const map = new Map<string, string>();
    for (const r of rows || []) {
      if (r?.tracking_id != null && r?.user_id != null) map.set(String(r.tracking_id), String(r.user_id));
    }
    return map;
  }

  /** Retorna o registro local do tracking ou null. */
  async getLocalTrackingByTrackingId(tenantDB: TenantDatabase, trackingId: string): Promise<any | null> {
    await this.ensureTrackingsTable(tenantDB);
    const rows = await queryTenantSchema<any>(tenantDB, `SELECT * FROM \${schema}.judit_trackings WHERE tracking_id = $1 LIMIT 1`, [String(trackingId)]);
    return rows?.[0] ?? null;
  }

  /**
   * Identifica o dono do tracking quando não está na tabela (sincronização).
   * 1) Por notification_emails -> usuário do tenant com esse email
   * 2) Por OAB (search_type === 'oab') -> user_id de outro registro com mesmo search_key
   */
  async identifyTrackingOwner(tenantDB: TenantDatabase, tenantId: string, tracking: any): Promise<string | null> {
    const search = tracking?.search && typeof tracking.search === 'object' ? tracking.search : {};
    const searchType = search?.search_type ?? '';
    const searchKey = search?.search_key ?? '';
    const notificationEmails = Array.isArray(tracking?.notification_emails) ? tracking.notification_emails : [];

    if (notificationEmails.length > 0) {
      const emails = notificationEmails.filter((e: any) => typeof e === 'string' && e.trim()).map((e: string) => e.trim());
      if (emails.length > 0) {
        const user = await prisma.user.findFirst({
          where: { tenantId, email: { in: emails }, isActive: true },
          select: { id: true },
        });
        if (user) return user.id;
      }
    }

    if (searchType === 'oab' && searchKey) {
      const rows = await queryTenantSchema<any>(
        tenantDB,
        `SELECT user_id FROM \${schema}.judit_trackings WHERE is_active = TRUE AND search->>'search_type' = 'oab' AND search->>'search_key' = $1 LIMIT 1`,
        [String(searchKey)]
      );
      if (rows?.[0]?.user_id) return String(rows[0].user_id);
    }

    return null;
  }

  /** Atualiza apenas o user_id do registro quando já existe (sincronização). */
  async updateTrackingRecordOwner(tenantDB: TenantDatabase, trackingId: string, userId: string): Promise<void> {
    await this.ensureTrackingsTable(tenantDB);
    await queryTenantSchema(tenantDB, `UPDATE \${schema}.judit_trackings SET user_id = $2, updated_at = NOW() WHERE tracking_id = $1`, [String(trackingId), userId]);
  }

  async updateLocalTrackingStatus(tenantDB: TenantDatabase, trackingId: string, status: string): Promise<void> {
    await this.ensureTrackingsTable(tenantDB);
    const sql = `UPDATE \${schema}.judit_trackings SET status = $2, updated_at = NOW(), is_active = CASE WHEN $2 = 'deleted' THEN FALSE ELSE is_active END WHERE tracking_id = $1`;
    await queryTenantSchema(tenantDB, sql, [ trackingId, status ]);
  }

  /** Atualiza o timestamp de último webhook recebido para o tracking (Última Atualização na UI). */
  async updateLocalTrackingLastWebhookAt(tenantDB: TenantDatabase, trackingId: string): Promise<void> {
    await this.ensureTrackingsTable(tenantDB);
    await queryTenantSchema(tenantDB, `UPDATE \${schema}.judit_trackings SET last_webhook_received_at = NOW(), updated_at = NOW() WHERE tracking_id = $1`, [String(trackingId)]);
  }

  private async ensureTrackingHistoryTable(tenantDB: TenantDatabase): Promise<void> {
    const create = `
      CREATE TABLE IF NOT EXISTS \${schema}.judit_tracking_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tracking_id VARCHAR NOT NULL,
        response_id VARCHAR NOT NULL,
        response_type VARCHAR,
        response_data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      )
    `;
    await queryTenantSchema(tenantDB, create);
    await queryTenantSchema(tenantDB, `CREATE UNIQUE INDEX IF NOT EXISTS idx_judit_history_response ON \${schema}.judit_tracking_history(response_id)`);
    await queryTenantSchema(tenantDB, `CREATE INDEX IF NOT EXISTS idx_judit_history_tracking ON \${schema}.judit_tracking_history(tracking_id)`);
  }

  async saveTrackingHistoryRecord(tenantDB: TenantDatabase, trackingId: string, item: any): Promise<any> {
    await this.ensureTrackingHistoryTable(tenantDB);
    const record = {
      tracking_id: String(trackingId),
      response_id: String(item?.response_id || item?.id || `${Date.now()}`),
      response_type: item?.response_type || '',
      response_data: item?.response_data || item || {},
      created_at: item?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };
    return insertInTenantSchema<any>(tenantDB, 'judit_tracking_history', record);
  }

  async saveTrackingHistoryBatch(tenantDB: TenantDatabase, trackingId: string, items: any[] = []): Promise<void> {
    await this.ensureTrackingHistoryTable(tenantDB);
    for (const it of items || []) {
      try { await this.saveTrackingHistoryRecord(tenantDB, trackingId, it); } catch { }
    }
  }

  async listLocalTrackingHistory(tenantDB: TenantDatabase, trackingId: string, params: { page?: number; page_size?: number } = {}): Promise<any> {
    await this.ensureTrackingHistoryTable(tenantDB);
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 50;
    const offset = (page - 1) * pageSize;
    const countRows = await queryTenantSchema<any>(tenantDB, `SELECT COUNT(*)::int AS total FROM \${schema}.judit_tracking_history WHERE is_active = TRUE AND tracking_id = $1`, [ String(trackingId) ]);
    const total = Number(countRows?.[ 0 ]?.total || 0);
    const rows = await queryTenantSchema<any>(tenantDB, `
      SELECT response_id, response_type, response_data, created_at, updated_at
      FROM \${schema}.judit_tracking_history
      WHERE is_active = TRUE AND tracking_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [ String(trackingId), pageSize, offset ]);
    const page_data = (rows || []).map((r: any) => ({
      response_id: r.response_id,
      response_type: r.response_type,
      response_data: r.response_data,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    return { page, page_size: pageSize, total, page_data };
  }

  async getLocalTrackingHistoryItem(tenantDB: TenantDatabase, responseId: string): Promise<any | null> {
    await this.ensureTrackingHistoryTable(tenantDB);
    const rows = await queryTenantSchema<any>(tenantDB, `
      SELECT tracking_id, response_id, response_type, response_data, created_at, updated_at
      FROM \${schema}.judit_tracking_history
      WHERE response_id = $1
      LIMIT 1
    `, [ String(responseId) ]);
    return rows?.[ 0 ] || null;
  }

  private async ensureRequestsTable(tenantDB: TenantDatabase): Promise<void> {
    const create = `
      CREATE TABLE IF NOT EXISTS \${schema}.judit_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        request_id VARCHAR NOT NULL,
        search JSONB NOT NULL DEFAULT '{}',
        status VARCHAR NOT NULL DEFAULT 'pending',
        result JSONB DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await queryTenantSchema(tenantDB, create);
    await queryTenantSchema(tenantDB, `CREATE INDEX IF NOT EXISTS idx_judit_requests_user ON \${schema}.judit_requests(user_id)`);
    await queryTenantSchema(tenantDB, `CREATE UNIQUE INDEX IF NOT EXISTS idx_judit_requests_reqid ON \${schema}.judit_requests(request_id)`);
  }

  async createSearchRequest(tenantId: string, tenantDB: TenantDatabase, userId: string, payload: any, waitFor = false, isFromClient = false): Promise<{ request_id: string; status: string; responses?: any[]; saved: any; }> {
    await this.enforceQueryQuota(tenantId);
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');

    const requestId = await this.retryWithBackoff(() => this.createRequest(apiKey, payload));
    if (!isFromClient) {
      await this.ensureRequestsTable(tenantDB);
    }

    let saved: any;

    if (isFromClient) {
      await this.ensurePublicClientRequestsTable();
      const search = payload?.search || payload || {};
      const searchType = String(search?.search?.search_type || search?.search_type || '');
      const searchKey = String(search?.search?.search_key || search?.search_key || '');
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.client_requests (search_type, search_key, status, search, request_ids, created_at, updated_at)
        VALUES ($1, $2, 'pending', $3::jsonb, jsonb_build_array($4), NOW(), NOW())
        ON CONFLICT (search_type, search_key) DO UPDATE SET
          status = 'pending',
          search = EXCLUDED.search,
          request_ids = CASE
            WHEN jsonb_typeof(public.client_requests.request_ids) = 'array'
              THEN public.client_requests.request_ids || to_jsonb($4)
            ELSE jsonb_build_array($4)
          END,
          updated_at = NOW()
      `, searchType, searchKey, JSON.stringify(search), requestId);
      saved = { searchType, searchKey, request_id: requestId };
    } else {
      saved = await insertInTenantSchema<any>(tenantDB, 'judit_requests', {
        user_id: userId,
        request_id: requestId,
        search: payload?.search || payload || {},
        status: 'pending',
      });
    }



    let responses: any[] | undefined;
    let status = 'pending';
    if (waitFor) {
      const data = await this.waitForCompletion(apiKey, requestId);
      status = data?.status || 'completed';
      const resps = data?.responses || data?.result || data?.response_data || [];
      responses = Array.isArray(resps) ? resps : (Array.isArray(resps?.data) ? resps.data : []);
      if (isFromClient) {
        const search = payload?.search || payload || {};
        const searchType = String(search?.search?.search_type || search?.search_type || '');
        const searchKey = String(search?.search?.search_key || search?.search_key || '');
        await prisma.$executeRawUnsafe(`
          UPDATE public.client_requests
          SET status = $3,
              last_update = NOW(),
              metadata = $4::jsonb,
              updated_at = NOW()
          WHERE search_type = $1 AND search_key = $2
        `, searchType, searchKey, status, JSON.stringify(data || {}));
      } else {
        await updateInTenantSchema(tenantDB, 'judit_requests', saved.id, {
          status,
          result: data || {},
          updated_at: new Date().toISOString(),
        });
      }
    }

    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_REQUEST', metadata: { requestId, search: payload?.search } }
    }).catch(() => { });

    return { request_id: requestId, status, responses, saved };
  }

  async ensurePublicClientRequestsTable(): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.client_requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          search_type VARCHAR NOT NULL,
          search_key VARCHAR NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'pending',
          process_number VARCHAR NULL,
          process_title VARCHAR NULL,
          last_update TIMESTAMPTZ NULL,
          timeline JSONB NOT NULL DEFAULT '[]',
          request_ids JSONB NOT NULL DEFAULT '[]',
          search JSONB NOT NULL DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (search_type, search_key)
        );
      `);
    } catch { }
  }

  async listRequests(tenantDB: TenantDatabase, userId: string): Promise<any[]> {
    await this.ensureRequestsTable(tenantDB);
    const query = `SELECT * FROM \${schema}.judit_requests WHERE user_id = $1 ORDER BY created_at DESC`;
    const rows = await queryTenantSchema<any>(tenantDB, query, [ userId ]);
    return rows;
  }
  async listClientRequests(tenantDB: TenantDatabase, userId: string): Promise<any[]> {
    await this.ensureClientRequestsTable(tenantDB);
    const query = `SELECT * FROM \${schema}.client_requests WHERE user_id = $1 ORDER BY created_at DESC`;
    const rows = await queryTenantSchema<any>(tenantDB, query, [ userId ]);
    return rows;
  }

  async getRequestById(tenantDB: TenantDatabase, userId: string, id: string): Promise<any | null> {
    await this.ensureRequestsTable(tenantDB);
    const query = `SELECT * FROM \${schema}.judit_requests WHERE id = $1::uuid AND user_id = $2`;
    const rows = await queryTenantSchema<any>(tenantDB, query, [ id, userId ]);
    return rows?.[ 0 ] || null;
  }
  async ensureClientRequestsTable(tenantDB: TenantDatabase): Promise<void> {
    const create = `
      CREATE TABLE IF NOT EXISTS \${schema}.client_requests (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL,
        request_id TEXT NOT NULL UNIQUE,
        search JSONB DEFAULT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        result JSONB DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await queryTenantSchema(tenantDB, create);
    await queryTenantSchema(tenantDB, `CREATE INDEX IF NOT EXISTS idx_client_requests_user ON \${schema}.client_requests(user_id)`);
  }

  async refreshRequest(tenantId: string, tenantDB: TenantDatabase, userId: string, id: string): Promise<{ updated: any; data: any }> {
    await this.ensureRequestsTable(tenantDB);
    const row = await this.getRequestById(tenantDB, userId, id);
    if (!row) throw new Error('Request not found');
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) throw new Error('Judit API key not configured for tenant');
    const url = `https://requests.prod.judit.io/responses?request_id=${encodeURIComponent(row.request_id)}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'api-key': apiKey } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Judit responses fetch failed: ${res.status} ${text}`);
    }
    const dataJson = await res.json().catch(() => ({}));
    const data: any = dataJson as any;
    console.log("🚀 ~ JuditService ~ refreshRequest ~ data:", data)
    const status = data?.request_status || row.status || 'pending';
    const updated = await updateInTenantSchema(tenantDB, 'judit_requests', row.id, {
      status,
      result: data || {},
    }, true);
    await prisma.systemLog.create({
      data: { tenantId, level: 'info', message: 'JUDIT_QUERY', metadata: { operation: 'request_refresh', requestId: row.request_id } }
    }).catch(() => { });
    return { updated, data };
  }
}

export const codiloService = new JuditService();
