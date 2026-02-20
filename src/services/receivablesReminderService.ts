import { prisma, database, TenantDatabase } from '../config/database';
import { evolutionService } from './evolutionService';
import { notificationsService } from './notificationsService';

function fmtBRL(n: number) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n); }
  catch { return `R$ ${n.toFixed(2)}`; }
}

export async function runReceivablesReminder(daysThreshold: number = 3) {
  const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
  for (const t of tenants) {
    try {
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: t.id } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const instanceName = settings?.evolution?.selectedInstance || settings?.evolution?.instanceName || '';
      if (!instanceName) continue;
      const tenantDB = new TenantDatabase(t.id, (t as any).schemaName);
      const now = Date.now();
      const soonMs = now + daysThreshold * 24 * 60 * 60 * 1000;
      const soonISO = new Date(soonMs).toISOString().split('T')[0];
      const todayISO = new Date().toISOString().split('T')[0];
      const invoices = await (await import('./invoicesService')).invoicesService.getInvoices(tenantDB, {
        status: 'pendente',
        dateTo: soonISO,
        dateFrom: todayISO,
        limit: 500,
        page: 1
      } as any);
      const list = Array.isArray((invoices as any)?.items) ? (invoices as any).items : Array.isArray(invoices) ? invoices : [];
      for (const inv of list) {
        try {
          const amount = Number(inv.amount || inv.total || 0);
          const num = inv.number || inv.numeroFatura || '';
          const due = inv.due_date || inv.dueDate;
          const clientPhone = inv.client_phone || inv.receiverDetails?.phone || '';
          const payLink = inv.link_pagamento || inv.linkPagamento || '';
          if (!clientPhone) continue;
          const lines = [
            `Olá! Lembrete de pagamento da fatura ${num}.`,
            `Valor: ${fmtBRL(amount)} • Vencimento: ${due ? new Date(due).toLocaleDateString('pt-BR') : 'N/A'}.`,
            payLink ? `Link para pagar: ${payLink}` : `Se precisar, responda este WhatsApp para receber o link.`,
          ];
          const text = lines.join('\n');
          await evolutionService.sendMessage({ instanceName, number: clientPhone, text });
          try {
            await notificationsService.createNotification(tenantDB, {
              userId: 'system',
              actorId: 'system',
              type: 'invoice',
              title: 'Lembrete de fatura enviado',
              message: `Fatura ${num} – ${fmtBRL(amount)} vence ${due ? new Date(due).toLocaleDateString('pt-BR') : 'N/A'}`,
              payload: { invoiceId: inv.id, number: num, amount, dueDate: due, link: payLink },
            });
          } catch { }
        } catch { }
      }
    } catch { }
  }
}

