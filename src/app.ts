import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Carrega .env da raiz do projeto (importante para npm run dev)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import clientsRoutes from './routes/clients';
import dealsRoutes from './routes/deals';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import transactionsRoutes from './routes/transactions';
import invoicesRoutes from './routes/invoices';
import estimatesRoutes from './routes/estimates';
import publicationsRoutes from './routes/publications';
import settingsRoutes from './routes/settings';
import adminRoutes from './routes/admin';
import adminApiConfigRoutes from './routes/adminApiConfig';
import notificationsRoutes from './routes/notifications';
import adminAuthRoutes from './routes/adminAuth';
import usersRoutes from './routes/users';
import emailsRoutes from './routes/emails';
import stripeRoutes from './routes/stripe';
import receivablesRoutes from './routes/receivables';
import evolutionRoutes from './routes/evolution';
import { stripeController } from './controllers/stripeController';
import { publicationsController } from './controllers/publicationsController';
import reportsRoutes from './routes/reports';

export function createApp() {
  const app = express();

  // Basic middleware
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => stripeController.webhook(req, res));
  app.post('/api/judit/webhook', express.json({ limit: '5mb' }), (req, res) => publicationsController.juditWebhook(req as any, res));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API routes - Order matters! Most specific routes first
  app.use('/api/admin/auth', adminAuthRoutes);
  app.use('/api/admin/api-configs', adminApiConfigRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/deals', dealsRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/publications', publicationsRoutes);
  app.use('/api/stripe', stripeRoutes);
  app.use('/api/receivables', receivablesRoutes);
  app.use('/api/evolution', evolutionRoutes);
  app.use('/api/reports', reportsRoutes);

  app.use('/api/estimates', estimatesRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/emails', emailsRoutes);

  // Debug route registration
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      console.log('📍 Route:', middleware.route.path);
    } else if (middleware.name === 'router') {
      console.log('📍 Router middleware found at:', middleware.regexp);
    }
  });

  console.log('🔧 All API routes registered successfully');
  if (process.env.ENABLE_LOCAL_CRON === 'true') {
    console.log("Caiu aqui")
    const { runReceivablesReminder } = require('./services/receivablesReminderService');
    const { receivablesJobsController } = require('./controllers/receivablesJobsController');
    const schedule = () => {
      const now = new Date();
      const isNineAM = now.getHours() === 9;
      if (isNineAM) {
        runReceivablesReminder(3).catch(() => void 0);
      }
    };
    setInterval(schedule, 60 * 60 * 1000);
    console.log('⏰ Local cron enabled: receivables reminder will run hourly and trigger at 09:00');
    const runEveryMinute = async () => {
      try {
        await receivablesJobsController.runScheduler({ headers: {} } as any, { json: () => void 0, status: () => ({ json: () => void 0 }) } as any);
      } catch { }
    };
    setInterval(runEveryMinute, 60 * 1000);
    console.log('⏰ Local scheduler enabled: scheduled notifications processed every minute');
  }

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    const spaPath = path.join(__dirname, '../spa');
    app.use(express.static(spaPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(spaPath, 'index.html'));
    });
  }

  // Error handler
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
