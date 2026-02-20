import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authService } from '../services/authService';
import { emailsService } from '../services/emailsService';
import { prisma } from '../config/database';
import { database } from '../config/database';
import { getForgotPasswordEmailHtml } from '../templates/forgotPasswordEmail';
import { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  key: z.string().min(1, 'Registration key is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  avatar: z.string().url().optional(),
  avatarDataUrl: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: 'Current password is required to change password',
  path: [ 'currentPassword' ],
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  newPassword: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: [ 'confirmPassword' ],
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {

      const validatedData = registerSchema.parse(req.body);
      console.log("🚀 ~ AuthController ~ register ~ validatedData:", validatedData)

      const { user, tokens, isNewTenant } = await authService.registerUser(
        validatedData.email,
        validatedData.password,
        validatedData.name,
        validatedData.key
      );

      console.log('Registration successful:', { userId: user.id, tenantId: user.tenantId });

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType || user.accountType,
          tenantId: user.tenantId || user.tenantId,
          tenantName: 'Default Tenant',
        },
        tokens,
        isNewTenant,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      console.log('Login attempt:', { email: req.body.email });

      const validatedData = loginSchema.parse(req.body);

      const { user, tokens } = await authService.loginUser(validatedData.email, validatedData.password);

      console.log('Login successful:', { userId: user.id, tenantId: user.tenantId });

      // Verificar se o tenant existe e está ativo
      if (user.tenantId && !user.tenant.isActive) {
        return res.status(403).json({
          error: 'Acesso negado',
          message: 'Sua conta está inativa. Entre em contato com o administrador.',
        });
      }

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          tenantId: user.tenantId,
          tenantName: 'Default Tenant',
        },
        tokens,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Login failed',
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const validatedData = refreshSchema.parse(req.body);

      const { user, tokens } = await authService.refreshTokens(validatedData.refreshToken);

      res.json({
        message: 'Tokens refreshed',
        user,
        tokens,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[ 1 ];

      if (token) {
        try {
          const decoded = await authService.verifyAccessToken(token);
          await authService.revokeAllTokens(decoded.userId, !!decoded.role);
        } catch (error) {
          console.error('Error revoking tokens during logout:', error);
        }
      }

      res.json({ message: 'Logout successful' });
    } catch (error) {
      // Even if token verification fails, return success for logout
      res.json({ message: 'Logout successful' });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    const genericMessage = 'Se o email estiver cadastrado, você receberá um link. Verifique sua caixa de entrada e o spam.';

    try {
      if (!emailsService.hasSmtpConfig()) {
        return res.status(503).json({
          error: 'Serviço de email temporariamente indisponível. Tente mais tarde.',
        });
      }

      const { email } = forgotPasswordSchema.parse(req.body);
      const baseUrl = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');

      const user = await database.findUserByEmail(email);
      if (!user || !user.isActive || !user.tenant?.isActive) {
        return res.status(200).json({
          message: genericMessage,
          sent: false,
        });
      }

      try {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await database.setUserResetToken(user.email, token, expiresAt);

        const resetLink = `${baseUrl}/redefinir-senha?token=${token}`;
        const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER || 'habeasdesk@optgrupo.com';
        const html = getForgotPasswordEmailHtml({
          userName: user.name || 'usuário',
          resetLink,
          fromEmail,
        });
        await emailsService.sendEmail({
          to: user.email,
          subject: 'Recuperação de senha - Habeas Desk',
          html,
        });
      } catch (sendError) {
        console.error('Forgot password: failed to send email', sendError);
        return res.status(503).json({
          error: 'Serviço de email temporariamente indisponível. Tente mais tarde.',
        });
      }

      return res.status(200).json({
        message: 'Email de recuperação enviado! Verifique sua caixa de entrada.',
        sent: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || 'Dados inválidos' });
      }
      console.error('Forgot password error:', error);
      return res.status(500).json({
        error: 'Erro ao processar solicitação. Tente novamente.',
      });
    }
  }

  async validateResetToken(req: Request, res: Response) {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      if (!token) {
        return res.status(400).json({ valid: false });
      }
      const user = await database.findUserByResetToken(token);
      return res.status(200).json({ valid: !!user });
    } catch (error) {
      console.error('Validate reset token error:', error);
      res.status(400).json({ valid: false });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);

      const user = await database.findUserByResetToken(token);
      if (!user) {
        return res.status(400).json({
          error: 'Link inválido ou expirado. Solicite uma nova recuperação de senha.',
        });
      }

      const hashedPassword = await authService.hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
          updatedAt: new Date(),
        },
      });

      res.status(200).json({
        message: 'Senha alterada com sucesso. Faça login com a nova senha.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const msg = error.errors[0]?.message || 'Dados inválidos';
        return res.status(400).json({ error: msg });
      }
      console.error('Reset password error:', error);
      res.status(400).json({
        error: 'Não foi possível redefinir a senha. Tente novamente ou solicite um novo link.',
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS avatar TEXT`);
      const rows: any[] = await prisma.$queryRaw(Prisma.sql`SELECT id::text AS id, email, name, account_type AS "accountType", tenant_id AS "tenantId", avatar FROM "users" WHERE id = ${userId} LIMIT 1`);
      const userRow = rows?.[ 0 ];
      const user = {
        id: userRow?.id || userId,
        email: userRow?.email || (req as any).user?.email || 'user@example.com',
        name: userRow?.name || (req as any).user?.name || 'User',
        accountType: userRow?.accountType || (req as any).user?.accountType || 'SIMPLES',
        tenantId: userRow?.tenantId || (req as any).user?.tenantId || (req as any).tenantId || 'default',
        tenantName: 'Default Tenant',
        avatar: userRow?.avatar || undefined,
      };

      let subscription: any = null;
      let subscriptionActive = false;
      const tenantId = user.tenantId;
      if (tenantId && typeof tenantId === 'string') {
        try {
          const sub = await prisma.subscription.findFirst({
            where: { tenantId },
            orderBy: { updatedAt: 'desc' },
            include: { plan: true }
          });
          if (sub) {
            subscription = {
              id: sub.id,
              status: sub.status,
              stripeCustomerId: sub.stripeCustomerId,
              stripeSubscriptionId: sub.stripeSubscriptionId,
              stripePriceId: sub.stripePriceId,
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
              plan: sub.plan ? {
                id: sub.plan.id,
                name: sub.plan.name,
                price: sub.plan.price,
                maxUsers: sub.plan.maxUsers,
                maxStorageGB: sub.plan.maxStorageGB
              } : null
            };
            subscriptionActive = sub.status === 'active' || sub.status === 'trialing';
          }
        } catch { }
      }

      res.json({ user, subscription, subscriptionActive });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
      });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validated = updateProfileSchema.parse(req.body || {});
      await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS avatar TEXT`);
      const oldRows: any[] = await prisma.$queryRaw(Prisma.sql`SELECT id::text AS id, email, name, account_type AS "accountType", tenant_id AS "tenantId", avatar FROM "users" WHERE id = ${userId} LIMIT 1`);
      const oldUser = oldRows?.[ 0 ] || null;

      let updatedUser: any = oldUser;
      if (validated.newPassword) {
        const pwRow = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
        if (!pwRow || !pwRow.password) {
          return res.status(400).json({ error: 'User password not found' });
        }
        const isValid = await authService.verifyPassword(validated.currentPassword || '', pwRow.password);
        if (!isValid) {
          return res.status(400).json({ error: 'Invalid current password' });
        }
        const hashed = await authService.hashPassword(validated.newPassword);
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { password: hashed, mustChangePassword: false, updatedAt: new Date() },
          select: { id: true, email: true, name: true, accountType: true, tenantId: true }
        });
        updatedUser = { ...updatedUser, id: String(updated.id), email: String(updated.email), name: String(updated.name), accountType: String(updated.accountType), tenantId: String(updated.tenantId) };
        try { await authService.revokeAllTokens(userId); } catch { }
      }
      if (validated.name || validated.email) {
        const updated = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(validated.name ? { name: validated.name } : {}),
            ...(validated.email ? { email: validated.email } : {}),
            updatedAt: new Date(),
          },
          select: { id: true, email: true, name: true, accountType: true, tenantId: true }
        });
        updatedUser = { ...updatedUser, id: String(updated.id), email: String(updated.email), name: String(updated.name), accountType: String(updated.accountType), tenantId: String(updated.tenantId) };
      }

      let finalAvatarUrl: string | undefined;
      const file = (req as any).file;
      if (file && file.buffer && file.mimetype) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          const supabase = createClient(supabaseUrl, serviceKey);
          const tenantId = (req as any).user?.tenantId || updatedUser?.tenantId || 'default';
          const mime = file.mimetype;
          const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
          const ext = extMap[ mime ] || (mime.split('/')[ 1 ] || 'png');
          const path = `tenants/${tenantId}/users/${userId}/avatar.${ext}`;
          try {
            const bucketCheck = await supabase.storage.getBucket('avatars');
            console.log("🚀 ~ AuthController ~ updateProfile ~ bucketCheck:", bucketCheck)
            if (bucketCheck.error) {
              await supabase.storage.createBucket('avatars', { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: [ 'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp' ] });
            }
          } catch { }
          const upload = await supabase.storage.from('avatars').upload(path, file.buffer, { contentType: mime, upsert: true });
          if (!upload.error) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(path);
            finalAvatarUrl = data?.publicUrl;
          }
        }
      }
      if (validated.avatarDataUrl && typeof validated.avatarDataUrl === 'string' && validated.avatarDataUrl.startsWith('data:')) {
        const match = validated.avatarDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          const mime = match[ 1 ];
          const b64 = match[ 2 ];
          const buffer = Buffer.from(b64, 'base64');
          const supabaseUrl = process.env.SUPABASE_URL;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && serviceKey) {
            const supabase = createClient(supabaseUrl, serviceKey);
            const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
            const ext = extMap[ mime ] || (mime.split('/')[ 1 ] || 'png');
            const path = `tenants/${(req as any).user?.tenantId || 'default'}/users/${userId}/avatar.${ext}`;
            const upload = await supabase.storage.from('avatars').upload(path, buffer, { contentType: mime, upsert: true });
            if (!upload.error) {
              const { data } = supabase.storage.from('avatars').getPublicUrl(path);
              finalAvatarUrl = data?.publicUrl;
            }
          }
        }
      }
      if (!finalAvatarUrl && validated.avatar) {
        finalAvatarUrl = validated.avatar;
      }
      if (finalAvatarUrl) {
        await prisma.$executeRaw(Prisma.sql`UPDATE "users" SET avatar = ${finalAvatarUrl}, updated_at = NOW() WHERE id = ${userId}`);
        updatedUser = { ...updatedUser, avatar: finalAvatarUrl };
      }

      const newRows: any[] = await prisma.$queryRaw(Prisma.sql`SELECT id::text AS id, email, name, account_type AS "accountType", tenant_id AS "tenantId", avatar FROM "users" WHERE id = ${userId} LIMIT 1`);
      const newUser = newRows?.[ 0 ] || updatedUser;

      try {
        await database.createAuditLog({
          userId: (req as any).user?.id,
          tenantId: (req as any).user?.tenantId,
          tableName: 'users',
          recordId: userId,
          operation: 'UPDATE',
          oldData: oldUser,
          newData: newUser,
          ipAddress: (req.headers[ 'x-forwarded-for' ] as string) || (req as any).ip || undefined,
          userAgent: (req.headers[ 'user-agent' ] as string) || undefined,
        });
      } catch { }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: newUser?.id || userId,
          email: newUser?.email,
          name: newUser?.name,
          accountType: newUser?.accountType,
          tenantId: newUser?.tenantId,
          tenantName: 'Default Tenant',
          avatar: newUser?.avatar || undefined,
        }
      });
    } catch (error) {
      console.log("🚀 ~ AuthController ~ updateProfile ~ error:", error)
      res.status(400).json({
        error: 'Failed to update profile',
      });
    }
  }
}

export const authController = new AuthController();
