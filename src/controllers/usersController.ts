import { Request, Response } from 'express';
import { prisma, database } from '../config/database';
import { Prisma } from '@prisma/client';
import * as z from 'zod';

const listCollaboratorsQuerySchema = z.object({
  status: z.enum([ 'active', 'inactive', 'all' ]).optional().default('active'),
  accountType: z.enum([ 'SIMPLES', 'COMPOSTA', 'GERENCIAL' ]).optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  page: z.string().optional(),
});

export const usersController = {
  async getCollaborators(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      console.log("🚀 ~ user:", user)
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'Tenant context not found' });
      }

      const query = listCollaboratorsQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res.status(400).json({ error: 'Invalid query params', details: query.error.flatten() });
      }
      const { status, accountType, search, limit, page } = query.data;

      const where: any = {
        tenantId: user.tenantId,
      };
      if (status && status !== 'all') {
        where.isActive = status === 'active';
      }
      if (accountType) {
        where.accountType = accountType;
      }
      if (search && search.trim()) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const take = Math.max(parseInt(limit || '100', 10), 1);
      const pageNum = Math.max(parseInt(page || '1', 10), 1);
      const skip = (pageNum - 1) * take;

      const clauses: any[] = [ Prisma.sql`tenant_id = ${user.tenantId}` ];
      if (status && status !== 'all') {
        clauses.push(Prisma.sql`is_active = ${status === 'active'}`);
      }
      if (accountType) {
        clauses.push(Prisma.sql`account_type = ${accountType}`);
      }
      if (search && search.trim()) {
        const like = `%${search.trim()}%`;
        clauses.push(Prisma.sql`(name ILIKE ${like} OR email ILIKE ${like})`);
      }
      const whereSQL = clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}` : Prisma.sql``;

      const rows: any[] = await prisma.$queryRaw(Prisma.sql`
        SELECT 
          id::text AS id, 
          name, 
          email, 
          account_type AS "accountType", 
          is_active AS "isActive", 
          created_at::text AS "createdAt",
          avatar
        FROM "users"
        ${whereSQL}
        ORDER BY name ASC
        LIMIT ${take} OFFSET ${skip}
      `);
      const totalRows: any[] = await prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "users"
        ${whereSQL}
      `);
      const total = totalRows?.[ 0 ]?.count || 0;

      return res.json({
        collaborators: rows,
        pagination: { total, page: pageNum, limit: take },
      });
    } catch (error) {
      console.error('[UsersController] getCollaborators error:', error);
      return res.status(500).json({ error: 'Failed to fetch collaborators' });
    }
  },
  async togglePortalAccess(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user?.tenantId) return res.status(400).json({ error: 'Tenant context not found' });
      const { id } = req.params as any;
      const { enabled } = (req.body || {}) as any;
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target || target.tenantId !== user.tenantId) return res.status(404).json({ error: 'User not found' });
      const updated = await prisma.user.update({ where: { id }, data: { isActive: typeof enabled === 'boolean' ? enabled : !target.isActive } });
      try {
        await database.createAuditLog({
          userId: user.id,
          tenantId: user.tenantId,
          tableName: 'users',
          recordId: target.id,
          operation: 'UPDATE',
          oldData: { isActive: target.isActive },
          newData: { isActive: updated.isActive },
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch (_) { }
      res.json({ id: updated.id, isActive: updated.isActive });
    } catch (error) {
      return res.status(400).json({ error: 'Failed to update portal access' });
    }
  }
};
