import { prisma } from '../config/database';

export class SettingsService {
  async getSettings(tenantId: string): Promise<any> {
    const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
    const raw = cfg?.settings as any;
    if (!raw) return {};
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async upsertSettings(tenantId: string, patch: any): Promise<any> {
    const current = await this.getSettings(tenantId);
    const next = { ...current, ...patch };
    await prisma.tenantApiConfig.upsert({
      where: { tenantId },
      update: { settings: next, updatedAt: new Date() },
      create: { tenantId, settings: next, isActive: true },
    });
    return next;
  }

  async getCompany(tenantId: string): Promise<any> {
    const s = await this.getSettings(tenantId);
    return s?.company || {};
  }

  async updateCompany(tenantId: string, data: any): Promise<any> {
    const next = await this.upsertSettings(tenantId, { company: { ...(await this.getCompany(tenantId)), ...data } });
    if (typeof data?.name === 'string' && data.name.trim()) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { name: data.name } });
    }
    return next.company;
  }

  async getNotifications(tenantId: string): Promise<any> {
    const s = await this.getSettings(tenantId);
    return s?.notifications || {};
  }

  async updateNotifications(tenantId: string, data: any): Promise<any> {
    const next = await this.upsertSettings(tenantId, { notifications: { ...(await this.getNotifications(tenantId)), ...data } });
    return next.notifications;
  }

  async getLegal(tenantId: string): Promise<any> {
    const s = await this.getSettings(tenantId);
    return s?.legal || {};
  }

  async updateLegal(tenantId: string, data: any): Promise<any> {
    const next = await this.upsertSettings(tenantId, { legal: { ...(await this.getLegal(tenantId)), ...data } });
    return next.legal;
  }
}

export const settingsService = new SettingsService();
