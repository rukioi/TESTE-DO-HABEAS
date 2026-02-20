import { Request, Response } from 'express';
import { runReceivablesReminder } from '../services/receivablesReminderService';
import { database, TenantDatabase } from '../config/database';
import { scheduledNotificationsService } from '../services/scheduledNotificationsService';
import { evolutionService } from '../services/evolutionService';

export const receivablesJobsController = {
  async runReminder(req: Request, res: Response) {
    try {
      const secret = process.env.CRON_SECRET || '';
      const header = String(req.headers[ 'x-cron-token' ] || '');
      if (secret && header !== secret) {
        return res.status(401).json({ error: 'Unauthorized cron' });
      }
      const days = Number(req.query.days || 3);
      await runReceivablesReminder(isNaN(days) ? 3 : Math.max(1, days));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to run reminder' });
    }
  },

  async scheduleNotification(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = user?.tenantId;
      if (!user || !tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenant = await database.getTenantById(tenantId);
      const tenantDB = new TenantDatabase(tenantId, (tenant as any).schemaName);
      const { clientPhone, message, scheduledDate, scheduledTime, instanceName, invoiceId } = (req.body || {});
      if (!clientPhone || !message || !scheduledDate || !scheduledTime) return res.status(400).json({ error: 'Missing required fields' });
      const scheduledAtISO = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      const row = await scheduledNotificationsService.schedule(tenantDB, { clientPhone, message, scheduledAtISO, instanceName, invoiceId });
      res.json({ ok: true, scheduled: row });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to schedule notification' });
    }
  },
  async runScheduler(req: Request, res: Response) {
    try {
      const secret = process.env.CRON_SECRET || '';
      const header = String(req.headers[ 'x-cron-token' ] || '');
      if (secret && header !== secret) {
        return res.status(401).json({ error: 'Unauthorized cron' });
      }
      const tenants = await database.getAllTenants();
      const nowISO = new Date().toISOString();
      for (const t of tenants.rows) {
        try {
          const tenantId = t.id as string;
          const tenantDB = new TenantDatabase(tenantId, (t as any).schemaName);
          const cfg = await (await import('../config/database')).prisma.tenantApiConfig.findUnique({ where: { tenantId } });
          const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
          const instanceName = settings?.evolution?.selectedInstance || settings?.evolution?.instanceName || '';
          const due = await scheduledNotificationsService.listDue(tenantDB, nowISO);
          for (const row of due) {
            try {
              const toSendInstance = row.instance_name || instanceName;
              if (!toSendInstance) throw new Error('Instance not configured');
              await evolutionService.sendMessage({ instanceName: toSendInstance, number: row.client_phone, text: row.message });
              await scheduledNotificationsService.mark(tenantDB, row.id, { status: 'sent' });
            } catch (err: any) {
              await scheduledNotificationsService.mark(tenantDB, row.id, { status: 'failed', error: err?.message || String(err) });
            }
          }
        } catch { }
      }
      res.json({ ok: true, now: nowISO });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to run scheduler' });
    }
  },
  async listScheduled(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = user?.tenantId;
      if (!user || !tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenant = await database.getTenantById(tenantId);
      const tenantDB = new TenantDatabase(tenantId, (tenant as any).schemaName);
      const limit = Number(req.query.limit || 200);
      const rows = await scheduledNotificationsService.listAll(tenantDB, isNaN(limit) ? 200 : limit);
      res.json({ scheduled: rows });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to list scheduled notifications' });
    }
  },
  async updateScheduled(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = user?.tenantId;
      if (!user || !tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenant = await database.getTenantById(tenantId);
      const tenantDB = new TenantDatabase(tenantId, (tenant as any).schemaName);
      const { id } = req.params as any;
      const patch = req.body || {};
      const row = await scheduledNotificationsService.update(tenantDB, id, patch);
      res.json({ scheduled: row });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to update scheduled notification' });
    }
  },
  async deleteScheduled(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const tenantId = user?.tenantId;
      if (!user || !tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenant = await database.getTenantById(tenantId);
      const tenantDB = new TenantDatabase(tenantId, (tenant as any).schemaName);
      const { id } = req.params as any;
      const row = await scheduledNotificationsService.delete(tenantDB, id);
      res.json({ deleted: !!row });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to delete scheduled notification' });
    }
  }
}
