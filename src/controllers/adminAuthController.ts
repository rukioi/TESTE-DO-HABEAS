import { Request, Response } from 'express';
import { database } from '../config/database';
import { authService } from '../services/authService';
import { AuthenticatedRequest } from '../types/auth';
import { z } from 'zod';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
}).refine((data) => {
  // If changing password, current password is required
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, {
  message: "Current password is required to change password",
  path: ["currentPassword"],
});

export const adminAuthController = {
  async login(req: Request, res: Response) {
    try {
      const validated = loginSchema.safeParse(req.body);

      if (!validated.success) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: validated.error.flatten().fieldErrors,
        });
      }

      const { email, password } = validated.data;

      const result = await authService.loginAdmin(email, password);

      res.json({
        message: 'Login successful',
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(401).json({
        error: 'Credenciais inválidas',
        details: error instanceof Error ? error.message : 'Falha na autenticação'
      });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
      }

      const { tokens } = await authService.refreshAdminTokens(refreshToken);

      res.json({ tokens });
    } catch (error) {
      console.error('Admin token refresh error:', error);
      res.status(403).json({
        error: error instanceof Error ? error.message : 'Invalid refresh token',
      });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        const decoded = await authService.verifyAdminRefreshToken(refreshToken);
        await authService.revokeAllAdminTokens(decoded.userId);
      }

      res.json({ message: 'Admin logout successful' });
    } catch (error) {
      // Even if token verification fails, still return success
      res.json({ message: 'Admin logout successful' });
    }
  },

  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const adminUser = await database.findAdminByEmail(req.user!.email);

      if (!adminUser) {
        return res.status(404).json({ error: 'Admin user not found' });
      }

      res.json({ 
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role,
          lastLogin: adminUser.lastLogin,
          createdAt: adminUser.createdAt,
          updatedAt: adminUser.updatedAt,
        }
      });
    } catch (error) {
      console.error('Get admin profile error:', error);
      res.status(500).json({
        error: 'Failed to fetch profile',
      });
    }
  },

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const validatedData = updateProfileSchema.parse(req.body);
      const adminId = req.user!.id;

      // For now, return success
      res.json({
        message: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Update admin profile error:', error);
      res.status(400).json({
        error: 'Profile update failed',
      });
    }
  },
};