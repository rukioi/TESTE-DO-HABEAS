/**
 * PUBLICATIONS CONTROLLER - Gestão de Publicações Jurídicas
 * =========================================================
 * 
 * ✅ ISOLAMENTO TENANT: Usa req.tenantDB para garantir isolamento por schema
 * ✅ ISOLAMENTO POR USUÁRIO: Publicações são isoladas por usuário (diferente de outros módulos)
 * ✅ SEM DADOS MOCK: Operações reais no banco de dados do tenant
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { TenantRequest } from '../types';
import { publicationsService } from '../services/publicationsService';
import { codiloService } from '../services/juditService';
import { prisma, database, TenantDatabase } from '../config/database';
import { queryTenantSchema, updateInTenantSchema } from '../utils/tenantHelpers';
import { notificationsService } from '../services/notificationsService';
import { openAIService } from '../services/openaiService';
import { emailsService } from '../services/emailsService';

const updatePublicationSchema = z.object({
  status: z.enum([ 'nova', 'pendente', 'atribuida', 'finalizada', 'descartada' ]).optional(),
  urgencia: z.enum([ 'baixa', 'media', 'alta' ]).optional(),
  responsavel: z.string().optional(),
  varaComarca: z.string().optional(),
  nomePesquisado: z.string().optional(),
  diario: z.string().optional(),
  observacoes: z.string().optional(),
  atribuidaParaId: z.string().optional(),
  atribuidaParaNome: z.string().optional(),
  dataAtribuicao: z.string().optional(),
  tarefasVinculadas: z.array(z.string()).optional(),
});

export class PublicationsController {
  async getPublications(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        status: req.query.status as string,
        source: req.query.source as string,
        search: req.query.search as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      };

      const result = await publicationsService.getPublications(req.tenantDB, req.user.id, filters);

      res.json(result);
    } catch (error) {
      console.error('Get publications error:', error);
      res.status(500).json({
        error: 'Failed to fetch publications',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createJuditRequest(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const schema = z.object({
        judit_ia: z.array(z.string()).optional(),
        search: z.object({
          search_type: z.string(),
          search_key: z.string(),
          response_type: z.string().optional(),
          search_params: z.any().optional(),
          on_demand: z.boolean().optional(),
          cache_ttl_in_days: z.number().int().optional(),
        })
      });
      let body = schema.parse(req.body);

      if (body.search.search_type !== 'lawsuit_cnj') {
        delete body.search.response_type;
      }
      const isFromClient = req.query.fromClient === 'true';
      const callbackurl = isFromClient ?
        `${process.env.JUDIT_WEBHOOK_URL}?isFromClient=true` :
        `${process.env.JUDIT_WEBHOOK_URL}?tenantId=${req.user.tenantId}&userId=${req.user.id}`;

      const result = await codiloService.createSearchRequest(req.user.tenantId, req.tenantDB, req.user.id, { ...body, callback_url: callbackurl }, false, isFromClient);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create Judit request', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async publicCreateJuditRequest(req: Request, res: Response) {
    try {
      const schema = z.object({
        judit_ia: z.array(z.string()).optional(),
        search: z.object({
          search_type: z.string(),
          search_key: z.string(),
          response_type: z.string().optional(),
          search_params: z.any().optional(),
          on_demand: z.boolean().optional(),
          cache_ttl_in_days: z.number().int().optional(),
        })
      });
      let body = schema.parse(req.body);
      if (body.search.search_type !== 'lawsuit_cnj') {
        delete body.search.response_type;
      }
      const callbackurl = `${process.env.JUDIT_WEBHOOK_URL}?isFromClient=true`;
      const result = await codiloService.createSearchRequest('public', new TenantDatabase('public', 'public'), 'system', { ...body, callback_url: callbackurl }, false, true);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create Judit request (public)', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async listJuditRequests(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const rows = await codiloService.listRequests(req.tenantDB, req.user.id);
      res.json({ requests: rows });
    } catch (error) {
      res.status(400).json({ error: 'Failed to list Judit requests', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getJuditRequest(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { id } = req.params;
      const row = await codiloService.getRequestById(req.tenantDB, req.user.id, id);
      if (!row) return res.status(404).json({ error: 'Request not found' });
      res.json({ request: row });
    } catch (error) {
      res.status(400).json({ error: 'Failed to get Judit request', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async refreshJuditRequest(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { id } = req.params;
      const result = await codiloService.refreshRequest(req.user.tenantId, req.tenantDB, req.user.id, id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to refresh Judit request', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getPublication(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const publication = await publicationsService.getPublicationById(req.tenantDB, req.user.id, id);

      if (!publication) {
        return res.status(404).json({ error: 'Publication not found' });
      }

      res.json({ publication });
    } catch (error) {
      console.error('Get publication error:', error);
      res.status(500).json({
        error: 'Failed to fetch publication',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updatePublication(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const validatedData = updatePublicationSchema.parse(req.body);
      const oldPublication = await publicationsService.getPublicationById(req.tenantDB, req.user.id, id);
      const publication = await publicationsService.updatePublication(req.tenantDB, req.user.id, id, validatedData);

      if (!publication) {
        return res.status(404).json({ error: 'Publication not found' });
      }

      res.json({
        message: 'Publication updated successfully',
        publication,
      });

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'publications',
          recordId: publication.id,
          operation: 'update',
          oldData: oldPublication || null,
          newData: publication,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req.ip as any) || '',
          userAgent: (req.headers[ 'user-agent' ] as string) || ''
        });
      } catch { }
    } catch (error) {
      console.error('Update publication error:', error);
      res.status(400).json({
        error: 'Failed to update publication',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deletePublication(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const oldPublication = await publicationsService.getPublicationById(req.tenantDB, req.user.id, id);
      const success = await publicationsService.deletePublication(req.tenantDB, req.user.id, id);

      if (!success) {
        return res.status(404).json({ error: 'Publication not found' });
      }

      res.json({
        message: 'Publication deleted successfully',
      });

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'publications',
          recordId: id,
          operation: 'delete',
          oldData: oldPublication || null,
          newData: { is_active: false },
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req.ip as any) || '',
          userAgent: (req.headers[ 'user-agent' ] as string) || ''
        });
      } catch { }
    } catch (error) {
      console.error('Delete publication error:', error);
      res.status(500).json({
        error: 'Failed to delete publication',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getPublicationsStats(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await publicationsService.getPublicationsStats(req.tenantDB, req.user.id);

      res.json(stats);
    } catch (error) {
      console.error('Get publications stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch publications statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async importFromCodilo(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        oabNumber: z.string().min(3),
        uf: z.string().min(2),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      });
      const body = schema.parse(req.body);

      const processes = await codiloService.searchProcessesByOAB(req.user.tenantId, body.oabNumber, body.uf);

      let created = 0;
      for (const p of processes) {
        const processNumber = p?.numero || p?.cnj || p?.codigo_cnj || '';
        const publicationDate = p?.data_publicacao || p?.data || new Date().toISOString().slice(0, 10);
        const content = p?.conteudo || p?.texto || JSON.stringify(p);
        const externalId = String(p?.id || p?.codigo || processNumber || Math.random());

        try {
          await publicationsService.createPublication(req.tenantDB, req.user.id, {
            oabNumber: body.oabNumber,
            processNumber,
            publicationDate,
            content,
            source: 'Judit',
            externalId,
            status: 'nova',
          });
          created++;
        } catch (e) {
        }
      }

      res.json({ imported: created });
    } catch (error) {
      res.status(400).json({ error: 'Failed to import from Judit', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async searchCodilo(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({ oabNumber: z.string().min(3), uf: z.string().min(2) });
      const query = schema.parse({ oabNumber: req.query.oabNumber as string, uf: req.query.uf as string });
      const results = await codiloService.searchProcessesByOAB(req.user.tenantId, query.oabNumber, query.uf);
      res.json({ results });
    } catch (error) {
      console.log("🚀 ~ PublicationsController ~ searchCodilo ~ error:", error)
      res.status(400).json({ error: 'Failed to search Codilo', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async registerJuditTracking(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        recurrence: z.number().int().min(1).optional(),
        search: z.object({
          search_type: z.string().min(3),
          search_key: z.string().min(3),
          response_type: z.string().optional(),
          search_params: z.any().optional(),
        }),
        notification_emails: z.array(z.string().email()).optional(),
        notification_filters: z.object({ step_terms: z.array(z.string()).optional() }).optional(),
        with_attachments: z.boolean().optional(),
        plan_config_type: z.string().optional(),
        fixed_time: z.boolean().optional(),
        hour_range: z.number().int().optional(),
        callbackurl: z.string().url().optional(),
        tags: z.record(z.any()).optional(),
      });
      const body = schema.parse(req.body);

      const callback = (() => {
        const base = body.callbackurl || `${process.env.JUDIT_WEBHOOK_URL as string}`;
        try {
          const url = new URL(base, base.startsWith('http') ? undefined : `http://localhost:${process.env.PORT || 3000}`);
          url.searchParams.set('tenantId', req.user.tenantId);
          url.searchParams.set('userId', req.user.id);
          return url.toString();
        } catch {
          return `${base}?tenantId=${req.user.tenantId}&userId=${req.user.id}`;
        }
      })();

      const result = await codiloService.registerTracking(req.user.tenantId, {
        recurrence: body.recurrence,
        search: {
          search_type: body.search.search_type,
          search_key: body.search.search_key,
          response_type: body.search.response_type,
          search_params: body.search.search_params,
        },
        notification_emails: body.notification_emails,
        notification_filters: body.notification_filters,
        with_attachments: body.with_attachments,
        plan_config_type: body.plan_config_type,
        fixed_time: body.fixed_time,
        hour_range: body.hour_range,
        tags: body.tags,
        callbackurl: callback,
      });

      try {
        const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
        const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
        if (tenantDB) {
          await codiloService.saveTrackingRecord(tenantDB, req.user.id, result);
        }
      } catch { }

      try {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
        const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
        const trackings = settings?.judit?.trackings || {};
        trackings[ String(result?.tracking_id || result?.id || `${Date.now()}`) ] = {
          userId: req.user.id,
          search: body.search,
          recurrence: body.recurrence ?? 1,
          createdAt: new Date().toISOString(),
        };
        const nextSettings = { ...settings, judit: { ...(settings.judit || {}), trackings } };
        await prisma.tenantApiConfig.upsert({
          where: { tenantId: req.user.tenantId },
          update: { settings: nextSettings, updatedAt: new Date() },
          create: { tenantId: req.user.tenantId, settings: nextSettings, isActive: true }
        });
      } catch { }

      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to register Judit tracking', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async listJuditTrackings(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const page = parseInt(String(req.query.page || '1')) || 1;
      const pageSize = parseInt(String(req.query.page_size || '20')) || 20;
      const status = req.query.status as string | undefined;
      const forceRaw = String((req.query as any).forceSync || (req.query as any).force_sync || '');
      const forceSync = forceRaw === 'true' || forceRaw === '1';
      let external: any = undefined;
      if (forceSync) {
        external = await codiloService.listTrackings(req.user.tenantId, { page, page_size: pageSize, status }, { skipLog: false });
      }
      let localTrackings: Record<string, any> = {};
      try {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
        const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
        localTrackings = settings?.judit?.trackings || {};
      } catch { }
      let dbTrackings: any[] = [];
      try {
        const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
        const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
        if (tenantDB) {
          if (forceSync && external) {
            const items = Array.isArray(external?.page_data)
              ? external.page_data
              : (Array.isArray(external?.trackings) ? external.trackings : (Array.isArray(external) ? external : []));
            const trackingOwners = await codiloService.getLocalTrackingsOwnerMap(tenantDB);
            let trackingsMap: Record<string, { userId?: string }> = {};
            try {
              const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
              const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as string) : cfg.settings) : {};
              trackingsMap = settings?.judit?.trackings ?? {};
            } catch { }
            for (const it of items) {
              try {
                const trackingId = it?.tracking_id ?? it?.id;
                if (!trackingId) continue;
                let ownerUserId: string | null = trackingOwners.get(trackingId) ?? trackingsMap[String(trackingId)]?.userId ?? null;
                if (ownerUserId == null) {
                  ownerUserId = await codiloService.identifyTrackingOwner(tenantDB, req.user.tenantId, it);
                }
                // Nunca atribuir ao usuário atual monitoramentos sem dono identificado: só sincronizar os que já têm dono no tenant.
                if (!ownerUserId) continue;
                const existing = await codiloService.getLocalTrackingByTrackingId(tenantDB, trackingId);
                if (existing) {
                  if (existing.user_id !== ownerUserId) {
                    await codiloService.updateTrackingRecordOwner(tenantDB, trackingId, ownerUserId);
                  }
                } else {
                  await codiloService.saveTrackingRecord(tenantDB, ownerUserId, it);
                }
              } catch (err) {
                console.warn('Erro ao sincronizar item de tracking:', err);
              }
            }
          }
          dbTrackings = await codiloService.listLocalTrackings(tenantDB, req.user.id);
        }
      } catch { dbTrackings = []; }
      // db: cada item inclui last_webhook_received_at (timestamp ISO ou null) para "Última Atualização" na UI
      res.json({ external, local: localTrackings, db: dbTrackings });
    } catch (error) {
      res.status(400).json({ error: 'Failed to list Judit trackings', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getJuditTracking(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { id } = req.params as any;
      const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
      const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
      if (tenantDB) {
        const ownerRows = await queryTenantSchema<any>(
          tenantDB,
          `SELECT * FROM \${schema}.judit_trackings WHERE tracking_id = $1 AND user_id = $2`,
          [String(id), req.user.id]
        );
        if (!ownerRows?.length) {
          return res.status(403).json({
            error: 'Tracking not found or access denied',
            message: 'Este monitoramento não pertence a você ou não existe',
          });
        }
      }
      const data = await codiloService.getTracking(req.user.tenantId, id);
      let local: any = null;
      try {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
        const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
        local = settings?.judit?.trackings?.[ String(id) ] || null;
      } catch { }
      let db: any = null;
      try {
        if (tenantDB) {
          const rows = await queryTenantSchema<any>(tenantDB, `SELECT * FROM \${schema}.judit_trackings WHERE tracking_id = $1`, [ String(id) ]);
          db = rows?.[ 0 ] || null;
        }
      } catch { db = null; }
      res.json({ tracking: data, local, db });
    } catch (error) {
      res.status(400).json({ error: 'Failed to get Judit tracking', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async pauseJuditTracking(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { id } = req.params as any;
      const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
      const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
      if (!tenantDB) {
        return res.status(403).json({
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe',
        });
      }
      const ownerRows = await queryTenantSchema<any>(
        tenantDB,
        `SELECT * FROM \${schema}.judit_trackings WHERE tracking_id = $1 AND user_id = $2`,
        [String(id), req.user.id]
      );
      if (!ownerRows?.length) {
        return res.status(403).json({
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe',
        });
      }
      const result = await codiloService.pauseTracking(req.user.tenantId, id);
      try {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
        const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
        const trackings = settings?.judit?.trackings || {};
        trackings[ String(id) ] = { ...(trackings[ String(id) ] || {}), status: 'paused', pausedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const nextSettings = { ...settings, judit: { ...(settings.judit || {}), trackings } };
        await prisma.tenantApiConfig.upsert({ where: { tenantId: req.user.tenantId }, update: { settings: nextSettings, updatedAt: new Date() }, create: { tenantId: req.user.tenantId, settings: nextSettings, isActive: true } });
      } catch { }
      try {
        if (tenantDB) await codiloService.updateLocalTrackingStatus(tenantDB, String(id), 'paused');
      } catch { }
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to pause Judit tracking', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async resumeJuditTracking(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { id } = req.params as any;
      const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
      const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
      if (!tenantDB) {
        return res.status(403).json({
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe',
        });
      }
      const ownerRows = await queryTenantSchema<any>(
        tenantDB,
        `SELECT * FROM \${schema}.judit_trackings WHERE tracking_id = $1 AND user_id = $2`,
        [String(id), req.user.id]
      );
      if (!ownerRows?.length) {
        return res.status(403).json({
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe',
        });
      }
      const result = await codiloService.resumeTracking(req.user.tenantId, id);
      try {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
        const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
        const trackings = settings?.judit?.trackings || {};
        const obj = { ...(trackings[ String(id) ] || {}) };
        delete obj.pausedAt;
        delete obj.deletedAt;
        trackings[ String(id) ] = { ...obj, status: 'active', updatedAt: new Date().toISOString() };
        const nextSettings = { ...settings, judit: { ...(settings.judit || {}), trackings } };
        await prisma.tenantApiConfig.upsert({ where: { tenantId: req.user.tenantId }, update: { settings: nextSettings, updatedAt: new Date() }, create: { tenantId: req.user.tenantId, settings: nextSettings, isActive: true } });
      } catch { }
      try {
        if (tenantDB) await codiloService.updateLocalTrackingStatus(tenantDB, String(id), 'active');
      } catch { }
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to resume Judit tracking', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async deleteJuditTracking(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { id } = req.params as any;
      const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
      const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);

      if (!tenantDB) {
        return res.status(403).json({
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe',
        });
      }
      const rows = await queryTenantSchema<any>(
        tenantDB,
        `SELECT * FROM \${schema}.judit_trackings WHERE tracking_id = $1 AND user_id = $2`,
        [String(id), req.user.id]
      );
      if (!rows?.length) {
        return res.status(403).json({
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe',
        });
      }

      let result: any;
      try {
        result = await codiloService.deleteTracking(req.user.tenantId, id);
      } catch (error: any) {
        const msg = String(error?.message ?? '');
        if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
          if (tenantDB) await codiloService.updateLocalTrackingStatus(tenantDB, String(id), 'deleted');
          try {
            const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
            const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
            const trackings = settings?.judit?.trackings || {};
            if (trackings[String(id)]) {
              trackings[String(id)] = { ...(trackings[String(id)] || {}), status: 'deleted', deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            }
            const nextSettings = { ...settings, judit: { ...(settings.judit || {}), trackings } };
            await prisma.tenantApiConfig.upsert({ where: { tenantId: req.user.tenantId }, update: { settings: nextSettings, updatedAt: new Date() }, create: { tenantId: req.user.tenantId, settings: nextSettings, isActive: true } });
          } catch { }
          return res.json({ message: 'Tracking já estava deletado', deleted: true });
        }
        throw error;
      }

      try {
        const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
        const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
        const trackings = settings?.judit?.trackings || {};
        if (trackings[String(id)]) {
          trackings[String(id)] = { ...(trackings[String(id)] || {}), status: 'deleted', deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }
        const nextSettings = { ...settings, judit: { ...(settings.judit || {}), trackings } };
        await prisma.tenantApiConfig.upsert({ where: { tenantId: req.user.tenantId }, update: { settings: nextSettings, updatedAt: new Date() }, create: { tenantId: req.user.tenantId, settings: nextSettings, isActive: true } });
      } catch { }
      try {
        if (tenantDB) await codiloService.updateLocalTrackingStatus(tenantDB, String(id), 'deleted');
      } catch { }
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete Judit tracking', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getJuditTrackingHistory(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { id } = req.params as any;
      const page = parseInt(String(req.query.page || '1')) || 1;
      const page_size = parseInt(String(req.query.page_size || '50')) || 50;
      const created_at_gte = req.query.created_at_gte as string | undefined;
      const created_at_lte = req.query.created_at_lte as string | undefined;
      const forceRaw = String((req.query as any).forceSync || (req.query as any).force_sync || '');
      const forceSync = forceRaw === 'true' || forceRaw === '1';
      const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
      const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
      if (!tenantDB) {
        const data = await codiloService.getTrackingHistory(req.user.tenantId, String(id), { page, page_size, created_at_gte, created_at_lte });
        return res.json(data);
      }
      const ownerRows = await queryTenantSchema<any>(
        tenantDB,
        `SELECT * FROM \${schema}.judit_trackings WHERE tracking_id = $1 AND user_id = $2`,
        [String(id), req.user.id]
      );
      if (!ownerRows?.length) {
        return res.status(403).json({
          error: 'Tracking not found or access denied',
          message: 'Este monitoramento não pertence a você ou não existe',
        });
      }
      if (forceSync) {
        try {
          const external = await codiloService.getTrackingHistory(req.user.tenantId, String(id), { page, page_size, created_at_gte, created_at_lte });
          const items = Array.isArray(external?.page_data) ? external.page_data : [];
          await codiloService.saveTrackingHistoryBatch(tenantDB, String(id), items);
        } catch { }
      }
      const local = await codiloService.listLocalTrackingHistory(tenantDB, String(id), { page, page_size });
      res.json(local);
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch Judit tracking history', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async getJuditTrackingHistoryItem(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { responseId } = req.params as any;
      const t = req.tenantDB ? null : await database.getTenantById(req.user.tenantId);
      const tenantDB = req.tenantDB || (t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null);
      if (!tenantDB) return res.status(400).json({ error: 'Missing tenant database context' });
      const item = await codiloService.getLocalTrackingHistoryItem(tenantDB, String(responseId));
      if (!item) return res.status(404).json({ error: 'History item not found' });
      res.json({ item });
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch tracking history item', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async historyLookup(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const schema = z.object({
        search_type: z.string(),
        search_key: z.string(),
      });
      const query = schema.parse({
        search_type: String(req.query.search_type || ''),
        search_key: String(req.query.search_key || ''),
      });
      const rows = await codiloService.listRequests(req.tenantDB, req.user.id);
      const matches = (rows || []).filter((r: any) => {
        const s = r?.search || {};
        const type = String(s?.search?.search_type || s?.search_type || '').toLowerCase();
        const key = String(s?.search?.search_key || s?.search_key || '').trim();
        return type === String(query.search_type).toLowerCase() && key === query.search_key;
      });
      let timeline: Array<{ date?: string; title?: string; description?: string }> = [];
      let processNumber: string | undefined = undefined;
      let processTitle: string | undefined = undefined;
      let status: string | undefined = undefined;
      for (const r of matches) {
        const result = r?.result || {};
        const responses = Array.isArray(result?.responses) ? result.responses
          : Array.isArray(result?.result) ? result.result
            : Array.isArray(result?.response_data) ? result.response_data
              : Array.isArray(result?.data) ? result.data
                : [];
        const items = responses.map((it: any) => {
          const d = it?.response_data || it;
          const date = d?.date || d?.event_date || d?.created_at || d?.updated_at;
          const title = d?.title || d?.description || d?.summary || d?.event_title;
          const desc = d?.description || d?.summary || d?.details || d?.event_description;
          return { date, title, description: desc };
        });
        timeline = timeline.concat(items);
        try {
          const d0 = (responses?.[ 0 ]?.response_data || responses?.[ 0 ]) || {};
          processNumber = processNumber || d0?.lawsuit_cnj || d0?.code || undefined;
          processTitle = processTitle || d0?.subject || d0?.title || undefined;
          status = status || result?.request_status || r?.status || undefined;
        } catch { }
      }
      timeline = timeline.sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0;
        const tb = b.date ? new Date(b.date).getTime() : 0;
        return tb - ta;
      });
      // Simplificação do último passo usando análises já salvas (metadata.summaries)
      let simplified: string | undefined;
      try {
        const rowMetaRaw = (rows as any)?.metadata || {};
        const rowMeta = typeof rowMetaRaw === 'string' ? JSON.parse(rowMetaRaw) : rowMetaRaw;
        const lastRaw = rowMeta?.last;
        const lastPayload = typeof lastRaw === 'string' ? JSON.parse(lastRaw) : lastRaw;
        const respData = (lastPayload as any)?.response_data || lastPayload || {};
        const steps = Array.isArray(respData?.steps) ? respData.steps : [];
        const latest = steps.sort((a: any, b: any) => {
          const ta = new Date(a?.step_date || a?.updated_at || a?.created_at || 0).getTime();
          const tb = new Date(b?.step_date || b?.updated_at || b?.created_at || 0).getTime();
          return tb - ta;
        })[ 0 ];
        const sid = String(latest?.step_id || '');
        const summaries = rowMeta?.summaries || {};
        simplified = sid && summaries?.[ sid ]?.text ? String(summaries[ sid ].text) : undefined;
      } catch { simplified = undefined; }
      const lastUpdate = timeline.length > 0 ? {
        date: timeline[ 0 ].date,
        detail: timeline[ 0 ].title || timeline[ 0 ].description || '',
        next: simplified || timeline[ 1 ]?.title || '',
      } : null;
      res.json({
        timeline,
        lastUpdate,
        processNumber,
        processTitle,
        status: status || 'pending',
      });
    } catch (error) {
      console.log("🚀 ~ PublicationsController ~ historyLookup ~ error:", error)
      res.status(400).json({ error: 'Failed to lookup history', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async publicHistoryLookup(req: Request, res: Response) {
    try {
      const schema = z.object({
        search_type: z.string(),
        search_key: z.string(),
      });
      const query = schema.parse({
        search_type: String(req.query.search_type || ''),
        search_key: String(req.query.search_key || ''),
      });
      const row = await prisma.clientRequest.findUnique({
        where: { searchType_searchKey: { searchType: query.search_type, searchKey: query.search_key } }
      }).catch(() => null);

      let timeline: Array<{ date?: string; title?: string; description?: string }> =
        Array.isArray((row as any)?.timeline) ? (((row as any).timeline as any[]) || []) : [];
      let processNumber: string | undefined = (row as any)?.processNumber || undefined;
      let processTitle: string | undefined = (row as any)?.processTitle || undefined;
      let status: string | undefined = (row as any)?.status || undefined;

      if ((!timeline || timeline.length === 0) && (row as any)?.metadata) {
        try {
          const meta = (row as any)?.metadata || {};
          const lastRaw = (meta as any)?.last;
          const last = typeof lastRaw === 'string' ? JSON.parse(lastRaw) : lastRaw;
          const respData = (last as any)?.response_data || last || {};
          const steps = Array.isArray((respData as any)?.steps) ? ((respData as any).steps as any[]) : [];
          if (steps.length > 0) {
            const items = steps.map((s: any) => ({
              date: s?.step_date || s?.updated_at || s?.created_at || new Date().toISOString(),
              title: s?.content || 'Atualização',
              description: String(s?.lawsuit_cnj || '')
            }));
            timeline = items;
            processNumber = processNumber || (respData?.code as string) || (respData?.lawsuit_cnj as string) || undefined;
            processTitle = processTitle || (respData?.name as string) || (respData?.subject as string) || (respData?.title as string) || undefined;
            status = status || (meta as any)?.request_status || (row as any)?.status || undefined;
          }
        } catch { }
      }

      timeline = (timeline || []).sort((a, b) => {
        const ta = a.date ? new Date(a.date).getTime() : 0;
        const tb = b.date ? new Date(b.date).getTime() : 0;
        return tb - ta;
      });
      let simplified: string | undefined;
      try {
        const meta = (row as any)?.metadata || {};
        const summaries = (meta && (meta as any).summaries) ? (meta as any).summaries : {};
        const last = timeline[ 0 ];
        if (last) {
          const lastRaw = (meta as any)?.last;
          const lastPayload = typeof lastRaw === 'string' ? JSON.parse(lastRaw) : lastRaw;
          const respData = (lastPayload as any)?.response_data || lastPayload || {};
          const steps = Array.isArray(respData?.steps) ? respData.steps : [];
          const latest = steps.sort((a: any, b: any) => {
            const ta = new Date(a?.step_date || a?.updated_at || a?.created_at || 0).getTime();
            const tb = new Date(b?.step_date || b?.updated_at || b?.created_at || 0).getTime();
            return tb - ta;
          })[ 0 ];
          const sid = String(latest?.step_id || '');
          simplified = sid && summaries?.[ sid ]?.text ? String(summaries[ sid ].text) : undefined;
        }
      } catch { simplified = undefined; }
      const lastUpdate = timeline.length > 0 ? {
        date: timeline[ 0 ].date,
        detail: timeline[ 0 ].title || timeline[ 0 ].description || '',
        next: simplified || timeline[ 1 ]?.title || '',
      } : null;
      res.json({
        timeline,
        lastUpdate,
        processNumber,
        processTitle,
        status: status || 'pending',
      });
    } catch (error) {
      res.status(400).json({ error: 'Failed to lookup history (public)', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async getJuditQuota(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, include: { plan: true } });
      if (!tenant || !tenant.plan) {
        return res.status(404).json({ error: 'Plan not found for tenant' });
      }
      const max = tenant.plan.maxQueries || 0;
      const fee = Number(tenant.plan.additionalQueryFee || 0);
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const used = await prisma.systemLog.count({ where: { tenantId: req.user.tenantId, message: 'JUDIT_QUERY', createdAt: { gte: start } } });
      const remaining = Math.max(0, max - used);
      const percentage = max > 0 ? Math.round((used / max) * 100) : 0;
      const resetAt = new Date(start);
      resetAt.setMonth(resetAt.getMonth() + 1);
      const t = await database.getTenantById(req.user.tenantId);
      const tenantDB = t ? new TenantDatabase(req.user.tenantId, (t as any).schemaName) : null;
      let overageAmount = 0;
      let overageCount = 0;
      if (tenantDB) {
        const rows = await prisma.$queryRawUnsafe<any[]>(`
          SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric AS amount
          FROM "${await tenantDB.getSchemaName()}".transactions
          WHERE is_active = TRUE AND category_id = 'overage_query'
            AND date >= DATE_TRUNC('month', NOW()) AND type = 'income'
        `);
        overageCount = Number(rows?.[ 0 ]?.count || 0);
        overageAmount = Number(rows?.[ 0 ]?.amount || 0);
      }
      const blocked = max > 0 && used >= max && fee <= 0;
      res.json({
        plan: { id: tenant.plan.id, name: tenant.plan.name, maxQueries: max, additionalQueryFee: fee },
        usage: { used, remaining, percentage, nextResetAt: resetAt.toISOString() },
        overage: { count: overageCount, amount: overageAmount },
        blocked
      });
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch Judit quota', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async juditWebhook(req: Request, res: Response) {
    try {

      if (req.body.payload.response_data.message === "REQUEST_COMPLETED" && req.body.payload.response_data.code === 600) {
        return res.status(200).json({ message: 'Webhook processed successfully' });
      }

      const tenantId = (req.query.tenantId as string) || (req.body?.tenantId as string) || '';
      const trackingId =
        (req.body?.reference_type === 'tracking' && req.body?.reference_id) ? String(req.body.reference_id) :
          (req.body?.tracking_id as string) || (req.body?.id as string) || '';
      const requestRefId = ((req.body?.reference_type === 'request' || req.body?.reference_type === 'lawsuit') && req.body?.reference_id) ? String(req.body.reference_id || req.body.origin_id) : '';
      const isFromClient = String((req.query as any).isFromClient || (req.query as any).fromClient || '').toLowerCase() === 'true';
      if (!isFromClient && !tenantId) return res.status(400).json({ error: 'Missing tenantId' });

      const tenant = !isFromClient ? await database.getTenantById(tenantId) : null;
      if (!isFromClient && !tenant) return res.status(404).json({ error: 'Tenant not found' });
      const tenantDB = !isFromClient && tenant ? new TenantDatabase(tenantId, (tenant as any).schemaName) : null;

      let userId = (req.query.userId as string) || (req.body?.userId as string) || '';
      let notificationEmails: string[] = [];
      if (!isFromClient && trackingId && tenantDB) {
        try {
          const trackingRow = await codiloService.getLocalTrackingByTrackingId(tenantDB, trackingId);
          if (trackingRow?.user_id) userId = String(trackingRow.user_id);
          if (trackingRow?.notification_emails && Array.isArray(trackingRow.notification_emails)) {
            notificationEmails = trackingRow.notification_emails.filter((e: any) => typeof e === 'string' && String(e).trim()).map((e: string) => String(e).trim());
          }
        } catch { }
      }
      if (!userId) {
        try {
          const cfg = !isFromClient ? await prisma.tenantApiConfig.findUnique({ where: { tenantId } }) : null;
          const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
          userId = settings?.judit?.trackings?.[ String(trackingId) ]?.userId || '';
        } catch { userId = ''; }
      }
      if (!userId) {
        try {
          const firstUser = !isFromClient ? await prisma.user.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } }) : null;
          userId = (firstUser && String(firstUser.id)) || 'system';
        } catch { userId = 'system'; }
      } else {
        try {
          if (!isFromClient) {
            const u = await prisma.user.findUnique({ where: { id: userId } });
            if (!u || String(u.tenantId) !== String(tenantId) || !u.isActive) {
              const firstUser = await prisma.user.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } });
              userId = (firstUser && String(firstUser.id)) || 'system';
            }
          }
        } catch { userId = 'system'; }
      }

      const publicationDate = new Date().toISOString().slice(0, 10);
      const payload = (req.body?.payload as any) || {};
      const responseData = (payload?.response_data as any) || (req.body?.response_data as any) || req.body;
      const responseId = String(payload?.response_id || req.body?.response_id || '');
      const responseType = String(payload?.response_type || req.body?.response_type || 'lawsuit');
      const processNumber = (req.body?.search?.search_key as string) || (responseData?.lawsuit_cnj as string) || (responseData?.code as string) || '';
      const externalId = String(trackingId || processNumber || Date.now());
      const content = JSON.stringify(req.body);

      if (requestRefId) {
        try {
          if (isFromClient) {
            const reqId = String(requestRefId);
            const statusNext = (req.body?.event_type === 'response_created') ? 'updated' : ((req.body?.event_type) ? 'updating' : 'updated');
            const pn = (responseData?.code as string) || (responseData?.lawsuit_cnj as string) || undefined;
            const pt = (responseData?.name as string) || (responseData?.subject as string) || (responseData?.title as string) || undefined;
            const steps = Array.isArray((responseData as any)?.steps) ? ((responseData as any).steps as any[]) : [];
            const items = steps.map((s: any) => ({
              date: s?.step_date || s?.updated_at || s?.created_at || new Date().toISOString(),
              title: s?.content || 'Atualização',
              description: String(s?.lawsuit_cnj || '')
            }));
            if (!items.length) {
              const fallback = {
                date: (req.body?.payload as any)?.created_at || responseData?.updated_at || responseData?.created_at || new Date().toISOString(),
                title: (responseData?.last_step?.summary as string) || (responseData?.status as string) || 'Atualização',
                description: (responseData?.name as string) || (responseData?.county as string) || ''
              };
              items.push(fallback);
            }
            const itemsJson = JSON.stringify(items);
            const metaLast = JSON.stringify(req.body?.payload || req.body || {});
            const esc = (v: string) => v.replace(/'/g, "''");
            const valPn = pn ? `'${esc(String(pn))}'` : `NULL`;
            const valPt = pt ? `'${esc(String(pt))}'` : `NULL`;
            await prisma.$executeRawUnsafe(`
              UPDATE public.client_requests
              SET status = '${esc(String(statusNext))}',
                  last_update = NOW(),
                  process_number = COALESCE(process_number, ${valPn}),
                  process_title = COALESCE(process_title, ${valPt}),
                  timeline = '${esc(itemsJson)}'::jsonb,
                  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{last}', '${esc(metaLast)}'::jsonb, true),
                  updated_at = NOW()
              WHERE request_ids @> jsonb_build_array('${esc(reqId)}')
            `);
            try {
              const rows2 = await prisma.$queryRawUnsafe<any[]>(`SELECT id, metadata, process_title, process_number FROM public.client_requests WHERE request_ids @> jsonb_build_array('${esc(reqId)}') LIMIT 1`);
              const row = rows2?.[ 0 ] || null;
              const metaRaw = row?.metadata || {};
              const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
              const summaries = (meta && meta.summaries) ? meta.summaries : {};
              const latest = steps.sort((a: any, b: any) => {
                const ta = new Date(a?.step_date || a?.updated_at || a?.created_at || 0).getTime();
                const tb = new Date(b?.step_date || b?.updated_at || b?.created_at || 0).getTime();
                return tb - ta;
              })[ 0 ];
              const sid = String(latest?.step_id || '');
              if (sid && !summaries[ sid ]) {
                const simplified = await openAIService.summarizeStepForLayman(latest, { processTitle: String(row?.process_title || ''), processNumber: String(row?.process_number || '') });
                if (simplified) {
                  summaries[ sid ] = { text: simplified, created_at: new Date().toISOString() };
                  summaries[ '__latest' ] = { text: simplified, created_at: new Date().toISOString(), step_id: sid };
                  const nextMeta = { ...meta, summaries };
                  await prisma.$executeRawUnsafe(`UPDATE public.client_requests SET metadata = '${esc(JSON.stringify(nextMeta))}'::jsonb, updated_at = NOW() WHERE id = '${esc(String(row?.id || ''))}'`);
                }
              }
            } catch { }
          } else if (tenantDB) {
            const table = 'judit_requests';
            const rows = await queryTenantSchema<any>(tenantDB, `SELECT * FROM \${schema}.${table} WHERE request_id = $1 LIMIT 1`, [ requestRefId ]);
            const reqRow = rows?.[ 0 ] || null;
            if (reqRow) {
              const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
              const apiKey = (cfg?.codiloApiKey && cfg.isActive !== false) ? cfg.codiloApiKey : (process.env.JUDIT_API_KEY as string | undefined);
              if (!apiKey) {
                throw new Error('Judit API key not configured for tenant');
              }
              const url = `https://requests.prod.judit.io/responses?request_id=${encodeURIComponent(requestRefId)}`;
              const resp = await fetch(url, { headers: { 'Content-Type': 'application/json', 'api-key': apiKey } });
              if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                throw new Error(`Judit responses fetch failed: ${resp.status} ${text}`);
              }
              const dataJson = await resp.json().catch(() => ({}));
              const data: any = dataJson as any;
              const status = data?.request_status || reqRow.status || 'pending';
              await updateInTenantSchema<any>(tenantDB, table, String(reqRow.id), {
                status,
                result: data || {},
              }, true);
              try {
                await notificationsService.createNotification(tenantDB, {
                  userId,
                  actorId: 'system',
                  type: 'system',
                  title: 'Consulta atualizada',
                  message: `Consulta atualizada pelo webhook: ${requestRefId}`,
                  payload: { requestId: String(reqRow.id), juditRequestId: requestRefId, event_type: req.body?.event_type || null },
                  link: `/consultas-judit/${String(reqRow.id)}`
                });
              } catch { }
            }
          }
        } catch (e) {
          console.log('Webhook Judit (request) update error:', e);
        }
      }

      try {
        const item = {
          response_id: String(payload?.response_id || req.body?.response_id || `${Date.now()}`),
          response_type: String(payload?.response_type || req.body?.response_type || 'lawsuit'),
          response_data: responseData,
          created_at: req.body?.timestamp || new Date().toISOString(),
        };
        if (!isFromClient && trackingId && tenantDB) {
          try {
            await codiloService.saveTrackingRecord(tenantDB, userId, {
              tracking_id: trackingId,
              status: item?.response_id ? 'updated' : 'created',
              search: req.body?.search || {},
              hour_range: (req.body?.hour_range as any) ?? undefined,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } catch { }
          await codiloService.saveTrackingHistoryRecord(tenantDB, trackingId, item);
          const type = String(req.body?.event_type || '').toLowerCase();
          const newStatus = type === 'response_created' ? 'updated' : (type ? 'updating' : 'updated');
          await codiloService.updateLocalTrackingStatus(tenantDB, trackingId, newStatus);
          await codiloService.updateLocalTrackingLastWebhookAt(tenantDB, trackingId);
          try {
            await notificationsService.createNotification(tenantDB, {
              userId,
              actorId: 'system',
              type: 'system',
              title: 'Monitoramento atualizado (Judit)',
              message: `Histórico atualizado pelo webhook. Tracking ${trackingId}, resposta ${item.response_id}.`,
              payload: {
                trackingId,
                response_id: item.response_id,
                response_type: item.response_type,
                request_id: (req.body?.payload as any)?.request_id || req.body?.request_id || null,
                event_type: req.body?.event_type || null,
              },
              link: item?.response_id ? `/processos-judit/${item.response_id}` : undefined,
            });
          } catch { }
        }
      } catch { }

      // ✅ Somente monitoramentos geram publicações
      if (!isFromClient && trackingId && tenantDB) {
        try {
          const created = await publicationsService.createPublication(tenantDB, userId, {
            oabNumber: 'Judit',
            processNumber,
            publicationDate,
            content,
            source: 'Judit',
            externalId: String(responseId || externalId),
            status: 'nova',
            metadata: {
              trackingId,
              response_id: responseId || null,
              response_type: responseType,
              search: req.body?.search || {},
              event_type: req.body?.event_type || null
            }
          } as any);
          try {
            await notificationsService.createNotification(tenantDB, {
              userId,
              actorId: userId,
              type: 'system',
              title: 'Nova publicação Judit',
              message: `Monitoramento atualizado: ${processNumber || String(responseId || externalId)}`,
              payload: { publicationId: created.id, processNumber, trackingId, response_id: responseId || null },
              link: `/publicacoes/${created.id}`
            });
          } catch { }
          if (notificationEmails.length > 0 && emailsService.hasSmtpConfig()) {
            try {
              const processLabel = processNumber || trackingId || 'Processo';
              await emailsService.sendEmail({
                to: notificationEmails,
                subject: `Monitoramento Judit atualizado - ${processLabel}`,
                html: `<p>Foi feita uma atualização no seu monitoramento (${processLabel}). Acesse o sistema para ver o conteúdo.</p><p>— Habeas Desk</p>`,
              });
            } catch { }
          }
        } catch { }
      }

      res.json({ received: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to process Judit webhook', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

export const publicationsController = new PublicationsController();
