import { Request, Response } from 'express';
import { evolutionService } from '../services/evolutionService';
import { authenticateAdminToken } from '../middleware/auth';

export const evolutionController = {
  async createInstance(req: Request, res: Response) {
    try {
      const { instanceName, integration, number, token } = req.body || {};
      if (!instanceName || !token) return res.status(400).json({ error: 'instanceName and token are required' });
      const result = await evolutionService.createInstance({ instanceName, integration, number, token });
      res.json({ result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to create instance' });
    }
  },
  async deleteInstance(req: Request, res: Response) {
    try {
      const { instanceName, token } = req.body || {};
      if (!instanceName || !token) return res.status(400).json({ error: 'instanceName and token are required' });
      const result = await evolutionService.deleteInstance({ instanceName, token });
      res.json({ result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to delete instance' });
    }
  },
  async fetchInstances(req: Request, res: Response) {
    try {
      const instanceName = String(req.query.instanceName || '');
      const result = await evolutionService.fetchInstances({ instanceName });
      res.json({ result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to fetch instances' });
    }
  },
  async connectInstance(req: Request, res: Response) {
    try {
      const instanceName = String(req.query.instanceName || req.body?.instanceName || '');
      if (!instanceName) return res.status(400).json({ error: 'instanceName is required' });
      const result = await evolutionService.connectInstance({ instanceName });
      res.json({ result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to connect instance' });
    }
  },
  async connectWebhook(req: Request, res: Response) {
    try {
      const { instanceName } = req.body || {};
      if (!instanceName) return res.status(400).json({ error: 'instanceName is required' });
      const result = await evolutionService.connectWebhook({ instanceName });
      res.json({ result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to connect webhook' });
    }
  },
  async sendMessage(req: Request, res: Response) {
    try {
      let { instanceName, number, text } = req.body || {};
      if (!number || !text) return res.status(400).json({ error: 'number and text are required' });
      if (!instanceName) {
        try {
          const tenantId = (req as any)?.user?.tenantId || (req as any)?.query?.tenantId || null;
          if (tenantId) {
            const { prisma } = await import('../config/database');
            const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
            const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
            instanceName = settings?.evolution?.selectedInstance || settings?.evolution?.instanceName || instanceName;
          }
        } catch { }
      }
      if (!instanceName) return res.status(400).json({ error: 'instanceName is required' });
      const result = await evolutionService.sendMessage({ instanceName, number, text });
      res.json({ result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to send message' });
    }
  },
  async setSelectedInstance(req: Request, res: Response) {
    try {
      const { tenantId, instanceName } = req.body || {};
      if (!tenantId || !instanceName) return res.status(400).json({ error: 'tenantId and instanceName are required' });
      const { prisma } = await import('../config/database');
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const next = { ...(settings || {}), evolution: { ...(settings?.evolution || {}), selectedInstance: instanceName } };
      await prisma.tenantApiConfig.upsert({
        where: { tenantId },
        update: { settings: next, updatedAt: new Date(), isActive: true },
        create: { tenantId, settings: next, isActive: true }
      });
      res.json({ ok: true, selectedInstance: instanceName });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to set selected instance' });
    }
  },
  async getSelectedInstance(req: Request, res: Response) {
    try {
      const tenantId = String(((req as any).user?.tenantId || req.query?.tenantId || req.body?.tenantId || '') as any);
      if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
      const { prisma } = await import('../config/database');
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const instanceName = settings?.evolution?.selectedInstance || settings?.evolution?.instanceName || '';
      let info: any = null;
      if (instanceName) {
        try {
          const data = await evolutionService.fetchInstances({ instanceName });
          const arr = Array.isArray((data as any)?.result) ? (data as any).result : Array.isArray(data) ? data : [];
          const match = arr.find((it: any) => (it?.clientName || it?.name || '').toString().includes(instanceName)) || arr[ 0 ];
          info = match ? {
            instanceName,
            number: match?.number || null,
            profileName: match?.profileName || null,
            profilePicUrl: match?.profilePicUrl || null,
            connectionStatus: match?.connectionStatus || null,
            integration: match?.integration || null,
            updatedAt: match?.updatedAt || null,
          } : null;
        } catch { }
      }
      res.json({ selectedInstance: instanceName || null, info });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to get selected instance info' });
    }
  },
};
