import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: 'Juris Start',
      stripePriceId: 'price_juris_start',
      price: new Prisma.Decimal(299),
      maxUsers: 3,
      maxQueries: 70,
      maxReceivables: 70,
      maxStorageGB: 10,
      features: {
        basicProcessTaskManagement: true,
        mainIndicatorsDashboard: true,
        internalTeamTasks: true,
        clientPanelProcessStatus: true,
        simpleWhatsAppIntegration: true
      },
      additionalQueryFee: new Prisma.Decimal(2.5),
      additionalReceivableFee: new Prisma.Decimal(5)
    },
    {
      name: 'Juris Pro',
      stripePriceId: 'price_juris_pro',
      price: new Prisma.Decimal(699),
      maxUsers: 8,
      maxQueries: 200,
      maxReceivables: 200,
      maxStorageGB: 50,
      features: {
        basicProcessTaskManagement: true,
        mainIndicatorsDashboard: true,
        internalTeamTasks: true,
        clientPanelProcessStatus: true,
        simpleWhatsAppIntegration: true,
        whatsappBillingChatbot: true,
        taskDelegationExecutionControl: true,
        analyticalDashboardByClientOrLawyerArea: true,
        interactiveClientPanelComments: true,
        prioritySupport: true
      },
      additionalQueryFee: new Prisma.Decimal(1.5),
      additionalReceivableFee: new Prisma.Decimal(3)
    },
    {
      name: 'Juris Supremo',
      stripePriceId: 'price_juris_supremo',
      price: new Prisma.Decimal(999),
      maxUsers: 1000000,
      maxQueries: null,
      maxReceivables: null,
      maxStorageGB: null,
      features: {
        basicProcessTaskManagement: true,
        mainIndicatorsDashboard: true,
        internalTeamTasks: true,
        clientPanelProcessStatus: true,
        simpleWhatsAppIntegration: true,
        whatsappBillingChatbot: true,
        taskDelegationExecutionControl: true,
        analyticalDashboardByClientOrLawyerArea: true,
        interactiveClientPanelComments: true,
        prioritySupport: true,
        aiNegotiationBillingChatbot: true,
        fullInternalAndFinancialWorkflowAutomation: true,
        advancedLegalCRM: true,
        clientPortalAutomatedReports: true,
        customizableExportableDashboard: true,
        pixBankIntegration: true,
        vipSupportDedicatedManager: true,
        unlimitedQueries: true,
        unlimitedReceivables: true,
        unlimitedStorage: true
      },
      additionalQueryFee: new Prisma.Decimal(0),
      additionalReceivableFee: new Prisma.Decimal(0)
    }
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { name: p.name },
      update: {
        stripePriceId: p.stripePriceId,
        price: p.price,
        maxUsers: p.maxUsers,
        maxQueries: p.maxQueries ?? null,
        maxReceivables: p.maxReceivables ?? null,
        maxStorageGB: p.maxStorageGB ?? null,
        features: p.features,
        additionalQueryFee: p.additionalQueryFee,
        additionalReceivableFee: p.additionalReceivableFee,
        updatedAt: new Date()
      },
      create: {
        name: p.name,
        stripePriceId: p.stripePriceId,
        price: p.price,
        maxUsers: p.maxUsers,
        maxQueries: p.maxQueries ?? null,
        maxReceivables: p.maxReceivables ?? null,
        maxStorageGB: p.maxStorageGB ?? null,
        features: p.features,
        additionalQueryFee: p.additionalQueryFee,
        additionalReceivableFee: p.additionalReceivableFee
      }
    });
    console.log(`Seeded plan: ${p.name}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Plans seed completed');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

