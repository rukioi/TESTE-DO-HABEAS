import { prisma } from '../config/database';
import { Resend } from 'resend';

export interface WeeklyReportFilters {
  userId?: string;
  operation?: string;
  days?: number;
}

export class ReportsService {
  async getWeeklyReport(tenantId: string, filters: WeeklyReportFilters = {}) {
    const days = filters.days && filters.days > 0 ? filters.days : 7;
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: any = { tenantId, createdAt: { gte: fromDate } };
    if (filters.userId) where.userId = filters.userId;
    if (filters.operation) where.operation = filters.operation;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    const total = await prisma.auditLog.count({ where });

    const byOperation = await prisma.auditLog.groupBy({
      by: [ 'operation' ],
      where,
      _count: { _all: true }
    });

    const byTable = await prisma.auditLog.groupBy({
      by: [ 'tableName' ],
      where,
      _count: { _all: true }
    });

    const byUser = await prisma.auditLog.groupBy({
      by: [ 'userId' ],
      where,
      _count: { _all: true }
    });

    const daysSeries: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      const c = await prisma.auditLog.count({ where: { ...where, createdAt: { gte: start, lte: end } } });
      daysSeries.push({ date: start.toISOString().substring(0, 10), count: c });
    }

    return {
      tenantId,
      range: { from: fromDate.toISOString(), to: new Date().toISOString(), days },
      totals: {
        total,
        creates: byOperation.find(x => x.operation === 'create')?._count._all || 0,
        updates: byOperation.find(x => x.operation === 'update')?._count._all || 0,
        deletes: byOperation.find(x => x.operation === 'delete')?._count._all || 0
      },
      byOperation: byOperation.map(x => ({ operation: x.operation, count: x._count._all })),
      byTable: byTable.map(x => ({ table: x.tableName, count: x._count._all })),
      byUser: byUser.map(x => ({ userId: x.userId, count: x._count._all })),
      recent: logs.map(l => ({
        id: l.id,
        userId: l.userId,
        tableName: l.tableName,
        operation: l.operation,
        createdAt: l.createdAt.toISOString(),
        oldData: l.oldData ?? null,
        newData: l.newData ?? null,
      })),
      daysSeries
    };
  }

  async renderWeeklyReportHtml(tenantName: string, report: any) {
    const op = report.totals;
    const topTables = report.byTable.sort((a: any, b: any) => b.count - a.count).slice(0, 6);
    const topUsers = report.byUser.sort((a: any, b: any) => b.count - a.count).slice(0, 6);
    const series = Array.isArray(report.daysSeries) ? report.daysSeries : [];
    const list = report.recent.slice(0, 20);
    const tableRows = topTables.map((t: any) => `<tr><td>${t.table}</td><td style="text-align:right">${t.count}</td></tr>`).join('');
    const userRows = topUsers.map((u: any) => `<tr><td>${u.userId}</td><td style="text-align:right">${u.count}</td></tr>`).join('');
    const activityRows = series.map((d: any) => `<tr><td>${d.date}</td><td style="text-align:right">${d.count}</td></tr>`).join('');
    const recentRows = list.map((r: any) => `<tr><td>${r.createdAt.substring(0, 19).replace('T', ' ')}</td><td>${r.operation}</td><td>${r.tableName}</td><td>${r.userId}</td></tr>`).join('');
    return `
    <div style="font-family: Inter, Arial, sans-serif; color:#0f172a">
      <h2 style="margin:0 0 8px 0">Relatório Semanal de Uso • ${tenantName}</h2>
      <p style="margin:0 0 16px 0; color:#334155">Período: ${new Date(report.range.from).toLocaleDateString('pt-BR')} — ${new Date(report.range.to).toLocaleDateString('pt-BR')}</p>
      <div style="display:flex; gap:16px; margin-bottom:16px">
        <div style="flex:1; background:#f8fafc; padding:12px; border-radius:8px">
          <div>Total de ações</div>
          <div style="font-size:24px; font-weight:600">${op.total}</div>
        </div>
        <div style="flex:1; background:#f8fafc; padding:12px; border-radius:8px">
          <div>Criações</div>
          <div style="font-size:24px; font-weight:600">${op.creates}</div>
        </div>
        <div style="flex:1; background:#f8fafc; padding:12px; border-radius:8px">
          <div>Atualizações</div>
          <div style="font-size:24px; font-weight:600">${op.updates}</div>
        </div>
        <div style="flex:1; background:#f8fafc; padding:12px; border-radius:8px">
          <div>Exclusões</div>
          <div style="font-size:24px; font-weight:600">${op.deletes}</div>
        </div>
      </div>
      <div style="display:flex; gap:16px">
        <div style="flex:1">
          <h3 style="margin:0 0 8px 0">Tabelas mais ativas</h3>
          <table style="width:100%; border-collapse:collapse">
            <thead><tr><th style="text-align:left">Tabela</th><th style="text-align:right">Ações</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div style="flex:1">
          <h3 style="margin:0 0 8px 0">Usuários mais ativos</h3>
          <table style="width:100%; border-collapse:collapse">
            <thead><tr><th style="text-align:left">Usuário</th><th style="text-align:right">Ações</th></tr></thead>
            <tbody>${userRows}</tbody>
          </table>
        </div>
      </div>
      <div style="margin-top:16px">
        <h3 style="margin:0 0 8px 0">Atividade por dia</h3>
        <table style="width:100%; border-collapse:collapse">
          <thead><tr><th style="text-align:left">Data</th><th style="text-align:right">Ações</th></tr></thead>
          <tbody>${activityRows}</tbody>
        </table>
      </div>
      <div style="margin-top:16px">
        <h3 style="margin:0 0 8px 0">Ações recentes</h3>
        <table style="width:100%; border-collapse:collapse">
          <thead><tr><th style="text-align:left">Data/Hora</th><th>Operação</th><th>Tabela</th><th>Usuário</th></tr></thead>
          <tbody>${recentRows}</tbody>
        </table>
      </div>
    </div>`;
  }

  async sendWeeklyReportEmail(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { users: true } });
    if (!tenant || !tenant.isActive) return false;
    const report = await this.getWeeklyReport(tenantId, {});
    const html = await this.renderWeeklyReportHtml(tenant.name, report);
    const resendKey = process.env.RESEND_API_KEY || null;
    if (!resendKey) return false;
    const resend = new Resend(resendKey);
    const recipients = tenant.users.filter(u => u.isActive).map(u => u.email);
    if (recipients.length === 0) return false;
    await resend.emails.send({ from: 'Relatórios <reports@legalsaas.com>', to: recipients, subject: `Relatório semanal • ${tenant.name}`, html });
    return true;
  }

  async sendWeeklyReportsForAllTenants() {
    const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {
      try { await this.sendWeeklyReportEmail(t.id); } catch { }
    }
  }
}

export const reportsService = new ReportsService();
