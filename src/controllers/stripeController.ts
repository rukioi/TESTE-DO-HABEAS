import { Response, Request } from 'express';
import Stripe from 'stripe';
import { TenantRequest } from '../types';
import { prisma, database, TenantDatabase } from '../config/database';
import { transactionsService } from '../services/transactionsService';


class StripeController {
  private async getOrCreatePlanByStripePriceId(stripeClient: Stripe, priceId: string) {
    try {
      const price = await stripeClient.prices.retrieve(String(priceId));
      const prodId = (price.product as string) || null;
      let name = 'subscription';
      if (prodId) {
        try {
          const product = await stripeClient.products.retrieve(prodId);
          name = product?.name || name;
        } catch { }
      }
      const plan = await prisma.plan.upsert({
        where: { stripePriceId: String(priceId) },
        update: { name },
        create: {
          name,
          stripePriceId: String(priceId),
          maxUsers: 5
        }
      });
      return plan;
    } catch {
      return null;
    }
  }
  private async getStripeForTenant(tenantId?: string) {
    if (!tenantId) return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: null as any });
    const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
    const key = cfg?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
    return new Stripe(key, { apiVersion: null as any });
  }

  async listPlans(req: Request, res: Response) {
    try {
      const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
      res.json({ plans });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list plans' });
    }
  }

  private async syncTenantPlanByPriceId(tenantId: string, priceId?: string | null) {
    if (!priceId) return;
    const plan = await prisma.plan.findUnique({ where: { stripePriceId: String(priceId) } });
    if (!plan) return;
    const updateData: any = { planId: plan.id, planType: plan.name };
    if (typeof plan.maxUsers === 'number' && plan.maxUsers > 0) {
      updateData.maxUsers = plan.maxUsers;
    }
    if (typeof plan.maxStorageGB === 'number' && plan.maxStorageGB > 0) {
      const bytes = BigInt(plan.maxStorageGB) * BigInt(1024) * BigInt(1024) * BigInt(1024);
      updateData.maxStorage = bytes;
    }
    await prisma.tenant.update({ where: { id: tenantId }, data: updateData });
  }

  private async upsertStripeSettings(tenantId: string, patch: any) {
    const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
    const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
    const next = { ...settings, stripe: { ...(settings?.stripe || {}), ...patch } };
    await prisma.tenantApiConfig.upsert({
      where: { tenantId },
      update: { settings: next, updatedAt: new Date() },
      create: { tenantId, settings: next, isActive: true }
    });
    return next;
  }
  private getPlatformStripe() {
    return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: null as any });
  }
  async connectCreateAccount(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = req.user.tenantId;
      const returnUrl = (req.body?.returnUrl || `${process.env.PUBLIC_URL || 'http://localhost:5173'}/configuracoes?tab=stripe`).toString();
      const refreshUrl = (req.body?.refreshUrl || returnUrl).toString();
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      let accountId = settings?.stripe?.connectAccountId || '';
      const stripe = this.getPlatformStripe();
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_type: 'company',
          metadata: { tenantId }
        });
        accountId = account.id;
        await this.upsertStripeSettings(tenantId, { connectAccountId: accountId });
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      });
      res.json({ accountId, url: link.url });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create/connect Stripe account', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async connectLoginLink(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = req.user.tenantId;
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const accountId = settings?.stripe?.connectAccountId || '';
      if (!accountId) return res.status(404).json({ error: 'Stripe Connect account not found for tenant' });
      const stripe = this.getPlatformStripe();
      const login = await stripe.accounts.createLoginLink(accountId);
      res.json({ url: login.url });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create login link', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  async createCheckoutSession(req: TenantRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const priceId = (req.body?.priceId || '').toString();
      const quantity = Number(req.body?.quantity || 1);
      const successUrl = (req.body?.successUrl || process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/?checkout=success').toString();
      const cancelUrl = (req.body?.cancelUrl || process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/?checkout=cancel').toString();

      const stripeClient = await this.getStripeForTenant(req.user.tenantId);
      if (!(stripeClient as any)?._apiKey) {
        return res.status(500).json({ error: 'Stripe not configured' });
      }
      if (!priceId) {
        return res.status(400).json({ error: 'priceId is required' });
      }

      const session = await stripeClient.checkout.sessions.create({
        mode: 'subscription',
        line_items: [ { price: priceId, quantity } ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: req.user.email,
        metadata: { userId: req.user.id, tenantId: req.user.tenantId || '', priceId },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create checkout session', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async createSubscription(req: TenantRequest, res: Response) {
    try {

      if (!req.user || !req.user.tenantId) return res.status(401).json({ error: 'Authentication required' });
      const planId = (req.body?.planId || '').toString();
      let priceId = (req.body?.priceId || '').toString();
      const successUrl = (req.body?.successUrl || process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/?checkout=success').toString();
      const cancelUrl = (req.body?.cancelUrl || process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/?checkout=cancel').toString();
      if (!priceId) {
        if (!planId) return res.status(400).json({ error: 'planId is required' });
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        priceId = plan.stripePriceId;
      }

      const stripeClient = await this.getStripeForTenant(req.user.tenantId);
      const session = await stripeClient.checkout.sessions.create({
        mode: 'subscription',
        line_items: [ { price: priceId, quantity: 1 } ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: req.user.email,
        metadata: { tenantId: req.user.tenantId, userId: req.user.id, priceId, planId }
      });

      await this.upsertStripeSettings(req.user.tenantId, { lastCheckoutSessionId: session.id, priceId, planId });
      res.json({ checkoutSessionId: session.id, url: session.url });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create subscription', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async cancelSubscription(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = req.user.tenantId;
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const subscriptionId = (req.body?.subscriptionId || settings?.stripe?.subscriptionId || '').toString();
      if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId not found for tenant' });
      const stripeClient = await this.getStripeForTenant(tenantId);
      const canceled = await stripeClient.subscriptions.cancel(subscriptionId);
      await this.upsertStripeSettings(tenantId, { subscriptionId: canceled.id, status: canceled.status, canceledAt: new Date().toISOString() });
      await prisma.tenant.update({ where: { id: tenantId }, data: { planExpiresAt: new Date(canceled.current_period_end * 1000) } });
      res.json({ canceled: true, status: canceled.status, currentPeriodEnd: canceled.current_period_end });
    } catch (error) {
      res.status(400).json({ error: 'Failed to cancel subscription', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async createBillingPortalSession(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = req.user.tenantId;
      const returnUrl = (req.body?.returnUrl || process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:5173/configuracoes').toString();
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      let customerId = settings?.stripe?.customerId || '';
      if (!customerId) {
        const lastSub = await prisma.subscription.findFirst({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
        customerId = (lastSub?.stripeCustomerId || '') as string;
      }
      if (!customerId) return res.status(404).json({ error: 'Stripe customer not found for tenant' });
      const stripeClient = await this.getStripeForTenant(tenantId);
      const session = await stripeClient.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
      res.json({ id: session.id, url: session.url });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create portal session', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async changePlan(req: TenantRequest, res: Response) {
    try {
      if (!req.user || !req.user.tenantId) return res.status(401).json({ error: 'Authentication required' });
      const tenantId = req.user.tenantId;
      const planId = (req.body?.planId || '').toString();
      const prorationBehaviorReq = (req.body?.prorationBehavior || 'create_prorations').toString() as any;
      if (!planId) return res.status(400).json({ error: 'planId is required' });

      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      const newPriceId = plan.stripePriceId;

      const stripeClient = await this.getStripeForTenant(tenantId);
      const currentSubRow = await prisma.subscription.findFirst({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
      const currentSubId = currentSubRow?.stripeSubscriptionId || null;
      if (!currentSubId) return res.status(404).json({ error: 'Active subscription not found' });

      const currentSub = await stripeClient.subscriptions.retrieve(String(currentSubId));
      const itemId = currentSub?.items?.data?.[ 0 ]?.id;
      if (!itemId) return res.status(400).json({ error: 'Subscription item not found' });

      let currentPlanPrice: number | null = null;
      const currentStripePriceId = currentSub?.items?.data?.[ 0 ]?.price?.id || null;
      if (currentStripePriceId) {
        const currentPlan = await prisma.plan.findUnique({ where: { stripePriceId: String(currentStripePriceId) } });
        if (currentPlan?.price) currentPlanPrice = Number(currentPlan.price);
      }
      const newPlanPrice = plan.price ? Number(plan.price) : null;

      const isDowngrade = currentPlanPrice != null && newPlanPrice != null ? newPlanPrice < currentPlanPrice : false;
      const lockDays = Number(process.env.PLAN_DOWNGRADE_LOCK_DAYS || 3);
      const minIntervalDays = Number(process.env.PLAN_MIN_CHANGE_INTERVAL_DAYS || 0);
      const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } });
      const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
      const lastChangeAtISO = settings?.stripe?.lastPlanChangeAt || null;
      let tooSoon = false;
      if (lastChangeAtISO && minIntervalDays > 0) {
        const lastChangeAt = new Date(String(lastChangeAtISO)).getTime();
        const diffDays = (Date.now() - lastChangeAt) / (1000 * 60 * 60 * 24);
        tooSoon = diffDays < minIntervalDays;
      }
      if (tooSoon) return res.status(429).json({ error: 'Plan change too frequent' });

      const periodEndMs = currentSub.current_period_end ? currentSub.current_period_end * 1000 : Date.now();
      const daysToEnd = (periodEndMs - Date.now()) / (1000 * 60 * 60 * 24);
      if (isDowngrade && daysToEnd <= lockDays) {
        await this.upsertStripeSettings(tenantId, {
          pendingPlanId: plan.id,
          pendingPriceId: newPriceId,
          pendingPlanChangeScheduledFor: new Date(periodEndMs).toISOString()
        });
        return res.status(202).json({ scheduled: true, effectiveAt: new Date(periodEndMs).toISOString() });
      }

      const proration_behavior = isDowngrade ? 'none' : prorationBehaviorReq;
      const updated = await stripeClient.subscriptions.update(currentSub.id, {
        items: [ { id: itemId, price: newPriceId } ],
        proration_behavior,
        cancel_at_period_end: false
      });

      await this.upsertStripeSettings(tenantId, { subscriptionId: updated.id, status: updated.status, priceId: newPriceId, currentPeriodEnd: updated.current_period_end, lastPlanChangeAt: new Date().toISOString(), pendingPlanId: null, pendingPriceId: null, pendingPlanChangeScheduledFor: null });
      await this.syncTenantPlanByPriceId(tenantId, newPriceId);

      const stripePriceId = updated.items?.data?.[ 0 ]?.price?.id || null;
      await prisma.subscription.upsert({
        where: { stripeSubscriptionId: updated.id },
        update: {
          tenantId,
          planId: plan.id,
          status: updated.status,
          stripePriceId: stripePriceId || null,
          currentPeriodStart: updated.current_period_start ? new Date(updated.current_period_start * 1000) : null,
          currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000) : null,
          cancelAtPeriodEnd: !!updated.cancel_at_period_end,
        },
        create: {
          tenantId,
          planId: plan.id,
          status: updated.status,
          stripeSubscriptionId: updated.id,
          stripePriceId: stripePriceId || null,
          currentPeriodStart: updated.current_period_start ? new Date(updated.current_period_start * 1000) : null,
          currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000) : null,
          cancelAtPeriodEnd: !!updated.cancel_at_period_end,
        }
      });

      res.json({ changed: true, subscriptionId: updated.id, status: updated.status });
    } catch (error) {
      res.status(400).json({ error: 'Failed to change plan', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async webhook(req: Request, res: Response) {
    try {
      const sig = req.headers[ 'stripe-signature' ];
      if (!sig || typeof sig !== 'string') return res.status(400).send('Missing stripe-signature header');
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: null as any });
      if (!process.env.STRIPE_WEBHOOK_SECRET || !(stripeClient as any)) {
        res.status(500).send('Stripe not configured')
        return
      };

      let event: Stripe.Event;
      try { event = stripeClient.webhooks.constructEvent(req.body as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET); }
      catch (err) { return res.status(400).send(`Webhook Error: ${(err as any)?.message || 'invalid signature'}`); }

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const tenantId = (session.metadata as any)?.tenantId || null;
          const planIdFromMeta = (session.metadata as any)?.planId || null;
          if (session.mode === 'payment') {
            try {
              const invId = (session.metadata as any)?.invoiceId || null;
              const invNumber = (session.metadata as any)?.invoiceNumber || null;
              const targetTenantId = tenantId || null;
              if (targetTenantId && invId) {
                const tenant = await database.getTenantById(targetTenantId);
                if (tenant) {
                  const tenantDB = new TenantDatabase(targetTenantId, (tenant as any).schemaName);
                  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as any)?.id || null;
                  const dateISO = new Date().toISOString().split('T')[ 0 ];
                  await (await import('../services/invoicesService')).invoicesService.updateInvoice(tenantDB, invId, {
                    paymentStatus: 'paid',
                    paymentMethod: 'CREDIT_CARD',
                    paymentDate: dateISO,
                    status: 'paid',
                    stripePaymentIntentId: paymentIntentId || undefined
                  } as any);
                  try {
                    await prisma.systemLog.create({ data: { tenantId: targetTenantId, level: 'info', message: 'STRIPE_CHECKOUT_PAYMENT_COMPLETED', metadata: { sessionId: session.id, invoiceId: invId, invoiceNumber: invNumber, paymentIntentId: paymentIntentId } } });
                  } catch { }
                }
              }
            } catch { }
            break;
          }
          try {
            const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id || null;
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
            await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_CHECKOUT_SESSION_COMPLETED', metadata: { sessionId: session.id, customerId, subscriptionId, planIdFromMeta } } });
          } catch { }
          if (tenantId && session.subscription) {
            try {
              const sub = await stripeClient.subscriptions.retrieve(session.subscription as string);
              if (session.customer) {
                await stripeClient.customers.update(session.customer as string, { metadata: { tenantId } });
              }
              await stripeClient.subscriptions.update(sub.id, { metadata: { tenantId } });
              const productId = sub.items?.data?.[ 0 ]?.price?.product as string | undefined;
              let planName = 'subscription';
              if (productId) {
                const product = await stripeClient.products.retrieve(productId);
                planName = product.name || planName;
              }
              await this.upsertStripeSettings(tenantId, {
                customerId: session.customer as string,
                subscriptionId: sub.id,
                status: sub.status,
                priceId: sub.items?.data?.[ 0 ]?.price?.id,
                productId,
                currentPeriodEnd: sub.current_period_end
              });
              const stripePriceId = sub.items?.data?.[ 0 ]?.price?.id || null;
              let planIdToPersist = planIdFromMeta as string | null;
              if (!planIdToPersist && stripePriceId) {
                const plan = await prisma.plan.findUnique({ where: { stripePriceId: String(stripePriceId) } });
                planIdToPersist = plan?.id || null;
                if (!planIdToPersist) {
                  const ensured = await this.getOrCreatePlanByStripePriceId(stripeClient, String(stripePriceId));
                  planIdToPersist = ensured?.id || null;
                }
              }
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_SUBSCRIPTION_UPSERT_ATTEMPT', metadata: { stripeSubscriptionId: sub.id, stripePriceId, planId: planIdToPersist } } });
              } catch { }
              if (planIdToPersist) {
                await prisma.subscription.upsert({
                  where: { stripeSubscriptionId: sub.id },
                  update: {
                    tenantId,
                    planId: planIdToPersist,
                    status: sub.status,
                    stripeCustomerId: (session.customer as string) || null,
                    stripePriceId: stripePriceId || null,
                    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
                    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
                    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
                    metadata: { session: JSON.stringify(session) }
                  },
                  create: {
                    tenantId,
                    planId: planIdToPersist,
                    status: sub.status,
                    stripeCustomerId: (session.customer as string) || null,
                    stripeSubscriptionId: sub.id,
                    stripePriceId: stripePriceId || null,
                    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
                    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
                    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
                    metadata: { session: JSON.stringify(session) }
                  }
                });
              }
              await prisma.tenant.update({ where: { id: tenantId }, data: { planType: planName, planExpiresAt: new Date(sub.current_period_end * 1000), isActive: true } });
              await this.syncTenantPlanByPriceId(tenantId, sub.items?.data?.[ 0 ]?.price?.id);
            } catch (e) {
              console.log(e)
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'error', message: 'STRIPE_CHECKOUT_COMPLETED_ERROR', metadata: { error: (e as any)?.message || String(e) } } });
              } catch { }
            }
          }
          break;
        }
        case 'payment_intent.succeeded': {
          try {
            const intent = event.data.object as Stripe.PaymentIntent;
            const tenantId = (intent.metadata as any)?.tenantId || null;
            const invId = (intent.metadata as any)?.invoiceId || null;
            const invNumber = (intent.metadata as any)?.invoiceNumber || null;
            if (tenantId && invId) {
              const tenant = await database.getTenantById(tenantId);
              if (tenant) {
                const tenantDB = new TenantDatabase(tenantId, (tenant as any).schemaName);
                const dateISO = new Date().toISOString().split('T')[ 0 ];
                const method = intent.payment_method_types?.[ 0 ] === 'boleto' ? 'BOLETO' : 'CREDIT_CARD';
                await (await import('../services/invoicesService')).invoicesService.updateInvoice(tenantDB, invId, {
                  paymentStatus: 'paid',
                  paymentMethod: method,
                  paymentDate: dateISO,
                  status: 'paid',
                  stripePaymentIntentId: intent.id
                } as any);
                try {
                  await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_PAYMENT_INTENT_SUCCEEDED', metadata: { invoiceId: invId, invoiceNumber: invNumber, paymentIntentId: intent.id } } });
                } catch { }
              }
            }
          } catch { }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const tenantId = (sub.metadata as any)?.tenantId || null;
          const stripePriceId = sub.items?.data?.[ 0 ]?.price?.id || null;
          let planIdToPersist: string | null = null;
          if (stripePriceId) {
            const plan = await prisma.plan.findUnique({ where: { stripePriceId: String(stripePriceId) } });
            planIdToPersist = plan?.id || null;
            if (!planIdToPersist) {
              const ensured = await this.getOrCreatePlanByStripePriceId(stripeClient, String(stripePriceId));
              planIdToPersist = ensured?.id || null;
            }
          }
          if (tenantId) {
            try {
              // @ts-expect-error expected error
              await this.upsertStripeSettings(tenantId, { subscriptionId: sub.id, status: sub.status, currentPeriodEnd: sub.items.data[ 0 ].current_period_end });
              const isActive = sub.status === 'active' || sub.status === 'trialing';
              // @ts-expect-error expected error
              await prisma.tenant.update({ where: { id: tenantId }, data: { planExpiresAt: sub.items.data[ 0 ].current_period_end ? new Date(sub.items.data[ 0 ].current_period_end * 1000) : undefined, isActive } });
              await this.syncTenantPlanByPriceId(tenantId, sub.items?.data?.[ 0 ]?.price?.id);
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_SUBSCRIPTION_EVENT', metadata: { eventType: event.type, stripeSubscriptionId: sub.id, stripePriceId, planId: planIdToPersist } } });
              } catch { }
              if (planIdToPersist) {
                await prisma.subscription.upsert({
                  where: { stripeSubscriptionId: sub.id },
                  update: {
                    tenantId,
                    planId: planIdToPersist,
                    status: sub.status,
                    stripePriceId: stripePriceId || null,
                    // @ts-expect-error expected error
                    currentPeriodStart: sub.items.data[ 0 ].current_period_start ? new Date(sub.items.data[ 0 ].current_period_start * 1000) : null,
                    // @ts-expect-error expected error
                    currentPeriodEnd: sub.items.data[ 0 ].current_period_end ? new Date(sub.items.data[ 0 ].current_period_end * 1000) : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                  },
                  create: {
                    tenantId,
                    planId: planIdToPersist,
                    status: sub.status,
                    stripeSubscriptionId: sub.id,
                    stripePriceId: stripePriceId || null,
                    // @ts-expect-error expected error
                    currentPeriodStart: sub.items.data[ 0 ].current_period_start ? new Date(sub.items.data[ 0 ].current_period_start * 1000) : null,
                    // @ts-expect-error expected error
                    currentPeriodEnd: sub.items.data[ 0 ].current_period_end ? new Date(sub.items.data[ 0 ].current_period_end * 1000) : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                  }
                });
              }
            } catch (e) {
              console.log(e)
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'error', message: 'STRIPE_SUBSCRIPTION_EVENT_ERROR', metadata: { eventType: event.type, error: (e as any)?.message || String(e) } } });
              } catch { }
            }
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          let mappedTenantId: string | null = null;
          try {
            if (invoice.customer) {
              const customer = await stripeClient.customers.retrieve(invoice.customer as string);
              mappedTenantId = (customer as any)?.metadata?.tenantId || null;
            }
          } catch { }
          const targetTenantId = mappedTenantId || (invoice.metadata as any)?.tenantId || null;
          if (targetTenantId) {
            try {
              await this.upsertStripeSettings(targetTenantId, { lastInvoiceId: invoice.id });
              const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: targetTenantId } });
              const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {};
              const pendingPlanId = settings?.stripe?.pendingPlanId || null;
              const pendingPriceId = settings?.stripe?.pendingPriceId || null;
              if (pendingPlanId && pendingPriceId) {
                let subscriptionId: string | null = settings?.stripe?.subscriptionId || null;
                if (!subscriptionId) {
                  const subRow = await prisma.subscription.findFirst({ where: { tenantId: targetTenantId }, orderBy: { updatedAt: 'desc' } });
                  subscriptionId = subRow?.stripeSubscriptionId || null;
                }
                if (subscriptionId) {
                  const currentSub = await stripeClient.subscriptions.retrieve(String(subscriptionId));
                  const itemId = currentSub?.items?.data?.[ 0 ]?.id;
                  if (itemId) {
                    const updated = await stripeClient.subscriptions.update(currentSub.id, { items: [ { id: itemId, price: String(pendingPriceId) } ], proration_behavior: 'none' } as any);
                    await this.upsertStripeSettings(targetTenantId, { subscriptionId: updated.id, status: updated.status, priceId: pendingPriceId, lastPlanChangeAt: new Date().toISOString(), pendingPlanId: null, pendingPriceId: null, pendingPlanChangeScheduledFor: null });
                    await this.syncTenantPlanByPriceId(targetTenantId, pendingPriceId);
                    const plan = await prisma.plan.findUnique({ where: { id: String(pendingPlanId) } });
                    const stripePriceId = updated.items?.data?.[ 0 ]?.price?.id || null;
                    if (plan) {
                      await prisma.subscription.upsert({
                        where: { stripeSubscriptionId: updated.id },
                        update: {
                          tenantId: targetTenantId,
                          planId: plan.id,
                          status: updated.status,
                          stripePriceId: stripePriceId || null,
                          currentPeriodStart: updated.current_period_start ? new Date(updated.current_period_start * 1000) : null,
                          currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000) : null,
                          cancelAtPeriodEnd: !!updated.cancel_at_period_end,
                        },
                        create: {
                          tenantId: targetTenantId,
                          planId: plan.id,
                          status: updated.status,
                          stripeSubscriptionId: updated.id,
                          stripePriceId: stripePriceId || null,
                          currentPeriodStart: updated.current_period_start ? new Date(updated.current_period_start * 1000) : null,
                          currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000) : null,
                          cancelAtPeriodEnd: !!updated.cancel_at_period_end,
                        }
                      });
                    }
                  }
                }
              }
              const tenant = await database.getTenantById(targetTenantId);
              if (tenant) {
                const tenantDB = new TenantDatabase(targetTenantId, (tenant as any).schemaName);
                const amount = (invoice.amount_paid || invoice.amount_due || 0) / 100;
                const date = new Date((invoice.status_transitions?.paid_at || Date.now()));
                await transactionsService.createTransaction(tenantDB, {
                  type: 'income',
                  amount,
                  categoryId: 'subscription',
                  category: 'Subscription',
                  description: `Stripe invoice ${invoice.number || invoice.id}`,
                  date: date.toISOString().slice(0, 10),
                  paymentMethod: 'CREDIT_CARD',
                  status: 'confirmed',
                  tags: [ 'stripe', 'subscription' ],
                } as any, 'system');
              }
            } catch { }
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          let mappedTenantId: string | null = null;
          try {
            if (invoice.customer) {
              const customer = await stripeClient.customers.retrieve(invoice.customer as string);
              mappedTenantId = (customer as any)?.metadata?.tenantId || null;
            }
          } catch { }
          const targetTenantId = mappedTenantId || (invoice.metadata as any)?.tenantId || null;
          if (targetTenantId) {
            try {
              await this.upsertStripeSettings(targetTenantId, { lastInvoiceId: invoice.id, lastFailedAt: new Date().toISOString() });
              await prisma.systemLog.create({ data: { tenantId: targetTenantId, level: 'warn', message: 'STRIPE_PAYMENT_FAILED', metadata: { invoiceId: invoice.id } } });
            } catch { }
          }
          break;
        }
        default:
          break;
      }

      res.json({ received: true });
    } catch (error) {
      res.status(400).send('Webhook handling failed');
    }
  }
}

export const stripeController = new StripeController();
