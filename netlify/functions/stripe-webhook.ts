import Stripe from 'stripe'
import { prisma, database, TenantDatabase } from '../../src/config/database'
import { transactionsService } from '../../src/services/transactionsService'

async function getOrCreatePlanByStripePriceId(stripeClient: Stripe, priceId: string) {
  try {
    const price = await stripeClient.prices.retrieve(String(priceId))
    const prodId = (price.product as string) || null
    let name = 'subscription'
    if (prodId) {
      try {
        const product = await stripeClient.products.retrieve(prodId)
        name = product?.name || name
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
    })
    return plan
  } catch {
    return null
  }
}

async function syncTenantPlanByPriceId(tenantId: string, priceId?: string | null) {
  if (!priceId) return
  const plan = await prisma.plan.findUnique({ where: { stripePriceId: String(priceId) } })
  if (!plan) return
  const updateData: any = { planId: plan.id, planType: plan.name }
  if (typeof plan.maxUsers === 'number' && plan.maxUsers > 0) {
    updateData.maxUsers = plan.maxUsers
  }
  if (typeof plan.maxStorageGB === 'number' && plan.maxStorageGB > 0) {
    const bytes = BigInt(plan.maxStorageGB) * BigInt(1024) * BigInt(1024) * BigInt(1024)
    updateData.maxStorage = bytes
  }
  await prisma.tenant.update({ where: { id: tenantId }, data: updateData })
}

async function upsertStripeSettings(tenantId: string, patch: any) {
  const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId } })
  const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {}
  const next = { ...settings, stripe: { ...(settings?.stripe || {}), ...patch } }
  await prisma.tenantApiConfig.upsert({
    where: { tenantId },
    update: { settings: next, updatedAt: new Date() },
    create: { tenantId, settings: next, isActive: true }
  })
  return next
}

