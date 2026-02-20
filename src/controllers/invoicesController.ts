/**
 * INVOICES CONTROLLER - Gestão de Faturas
 * ========================================
 * 
 * ✅ ISOLAMENTO TENANT: Usa req.tenantDB para garantir isolamento por schema
 * ✅ SEM DADOS MOCK: Operações reais no banco de dados do tenant
 * ✅ CONTROLE DE ACESSO: Apenas contas COMPOSTA e GERENCIAL (não SIMPLES)
 */

import { Response } from 'express';
import { z } from 'zod';
import { TenantRequest } from '../types';
import { invoicesService } from '../services/invoicesService';
import { database, prisma } from '../config/database';
import Stripe from 'stripe';

// Validation schemas
const createInvoiceSchema = z.object({
  number: z.string().min(1, 'Invoice number is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  importBatchId: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  currency: z.enum([ 'BRL', 'USD', 'EUR' ]).default('BRL'),
  status: z.enum([ 'draft', 'sent', 'viewed', 'approved', 'rejected', 'pending', 'paid', 'overdue', 'cancelled' ]).default('draft'),
  dueDate: z.string().min(1, 'Due date is required'),
  items: z.array(z.object({
    id: z.string(),
    description: z.string(),
    quantity: z.number(),
    rate: z.number(),
    amount: z.number(),
    tax: z.number().optional(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

export class InvoicesController {
  async getInvoices(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only COMPOSTA and GERENCIAL can access billing data
      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing data not available for this account type',
        });
      }

      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        status: req.query.status as string,
        paymentStatus: req.query.paymentStatus as string,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        clientId: req.query.clientId as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        importBatchId: req.query.importBatchId as string
      };

      const result = await invoicesService.getInvoices(req.tenantDB, filters);

      res.json(result);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({
        error: 'Failed to fetch invoices',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getInvoice(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing data not available for this account type',
        });
      }

      const { id } = req.params;
      const invoice = await invoicesService.getInvoiceById(req.tenantDB, id);

      if (!invoice) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The specified invoice could not be found',
        });
      }

      res.json({ invoice });
    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({
        error: 'Failed to fetch invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createInvoice(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing operations not available for this account type',
        });
      }

      const validatedData = createInvoiceSchema.parse(req.body);
      const invoice = await invoicesService.createInvoice(req.tenantDB, validatedData as any, req.user.id);

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'invoices',
          recordId: invoice.id,
          operation: 'create',
          oldData: null,
          newData: invoice,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req.ip as any) || '',
          userAgent: (req.headers[ 'user-agent' ] as string) || ''
        });
      } catch { }

      res.status(201).json({
        message: 'Invoice created successfully',
        invoice,
      });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(400).json({
        error: 'Failed to create invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateInvoice(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing operations not available for this account type',
        });
      }

      const { id } = req.params;
      const validatedData = updateInvoiceSchema.parse(req.body);
      const oldInvoice = await invoicesService.getInvoiceById(req.tenantDB, id);
      const invoice = await invoicesService.updateInvoice(req.tenantDB, id, validatedData as any);

      if (!invoice) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The specified invoice could not be found or updated',
        });
      }

      res.json({
        message: 'Invoice updated successfully',
        invoice,
      });

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'invoices',
          recordId: invoice.id,
          operation: 'update',
          oldData: oldInvoice || null,
          newData: invoice,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req.ip as any) || '',
          userAgent: (req.headers[ 'user-agent' ] as string) || ''
        });
      } catch { }
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(400).json({
        error: 'Failed to update invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteInvoice(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing operations not available for this account type',
        });
      }

      const { id } = req.params;
      console.log("🚀 ~ InvoicesController ~ deleteInvoice ~ id:", id)
      const oldInvoice = await invoicesService.getInvoiceById(req.tenantDB, id);
      const deleted = await invoicesService.deleteInvoice(req.tenantDB, id);

      if (!deleted) {
        return res.status(404).json({
          error: 'Invoice not found',
          message: 'The specified invoice could not be found or deleted',
        });
      }

      res.json({
        message: 'Invoice deleted successfully',
      });

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'invoices',
          recordId: id,
          operation: 'delete',
          oldData: oldInvoice || null,
          newData: { is_active: false },
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req.ip as any) || '',
          userAgent: (req.headers[ 'user-agent' ] as string) || ''
        });
      } catch { }
    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({
        error: 'Failed to delete invoice',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createInvoiceCheckoutSession(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({ error: 'Access denied', message: 'Billing operations not available for this account type' });
      }
      const { id } = req.params;
      const invoice = await invoicesService.getInvoiceById(req.tenantDB, id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      if (invoice.payment_status === 'paid' || invoice.status === 'paid') {
        return res.status(409).json({ error: 'Invoice already paid' });
      }
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: req.user.tenantId } });
      const secretKey = cfg?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
      const stripe = new Stripe(secretKey, { apiVersion: null as any });
      const successUrl = (req.body?.successUrl || process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/?checkout=success').toString();
      const cancelUrl = (req.body?.cancelUrl || process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/?checkout=cancel').toString();
      const connectAccountId = (() => {
        try {
          const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
          return settings?.stripe?.connectAccountId || '';
        } catch { return ''; }
      })();
      const pmTypes: string[] = [ 'card' ];
      const currency = (invoice.currency || 'BRL').toLowerCase();
      if (currency === 'brl') pmTypes.push('boleto');
      const expiresDays = (() => {
        try {
          const due = (invoice as any).due_date;
          if (!due) return undefined;
          const diff = Math.ceil((new Date(due as any).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return diff > 0 ? Math.min(diff, 60) : undefined;
        } catch { return undefined; }
      })();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: invoice.title || invoice.number },
              unit_amount: Math.round(Number(invoice.amount) * 100),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: invoice.client_email || undefined,
        payment_method_types: pmTypes as any,
        payment_method_options: (currency === 'brl' && expiresDays) ? ({ boleto: { expires_after_days: expiresDays } } as any) : undefined,
        payment_intent_data: connectAccountId
          ? { transfer_data: { destination: connectAccountId }, metadata: { tenantId: req.user.tenantId, invoiceId: invoice.id, invoiceNumber: invoice.number } }
          : { metadata: { tenantId: req.user.tenantId, invoiceId: invoice.id, invoiceNumber: invoice.number } },
        metadata: { tenantId: req.user.tenantId, invoiceId: invoice.id, invoiceNumber: invoice.number },
      });
      const updated = await invoicesService.updateInvoice(req.tenantDB, id, { linkPagamento: (session as any).url || null, stripeInvoiceId: undefined } as any);
      res.json({ checkoutSessionId: (session as any).id, url: (session as any).url, invoice: updated || invoice });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create invoice checkout session', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getInvoiceStats(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.json({
          totalInvoices: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
        });
      }

      const stats = await invoicesService.getInvoicesStats(req.tenantDB);
      const formattedStats = {
        totalInvoices: stats.total,
        totalAmount: stats.totalAmount,
        paidAmount: stats.paidAmount,
        pendingAmount: stats.totalAmount - stats.paidAmount,
        overdueAmount: 0, // Will need to calculate based on overdue status
        paidCount: stats.paid,
        pendingCount: stats.pending,
        overdueCount: stats.overdue,
        draftCount: stats.draft,
        thisMonth: stats.thisMonth
      };

      res.json(formattedStats);
    } catch (error) {
      console.error('Get invoice stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch invoice statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const invoicesController = new InvoicesController();
