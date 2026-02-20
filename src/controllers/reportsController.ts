import { Response } from 'express';
import { z } from 'zod';
import { TenantRequest } from '../types';
import { reportsService } from '../services/reportsService';

const querySchema = z.object({
  userId: z.string().optional(),
  operation: z.string().optional(),
  days: z.coerce.number().min(1).max(30).optional()
});

export class ReportsController {
  async getWeekly(req: TenantRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const q = querySchema.parse({ userId: req.query.userId, operation: req.query.operation, days: req.query.days });
      const report = await reportsService.getWeeklyReport(req.user.tenantId, q);
      res.json({ report });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate weekly report', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

export const reportsController = new ReportsController();