export const handler = async (event: any) => {
  const sig = event.headers?.[ 'stripe-signature' ] || event.headers?.[ 'Stripe-Signature' ]
  console.log("🚀 ~ handler ~ sig:", sig)
  if (!sig || typeof sig !== 'string') {
    return { statusCode: 400, body: 'Missing stripe-signature header' }
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: 'Stripe not configured' }
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

  try {
    const payload = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body
    const evt = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET as string)
    console.log("🚀 ~ handler ~ evt:", evt)

    switch (evt.type) {
      case 'checkout.session.completed':
        {
          const session = evt.data.object as Stripe.Checkout.Session
          console.log("🚀 ~ handler ~ session:", session)
          const tenantId = (session.metadata as any)?.tenantId || null
          const planIdFromMeta = (session.metadata as any)?.planId || null
          if (session.mode === 'payment') {
            try {
              const invId = (session.metadata as any)?.invoiceId || null
              const invNumber = (session.metadata as any)?.invoiceNumber || null
              const targetTenantId = tenantId || null
              if (targetTenantId && invId) {
                const tenant = await database.getTenantById(targetTenantId)
                if (tenant) {
                  const tenantDB = new TenantDatabase(targetTenantId, (tenant as any).schemaName)
                  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as any)?.id || null
                  const dateISO = new Date().toISOString().split('T')[ 0 ]
                  const { invoicesService } = await import('../../src/services/invoicesService')
                  await invoicesService.updateInvoice(tenantDB, invId, {
                    paymentStatus: 'paid',
                    paymentMethod: 'CREDIT_CARD',
                    paymentDate: dateISO,
                    status: 'paid',
                    stripePaymentIntentId: paymentIntentId || undefined
                  } as any)
                  try {
                    await prisma.systemLog.create({ data: { tenantId: targetTenantId, level: 'info', message: 'STRIPE_CHECKOUT_PAYMENT_COMPLETED', metadata: { sessionId: session.id, invoiceId: invId, invoiceNumber: invNumber, paymentIntentId } } })
                  } catch { }
                }
              }
            } catch { }
            break
          }
          try {
            const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as any)?.id || null
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
            await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_CHECKOUT_SESSION_COMPLETED', metadata: { sessionId: session.id, customerId, subscriptionId, planIdFromMeta } } })
          } catch { }
          if (tenantId && session.subscription) {
            try {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string)
              if (session.customer) {
                await stripe.customers.update(session.customer as string, { metadata: { tenantId } })
              }
              await stripe.subscriptions.update(sub.id, { metadata: { tenantId } })
              const productId = sub.items?.data?.[ 0 ]?.price?.product as string | undefined
              let planName = 'subscription'
              if (productId) {
                const product = await stripe.products.retrieve(productId)
                planName = product.name || planName
              }
              await upsertStripeSettings(tenantId, {
                customerId: session.customer as string,
                subscriptionId: sub.id,
                status: sub.status,
                priceId: sub.items?.data?.[ 0 ]?.price?.id,
                productId,
                currentPeriodEnd: sub.current_period_end
              })
              const stripePriceId = sub.items?.data?.[ 0 ]?.price?.id || null
              let planIdToPersist = planIdFromMeta as string | null
              if (!planIdToPersist && stripePriceId) {
                const plan = await prisma.plan.findUnique({ where: { stripePriceId: String(stripePriceId) } })
                planIdToPersist = plan?.id || null
                if (!planIdToPersist) {
                  const ensured = await getOrCreatePlanByStripePriceId(stripe, String(stripePriceId))
                  planIdToPersist = ensured?.id || null
                }
              }
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_SUBSCRIPTION_UPSERT_ATTEMPT', metadata: { stripeSubscriptionId: sub.id, stripePriceId, planId: planIdToPersist } } })
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
                })
              }
              await prisma.tenant.update({ where: { id: tenantId }, data: { planType: planName, planExpiresAt: new Date(sub.current_period_end * 1000), isActive: true } })
              await syncTenantPlanByPriceId(tenantId, sub.items?.data?.[ 0 ]?.price?.id)
            } catch (e: any) {
              console.log("🚀 ~ handler ~ e:", e)
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'error', message: 'STRIPE_CHECKOUT_COMPLETED_ERROR', metadata: { error: e?.message || String(e) } } })
              } catch (e) {
                console.log(e)
              }
            }
          }
        }
        break
      case 'payment_intent.succeeded':
        {
          try {
            const intent = evt.data.object as Stripe.PaymentIntent
            const tenantId = (intent.metadata as any)?.tenantId || null
            const invId = (intent.metadata as any)?.invoiceId || null
            const invNumber = (intent.metadata as any)?.invoiceNumber || null
            if (tenantId && invId) {
              const tenant = await database.getTenantById(tenantId)
              if (tenant) {
                const tenantDB = new TenantDatabase(tenantId, (tenant as any).schemaName)
                const dateISO = new Date().toISOString().split('T')[ 0 ]
                const method = intent.payment_method_types?.[ 0 ] === 'boleto' ? 'BOLETO' : 'CREDIT_CARD'
                const { invoicesService } = await import('../../src/services/invoicesService')
                await invoicesService.updateInvoice(tenantDB, invId, {
                  paymentStatus: 'paid',
                  paymentMethod: method,
                  paymentDate: dateISO,
                  status: 'paid',
                  stripePaymentIntentId: intent.id
                } as any)
                try {
                  await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_PAYMENT_INTENT_SUCCEEDED', metadata: { invoiceId: invId, invoiceNumber: invNumber, paymentIntentId: intent.id } } })
                } catch { }
              }
            }
          } catch { }
        }
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        {
          const sub = evt.data.object as Stripe.Subscription
          const tenantId = (sub.metadata as any)?.tenantId || null
          const stripePriceId = sub.items?.data?.[ 0 ]?.price?.id || null
          let planIdToPersist: string | null = null
          if (stripePriceId) {
            const plan = await prisma.plan.findUnique({ where: { stripePriceId: String(stripePriceId) } })
            planIdToPersist = plan?.id || null
            if (!planIdToPersist) {
              const ensured = await getOrCreatePlanByStripePriceId(stripe, String(stripePriceId))
              planIdToPersist = ensured?.id || null
            }
          }
          if (tenantId) {
            try {
              /* @ts-expect-error */
              await upsertStripeSettings(tenantId, { subscriptionId: sub.id, status: sub.status, currentPeriodEnd: sub.items.data[ 0 ].current_period_end })
              const isActive = sub.status === 'active' || sub.status === 'trialing'
              /* @ts-expect-error */
              await prisma.tenant.update({ where: { id: tenantId }, data: { planExpiresAt: sub.items.data[ 0 ].current_period_end ? new Date(sub.items.data[ 0 ].current_period_end * 1000) : undefined, isActive } })
              await syncTenantPlanByPriceId(tenantId, sub.items?.data?.[ 0 ]?.price?.id)
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'info', message: 'STRIPE_SUBSCRIPTION_EVENT', metadata: { eventType: evt.type, stripeSubscriptionId: sub.id, stripePriceId, planId: planIdToPersist } } })
              } catch { }
              if (planIdToPersist) {
                await prisma.subscription.upsert({
                  where: { stripeSubscriptionId: sub.id },
                  update: {
                    tenantId,
                    planId: planIdToPersist,
                    status: sub.status,
                    stripePriceId: stripePriceId || null,
                    /* @ts-expect-error */
                    currentPeriodStart: sub.items.data[ 0 ].current_period_start ? new Date(sub.items.data[ 0 ].current_period_start * 1000) : null,
                    /* @ts-expect-error */
                    currentPeriodEnd: sub.items.data[ 0 ].current_period_end ? new Date(sub.items.data[ 0 ].current_period_end * 1000) : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end
                  },
                  create: {
                    tenantId,
                    planId: planIdToPersist,
                    status: sub.status,
                    stripeSubscriptionId: sub.id,
                    stripePriceId: stripePriceId || null,
                    /* @ts-expect-error */
                    currentPeriodStart: sub.items.data[ 0 ].current_period_start ? new Date(sub.items.data[ 0 ].current_period_start * 1000) : null,
                    /* @ts-expect-error */
                    currentPeriodEnd: sub.items.data[ 0 ].current_period_end ? new Date(sub.items.data[ 0 ].current_period_end * 1000) : null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end
                  }
                })
              }
            } catch (e: any) {
              try {
                await prisma.systemLog.create({ data: { tenantId, level: 'error', message: 'STRIPE_SUBSCRIPTION_EVENT_ERROR', metadata: { eventType: evt.type, error: e?.message || String(e) } } })
              } catch { }
            }
          }
        }
        break
      case 'invoice.payment_succeeded':
        {
          const invoice = evt.data.object as Stripe.Invoice
          let mappedTenantId: string | null = null
          try {
            if (invoice.customer) {
              const customer = await stripe.customers.retrieve(invoice.customer as string)
              mappedTenantId = (customer as any)?.metadata?.tenantId || null
            }
          } catch { }
          const targetTenantId = mappedTenantId || (invoice.metadata as any)?.tenantId || null
          if (targetTenantId) {
            try {
              await upsertStripeSettings(targetTenantId, { lastInvoiceId: invoice.id })
              const cfg = await prisma.tenantApiConfig.findUnique({ where: { tenantId: targetTenantId } })
              const settings = cfg?.settings ? (typeof cfg.settings === 'string' ? JSON.parse(cfg.settings as any) : cfg.settings) : {}
              const pendingPlanId = settings?.stripe?.pendingPlanId || null
              const pendingPriceId = settings?.stripe?.pendingPriceId || null
              if (pendingPlanId && pendingPriceId) {
                let subscriptionId: string | null = settings?.stripe?.subscriptionId || null
                if (!subscriptionId) {
                  const subRow = await prisma.subscription.findFirst({ where: { tenantId: targetTenantId }, orderBy: { updatedAt: 'desc' } })
                  subscriptionId = subRow?.stripeSubscriptionId || null
                }
                if (subscriptionId) {
                  const currentSub = await stripe.subscriptions.retrieve(String(subscriptionId))
                  const itemId = currentSub?.items?.data?.[ 0 ]?.id
                  if (itemId) {
                    const updated = await stripe.subscriptions.update(currentSub.id, { items: [ { id: itemId, price: String(pendingPriceId) } ], proration_behavior: 'none' } as any)
                    await upsertStripeSettings(targetTenantId, { subscriptionId: updated.id, status: updated.status, priceId: pendingPriceId, lastPlanChangeAt: new Date().toISOString(), pendingPlanId: null, pendingPriceId: null, pendingPlanChangeScheduledFor: null })
                    await syncTenantPlanByPriceId(targetTenantId, pendingPriceId)
                    const plan = await prisma.plan.findUnique({ where: { id: String(pendingPlanId) } })
                    const stripePriceId = updated.items?.data?.[ 0 ]?.price?.id || null
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
                          cancelAtPeriodEnd: !!updated.cancel_at_period_end
                        },
                        create: {
                          tenantId: targetTenantId,
                          planId: plan.id,
                          status: updated.status,
                          stripeSubscriptionId: updated.id,
                          stripePriceId: stripePriceId || null,
                          currentPeriodStart: updated.current_period_start ? new Date(updated.current_period_start * 1000) : null,
                          currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000) : null,
                          cancelAtPeriodEnd: !!updated.cancel_at_period_end
                        }
                      })
                    }
                  }
                }
              }
              const tenant = await database.getTenantById(targetTenantId)
              if (tenant) {
                const tenantDB = new TenantDatabase(targetTenantId, (tenant as any).schemaName)
                const amount = (invoice.amount_paid || invoice.amount_due || 0) / 100
                const date = new Date((invoice.status_transitions?.paid_at || Date.now()))
                await transactionsService.createTransaction(tenantDB, {
                  type: 'income',
                  amount,
                  categoryId: 'subscription',
                  category: 'Subscription',
                  description: `Stripe invoice ${invoice.number || invoice.id}`,
                  date: date.toISOString().slice(0, 10),
                  paymentMethod: 'CREDIT_CARD',
                  status: 'confirmed',
                  tags: [ 'stripe', 'subscription' ]
                } as any, 'system')
              }
            } catch { }
          }
        }
        break
      case 'invoice.payment_failed':
        {
          const invoice = evt.data.object as Stripe.Invoice
          let mappedTenantId: string | null = null
          try {
            if (invoice.customer) {
              const customer = await stripe.customers.retrieve(invoice.customer as string)
              mappedTenantId = (customer as any)?.metadata?.tenantId || null
            }
          } catch { }
          const targetTenantId = mappedTenantId || (invoice.metadata as any)?.tenantId || null
          if (targetTenantId) {
            try {
              await upsertStripeSettings(targetTenantId, { lastInvoiceId: invoice.id, lastFailedAt: new Date().toISOString() })
              await prisma.systemLog.create({ data: { tenantId: targetTenantId, level: 'warn', message: 'STRIPE_PAYMENT_FAILED', metadata: { invoiceId: invoice.id } } })
            } catch { }
          }
        }
        break
      default:
        break
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  } catch (err: any) {
    console.log("🚀 ~ handler ~ err:", err)
    return { statusCode: 400, body: `Webhook Error: ${err?.message || 'invalid signature'}` }
  }
}
