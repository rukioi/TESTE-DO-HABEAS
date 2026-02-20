/**
 * PROJECTS CONTROLLER - Gestão de Projetos/Casos
 * ================================================
 * 
 * ✅ ISOLAMENTO TENANT: Usa req.tenantDB
 * ✅ VALIDAÇÃO: Zod schema completo
 * ✅ SEM MOCK: Operações reais no banco
 * 
 * Baseado no padrão do clientsController.ts
 */

import { Response } from 'express';
import { z } from 'zod';
import { TenantRequest } from '../types';
import { projectsService } from '../services/projectsService';
import { database } from '../config/database';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createProjectSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  clientId: z.string().uuid('Se fornecido, o ID do cliente deve ser um UUID válido').optional(),
  clientName: z.string().min(1, 'O nome do cliente é obrigatório'),
  organization: z.string().optional(),
  address: z.string().optional(),
  budget: z.number().min(0).optional(),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  status: z.enum(['contacted', 'proposal', 'won', 'lost']).default('contacted'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  progress: z.number().min(0).max(100).default(0),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  dueDate: z.string().min(1, 'Data de vencimento é obrigatória'),
  tags: z.array(z.string()).default([]),
  assignedTo: z.array(z.string()).default([]),
  notes: z.string().optional(),
  contacts: z.array(z.any()).default([]),
});

const updateProjectSchema = createProjectSchema.partial();

// ============================================================================
// CONTROLLER CLASS
// ============================================================================

export class ProjectsController {
  /**
   * GET /api/projects
   * Lista todos os projetos do tenant com filtros e paginação
   */
  async getProjects(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      console.log('[ProjectsController] Fetching projects for tenant:', req.tenant?.id);

      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        status: req.query.status as string,
        priority: req.query.priority as string,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined
      };

      const result = await projectsService.getProjects(req.tenantDB, filters);
      
      console.log('[ProjectsController] Projects fetched:', {
        count: result.projects.length,
        total: result.pagination.total
      });

