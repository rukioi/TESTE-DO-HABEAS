import { Response } from 'express';
import { z } from 'zod';
import { TenantRequest } from '../types';
import { estimatesService } from '../services/estimatesService';
import { database } from '../config/database';

const createEstimateSchema = z.object({
  number: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().optional(),
  // clientName: z.string().min(1),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  amount: z.number().min(0.01),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  status: z.enum(['draft','sent','viewed','approved','rejected','pending','cancelled']).default('draft'),
  date: z.string().min(1),
  validUntil: z.string().optional(),
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

const updateEstimateSchema = createEstimateSchema.partial().extend({
  convertedToInvoice: z.boolean().optional(),
  invoiceId: z.string().optional(),
});

class EstimatesController {
  async getEstimates(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) return res.status(401).json({ error: 'Authentication required' });
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        status: req.query.status as string,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        clientId: req.query.clientId as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      };
      const result = await estimatesService.getEstimates(req.tenantDB, filters);
      res.json(result);
    } catch (error) {
      console.error('Get estimates error:', error);
      res.status(500).json({ error: 'Failed to fetch estimates', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getEstimate(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) return res.status(401).json({ error: 'Authentication required' });
      const { id } = req.params;
      const estimate = await estimatesService.getEstimateById(req.tenantDB, id);
      if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
      res.json({ estimate });
    } catch (error) {
      console.error('Get estimate error:', error);
      res.status(500).json({ error: 'Failed to fetch estimate', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async createEstimate(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) return res.status(401).json({ error: 'Authentication required' });
      const validated = createEstimateSchema.parse(req.body);
      // @ts-expect-error
      const estimate = await estimatesService.createEstimate(req.tenantDB, validated, req.user.id);
      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'estimates',
          recordId: estimate.id,
          operation: 'create',
          oldData: null,
          newData: estimate,
          ipAddress: (req.headers['x-forwarded-for'] as string) || (req.ip as any) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        });
      } catch {}
      res.status(201).json({ message: 'Estimate created successfully', estimate });
    } catch (error) {
      console.error('Create estimate error:', error);
      res.status(400).json({ error: 'Failed to create estimate', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async updateEstimate(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) return res.status(401).json({ error: 'Authentication required' });
      const { id } = req.params;
      const validated = updateEstimateSchema.parse(req.body);
      const oldEstimate = await estimatesService.getEstimateById(req.tenantDB, id);
      const estimate = await estimatesService.updateEstimate(req.tenantDB, id, validated as any);
      if (!estimate) return res.status(404).json({ error: 'Estimate not found or not updated' });
      res.json({ message: 'Estimate updated successfully', estimate });
      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'estimates',
          recordId: estimate.id,
          operation: 'update',
          oldData: oldEstimate || null,
          newData: estimate,
          ipAddress: (req.headers['x-forwarded-for'] as string) || (req.ip as any) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        });
      } catch {}
    } catch (error) {
      console.error('Update estimate error:', error);
      res.status(400).json({ error: 'Failed to update estimate', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async deleteEstimate(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) return res.status(401).json({ error: 'Authentication required' });
      const { id } = req.params;
      const oldEstimate = await estimatesService.getEstimateById(req.tenantDB, id);
      const deleted = await estimatesService.deleteEstimate(req.tenantDB, id);
      if (!deleted) return res.status(404).json({ error: 'Estimate not found' });
      res.json({ message: 'Estimate deleted successfully' });
      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'estimates',
          recordId: id,
          operation: 'delete',
          oldData: oldEstimate || null,
          newData: { is_active: false },
          ipAddress: (req.headers['x-forwarded-for'] as string) || (req.ip as any) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        });
      } catch {}
    } catch (error) {
      console.error('Delete estimate error:', error);
      res.status(500).json({ error: 'Failed to delete estimate', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async getEstimatesStats(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) return res.status(401).json({ error: 'Authentication required' });
      const stats = await estimatesService.getEstimatesStats(req.tenantDB);
      res.json({
        totalEstimates: stats.total,
        totalAmount: stats.totalAmount,
        thisMonthAmount: stats.thisMonth,
        draftCount: stats.draft,
        pendingCount: stats.pending,
        sentCount: stats.sent,
        approvedCount: stats.approved,
        rejectedCount: stats.rejected,
      });
    } catch (error) {
      console.error('Get estimate stats error:', error);
      res.status(500).json({ error: 'Failed to fetch estimates statistics', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

export const estimatesController = new EstimatesController();