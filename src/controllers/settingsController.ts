import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { settingsService } from '../services/settingsService';
import { database, prisma } from '../config/database';
import { queryTenantSchema } from '../utils/tenantHelpers';
import Stripe from 'stripe';

const companySchema = z.object({
  name: z.string().min(1),
  document: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional().nullable(),
  favicon: z.string().optional().nullable(),
});

const notificationsSchema = z.object({
  pushNotifications: z.boolean().optional(),
  projectDeadlines: z
    .object({
      enabled: z.boolean(),
      daysBefore: z.array(z.number().int()).optional(),
    })
    .optional(),
  invoiceReminders: z
    .object({
      enabled: z.boolean(),
      daysBefore: z.array(z.number().int()).optional(),
      afterDue: z.boolean().optional(),
      frequency: z.enum([ 'daily', 'weekly' ]).optional(),
    })
    .optional(),
});

const legalSchema = z.object({
  inssStatuses: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        isActive: z.boolean(),
      }),
    )
    .optional(),
  caseCategories: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        isActive: z.boolean(),
        color: z.string().optional(),
      }),
    )
    .optional(),
});

export class SettingsController {
  async getCompany(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const data = await settingsService.getCompany(req.user.tenantId);
      res.json({ company: data });
    } catch (error) {
      res.status(400).json({ error: 'Failed to get company settings' });
    }
  }

  async updateCompany(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const oldCompany = await settingsService.getCompany(req.user.tenantId);
      const validated = companySchema.parse(req.body || {});
      const updated = await settingsService.updateCompany(req.user.tenantId, validated);
      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'settings.company',
          recordId: req.user.tenantId,
          operation: oldCompany && Object.keys(oldCompany || {}).length ? 'UPDATE' : 'CREATE',
          oldData: oldCompany || null,
          newData: updated || null,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch (_) { }
      res.json({ company: updated });
    } catch (error) {
      console.log("🚀 ~ SettingsController ~ updateCompany ~ error:", error)
      res.status(400).json({ error: 'Failed to update company settings' });
    }
  }

  async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const data = await settingsService.getNotifications(req.user.tenantId);
      res.json({ notifications: data });
    } catch (error) {
      res.status(400).json({ error: 'Failed to get notification settings' });
    }
  }

  async updateNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const old = await settingsService.getNotifications(req.user.tenantId);
      const validated = notificationsSchema.parse(req.body || {});
      const updated = await settingsService.updateNotifications(req.user.tenantId, validated);
      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'settings.notifications',
          recordId: req.user.tenantId,
          operation: old && Object.keys(old || {}).length ? 'UPDATE' : 'CREATE',
          oldData: old || null,
          newData: updated || null,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch (_) { }
      res.json({ notifications: updated });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update notification settings' });
    }
  }

  async getLegal(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const data = await settingsService.getLegal(req.user.tenantId);
      res.json({ legal: data });
    } catch (error) {
      res.status(400).json({ error: 'Failed to get legal settings' });
    }
  }

  async updateLegal(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const old = await settingsService.getLegal(req.user.tenantId);
      const validated = legalSchema.parse(req.body || {});
      const updated = await settingsService.updateLegal(req.user.tenantId, validated);
      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'settings.legal',
          recordId: req.user.tenantId,
          operation: old && Object.keys(old || {}).length ? 'UPDATE' : 'CREATE',
          oldData: old || null,
          newData: updated || null,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch (_) { }
      res.json({ legal: updated });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update legal settings' });
    }
  }

  async getStripeConfig(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const stripeSettings = settings?.stripe || {};
      const connectAccountId = stripeSettings.connectAccountId || '';
      let connectDetailsSubmitted = false;
      let connectChargesEnabled = false;
      let connectPayoutsEnabled = false;
      let connectRequirements: any = null;
      try {
        if (connectAccountId && process.env.STRIPE_SECRET_KEY) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: null as any });
          const account = await stripe.accounts.retrieve(connectAccountId);
          connectDetailsSubmitted = !!account.details_submitted;
          connectChargesEnabled = !!account.charges_enabled;
          connectPayoutsEnabled = !!account.payouts_enabled;
          connectRequirements = account.requirements || null;
        }
      } catch { }
      const mask = (v?: string | null) => {
        const s = (v || '').toString();
        if (!s) return '';
        if (s.length <= 8) return '••••';
        return `${s.slice(0, 4)}••••${s.slice(-4)}`;
      };
      res.json({
        stripe: {
          publishableKey: stripeSettings.publishableKey || '',
          customerId: stripeSettings.customerId || '',
          priceId: stripeSettings.priceId || '',
          connectAccountId,
          connectDetailsSubmitted,
          connectChargesEnabled,
          connectPayoutsEnabled,
          connectRequirements,
          hasSecretKey: !!cfg?.stripeSecretKey,
          secretKeyMasked: mask(cfg?.stripeSecretKey || ''),
          hasWebhookSecret: !!cfg?.stripeWebhookSecret,
          webhookSecretMasked: mask(cfg?.stripeWebhookSecret || ''),
        }
      });
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch Stripe configuration' });
    }
  }

  async updateStripeConfig(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const bodySchema = z.object({
        publishableKey: z.string().optional(),
        secretKey: z.string().min(16, 'Invalid secret key').optional(),
        webhookSecret: z.string().min(8, 'Invalid webhook secret').optional(),
        customerId: z.string().optional(),
        priceId: z.string().optional(),
      });
      const data = bodySchema.parse(req.body || {});

      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
      const currentSettings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const nextStripe = {
        ...(currentSettings?.stripe || {}),
        ...(data.publishableKey ? { publishableKey: data.publishableKey } : {}),
        ...(data.customerId ? { customerId: data.customerId } : {}),
        ...(data.priceId ? { priceId: data.priceId } : {}),
      };

      await prisma.tenantApiConfig.upsert({
        where: { tenantId: req.user.tenantId },
        update: {
          ...(data.secretKey ? { stripeSecretKey: data.secretKey } : {}),
          ...(data.webhookSecret ? { stripeWebhookSecret: data.webhookSecret } : {}),
          settings: { ...(currentSettings || {}), stripe: nextStripe },
          updatedAt: new Date(),
        },
        create: {
          tenantId: req.user.tenantId,
          stripeSecretKey: data.secretKey,
          stripeWebhookSecret: data.webhookSecret,
          settings: { stripe: nextStripe },
          isActive: true
        }
      });

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'settings.stripe',
          recordId: req.user.tenantId,
          operation: cfg ? 'UPDATE' : 'CREATE',
          oldData: { settings: currentSettings, hasSecretKey: !!cfg?.stripeSecretKey, hasWebhookSecret: !!cfg?.stripeWebhookSecret },
          newData: { settings: { ...(currentSettings || {}), stripe: nextStripe }, hasSecretKey: !!data.secretKey || !!cfg?.stripeSecretKey, hasWebhookSecret: !!data.webhookSecret || !!cfg?.stripeWebhookSecret },
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch (_) { }

      res.json({ message: 'Stripe configuration updated successfully' });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update Stripe configuration' });
    }
  }

  async getAuditLogs(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const querySchema = z.object({
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().optional().default(20),
        operation: z.enum([ 'CREATE', 'UPDATE', 'DELETE' ]).optional(),
        table: z.string().min(1).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      });
      const q = querySchema.parse(req.query || {});
      const skip = (q.page - 1) * q.limit;
      const where: any = { tenantId: req.user.tenantId };
      if (q.operation) where.operation = q.operation;
      if (q.table) where.tableName = q.table;
      if (q.dateFrom || q.dateTo) {
        where.createdAt = {};
        if (q.dateFrom) (where.createdAt as any).gte = new Date(q.dateFrom);
        if (q.dateTo) (where.createdAt as any).lte = new Date(q.dateTo);
      }
      const [ rows, total ] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: q.limit,
          skip,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.auditLog.count({ where }),
      ]);
      res.json({
        logs: rows,
        pagination: { total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) },
      });
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch audit logs' });
    }
  }

  async clearAuditLogs(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      await prisma.auditLog.deleteMany({ where: { tenantId: req.user.tenantId } });
      res.json({ message: 'Audit logs cleared' });
    } catch (error) {
      res.status(400).json({ error: 'Failed to clear audit logs' });
    }
  }

  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = req.user.tenantId!;

      const users = await prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          name: true,
          accountType: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' }
      });

      const simples = users.filter(u => u.accountType === 'SIMPLES');
      const composta = users.filter(u => u.accountType === 'COMPOSTA');
      const gerencial = users.filter(u => u.accountType === 'GERENCIAL');

      res.json({
        users: {
          simples,
          composta,
          gerencial,
        },
        counts: {
          total: users.length,
          active: users.filter(u => u.isActive).length,
          simples: simples.length,
          composta: composta.length,
          gerencial: gerencial.length,
        }
      });
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch users' });
    }
  }

  async updateUserAccountType(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const paramsSchema = z.object({ userId: z.string().min(1) });
      const bodySchema = z.object({ accountType: z.enum([ 'SIMPLES', 'COMPOSTA', 'GERENCIAL' ]) });
      const { userId } = paramsSchema.parse(req.params || {});
      const { accountType } = bodySchema.parse(req.body || {});

      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (String(target.tenantId) !== String(req.user.tenantId)) {
        return res.status(403).json({ error: 'Cannot manage users from another tenant' });
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: String(req.user.tenantId) } });
      if (!tenant || !tenant.isActive) {
        return res.status(403).json({ error: 'Inactive or missing tenant' });
      }

      const activeUsersCount = await prisma.user.count({ where: { tenantId: String(req.user.tenantId), isActive: true } });
      if (activeUsersCount > (tenant.maxUsers || 0)) {
        return res.status(403).json({ error: 'Plan user limit exceeded' });
      }

      const oldData = { accountType: target.accountType };
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { accountType, updatedAt: new Date() },
        select: { id: true, email: true, name: true, accountType: true, isActive: true, tenantId: true }
      });

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'settings.users',
          recordId: userId,
          operation: 'UPDATE',
          oldData,
          newData: updated,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch (_) { }

      res.json({ message: 'User account type updated', user: updated });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update user account type' });
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const paramsSchema = z.object({ userId: z.string().min(1) });
      const { userId } = paramsSchema.parse(req.params || {});

      if (userId === req.user.id) {
        return res.status(403).json({ error: 'You cannot delete your own account' });
      }

      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (String(target.tenantId) !== String(req.user.tenantId)) {
        return res.status(403).json({ error: 'Cannot manage users from another tenant' });
      }

      const oldData = { isActive: target.isActive };
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isActive: false, updatedAt: new Date() },
        select: { id: true, email: true, name: true, accountType: true, isActive: true, tenantId: true }
      });

      try { await database.revokeAllUserTokens(userId); } catch (_) { }

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'settings.users',
          recordId: userId,
          operation: 'DELETE',
          oldData,
          newData: updated,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch (_) { }

      res.json({ message: 'User deactivated', user: updated });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete user' });
    }
  }

  async exportClientsCSV(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) return res.status(401).json({ error: 'Authentication required' });
      const query = `
        SELECT 
          COALESCE(name, '') AS name,
          COALESCE(email, '') AS email,
          COALESCE(phone, '') AS phone,
          COALESCE(country, 'BR') AS country,
          COALESCE(state, '') AS state,
          COALESCE(address, '') AS address,
          COALESCE(city, '') AS city,
          COALESCE(zip_code, '') AS zip_code,
          COALESCE(cpf, '') AS cpf,
          COALESCE(rg, '') AS rg
        FROM \${schema}.clients
        WHERE is_active = TRUE
        ORDER BY created_at ASC
      `;
      const rows = await queryTenantSchema<any>(req.tenantDB, query);
      const headers = [ 'Nome', 'Email', 'Telefone', 'País', 'Estado', 'Endereço', 'Cidade', 'CEP', 'CPF', 'RG' ];
      const escape = (v: any) => {
        const s = String(v ?? '');
        const needsQuote = /[",\n]/.test(s);
        const esc = s.replace(/"/g, '""');
        return needsQuote ? `"${esc}"` : esc;
      };
      const lines: string[] = [];
      lines.push(headers.join(','));
      for (const r of rows) {
        const row = [ r.name, r.email, r.phone, r.country, r.state, r.address, r.city, r.zip_code, r.cpf, r.rg ].map(escape).join(',');
        lines.push(row);
      }
      const csv = lines.join('\n');
      const fname = `clientes_${req.user.tenantId}_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.status(200).send(csv);
    } catch (error) {
      res.status(400).json({ error: 'Failed to export clients' });
    }
  }
}

export const settingsController = new SettingsController();