      res.json(result);
    } catch (error) {
      console.error('[ProjectsController] Get projects error:', error);
      res.status(500).json({
        error: 'Failed to fetch projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/projects/stats
   * Retorna estatísticas dos projetos
   */
  async getProjectsStats(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      console.log('[ProjectsController] Fetching project stats for tenant:', req.tenant?.id);

      const stats = await projectsService.getProjectsStats(req.tenantDB);
      
      console.log('[ProjectsController] Stats fetched:', stats);

      res.json(stats);
    } catch (error) {
      console.error('[ProjectsController] Get stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch project statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/projects/:id
   * Busca um projeto específico por ID
   */
  async getProject(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      
      console.log('[ProjectsController] Fetching project:', id);

      const project = await projectsService.getProjectById(req.tenantDB, id);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      console.log('[ProjectsController] Project fetched:', project.id);

      res.json({ project });
    } catch (error) {
      console.error('[ProjectsController] Get project error:', error);
      res.status(500).json({
        error: 'Failed to fetch project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/projects
   * Cria novo projeto
   */
  async createProject(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = createProjectSchema.parse(req.body);
      
      console.log('[ProjectsController] Creating project for user:', req.user.id);

      const project = await projectsService.createProject(
        req.tenantDB,
        // @ts-expect-error - accountType é opcional no schema, mas é necessário para criação
        validatedData,
        req.user.id
      );
      
      console.log('[ProjectsController] Project created:', project.id);

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'projects',
          recordId: project.id,
          operation: 'create',
          oldData: null,
          newData: project,
          ipAddress: (req.headers['x-forwarded-for'] as string) || (req.ip as any) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        });
      } catch {}

      res.status(201).json({
        message: 'Project created successfully',
        project
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      }

      console.error('[ProjectsController] Create project error:', error);
      res.status(400).json({
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/projects/:id
   * Atualiza projeto existente
   */
  async updateProject(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const validatedData = updateProjectSchema.parse(req.body);
      
      console.log('[ProjectsController] Updating project:', id);

      const oldProject = await projectsService.getProjectById(req.tenantDB, id);
      const project = await projectsService.updateProject(req.tenantDB, id, validatedData);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      console.log('[ProjectsController] Project updated:', project.id);

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'projects',
          recordId: project.id,
          operation: 'update',
          oldData: oldProject || null,
          newData: project,
          ipAddress: (req.headers['x-forwarded-for'] as string) || (req.ip as any) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        });
      } catch {}

      res.json({
        message: 'Project updated successfully',
        project
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      }

      console.error('[ProjectsController] Update project error:', error);
      res.status(400).json({
        error: 'Failed to update project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/projects/:id
   * Deleta projeto (soft delete)
   */
  async deleteProject(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.tenantDB) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      
      console.log('[ProjectsController] Deleting project:', id);

      const oldProject = await projectsService.getProjectById(req.tenantDB, id);
      const success = await projectsService.deleteProject(req.tenantDB, id);
      
      if (!success) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      console.log('[ProjectsController] Project deleted:', id);

      try {
        await database.createAuditLog({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          tableName: 'projects',
          recordId: id,
          operation: 'delete',
          oldData: oldProject || null,
          newData: { is_active: false },
          ipAddress: (req.headers['x-forwarded-for'] as string) || (req.ip as any) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        });
      } catch {}

      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      console.error('[ProjectsController] Delete project error:', error);
      res.status(400).json({
        error: 'Failed to delete project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async listProjectAttachments(req: TenantRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Storage not configured' });
      }
      const tenantId = req.user.tenantId as string;
      const projectId = req.params.id;
      const supabase = createClient(supabaseUrl, serviceKey);
      const bucket = 'project-attachments';
      let isPublic = false;
      try {
        const check = await supabase.storage.getBucket(bucket);
        isPublic = !!check.data?.public;
        if (check.error) {
          await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: [ 'image/png', 'image/jpeg', 'image/jpg', 'application/pdf' ] });
          isPublic = false;
        }
      } catch { }
      const basePath = `tenants/${tenantId}/projects/${projectId}/attachments`;
      const { data: files, error } = await supabase.storage.from(bucket).list(basePath, { limit: 100 });
      if (error) {
        return res.status(500).json({ error: 'Failed to list attachments' });
      }
      const attachments = await Promise.all((files || []).map(async (f) => {
        const fullPath = `${basePath}/${f.name}`;
        let url: string | undefined = undefined;
        if (isPublic) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
          url = data?.publicUrl;
        } else {
          const { data } = await supabase.storage.from(bucket).createSignedUrl(fullPath, 3600);
          url = data?.signedUrl;
        }
        return { name: f.name, url, updatedAt: f.updated_at };
      }));
      res.json({ attachments });
    } catch (error) {
      console.error('[ProjectsController] List attachments error:', error);
      res.status(500).json({ error: 'Failed to list attachments' });
    }
  }

  async uploadProjectAttachments(req: TenantRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Storage not configured' });
      }
      const tenant = await database.getTenantById(req.user.tenantId as string);
      const planType = String(tenant?.planType || '').toLowerCase();
      let maxFiles = Number.POSITIVE_INFINITY;
      if (planType.includes('basic') || planType.includes('básico')) maxFiles = 1;
      else if (planType.includes('inter')) maxFiles = 2;
      const supabase = createClient(supabaseUrl, serviceKey);
      const bucket = 'project-attachments';
      try {
        const check = await supabase.storage.getBucket(bucket);
        if (check.error) {
          await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: [ 'image/png', 'image/jpeg', 'image/jpg', 'application/pdf' ] });
        }
      } catch { }
      const tenantId = req.user.tenantId as string;
      const projectId = req.params.id;
      const basePath = `tenants/${tenantId}/projects/${projectId}/attachments`;
      const existingList = await supabase.storage.from(bucket).list(basePath, { limit: 100 });
      const existingCount = (existingList.data || []).length;
      const files = (req as any).files as Array<Express.Multer.File>;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }
      if (Number.isFinite(maxFiles) && existingCount + files.length > maxFiles) {
        return res.status(403).json({ error: 'File limit exceeded for current plan', code: 'PLAN_FILE_LIMIT_EXCEEDED', limit: maxFiles });
      }
      const uploaded: Array<{ name: string; url?: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const original = file.originalname || `file_${Date.now()}_${i}`;
        const cleanName = original.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${basePath}/${Date.now()}_${i}_${cleanName}`;
        const up = await supabase.storage.from(bucket).upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
        if (!up.error) {
          const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
          uploaded.push({ name: cleanName, url: data?.signedUrl });
        }
      }
      res.status(201).json({ uploaded });
    } catch (error) {
      console.error('[ProjectsController] Upload attachments error:', error);
      res.status(400).json({ error: 'Failed to upload attachments' });
    }
  }

  async deleteProjectAttachments(req: TenantRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Storage not configured' });
      }
      const files = Array.isArray(req.body?.files) ? (req.body.files as string[]) : [];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for deletion' });
      }
      const supabase = createClient(supabaseUrl, serviceKey);
      const bucket = 'project-attachments';
      try {
        const check = await supabase.storage.getBucket(bucket);
        if (check.error) {
          await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: [ 'image/png', 'image/jpeg', 'image/jpg', 'application/pdf' ] });
        }
      } catch { }
      const tenantId = req.user.tenantId as string;
      const projectId = req.params.id;
      const basePath = `tenants/${tenantId}/projects/${projectId}/attachments`;
      const paths = files.map((name) => `${basePath}/${String(name).replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) {
        return res.status(500).json({ error: 'Failed to delete attachments' });
      }
      res.json({ removed: files });
    } catch (error) {
      console.error('[ProjectsController] Delete attachments error:', error);
      res.status(400).json({ error: 'Failed to delete attachments' });
    }
  }
}

export const projectsController = new ProjectsController();
