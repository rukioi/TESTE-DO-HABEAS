/**
 * Adiciona a coluna last_webhook_received_at na tabela judit_trackings
 * em todos os schemas de tenant existentes (Supabase/PostgreSQL).
 *
 * Uso: node scripts/add-judit-last-webhook-column.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, schemaName: true },
  });

  console.log(`Encontrados ${tenants.length} tenant(s).`);

  for (const tenant of tenants) {
    let schemaName = tenant.schemaName || `tenant_${tenant.id.replace(/-/g, '')}`;
    if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
      console.log(`\nPulando ${tenant.name}: schemaName inválido.`);
      continue;
    }
    console.log(`\nProcessando: ${tenant.name} (schema: ${schemaName})`);

    try {
      const tableExists = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'judit_trackings' LIMIT 1`,
        schemaName
      );
      if (!tableExists || tableExists.length === 0) {
        console.log(`  → Tabela judit_trackings não existe neste schema; pulando.`);
        continue;
      }

      const hasColumn = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'judit_trackings' AND column_name = 'last_webhook_received_at' LIMIT 1`,
        schemaName
      );
      if (hasColumn && hasColumn.length > 0) {
        console.log(`  → Coluna last_webhook_received_at já existe.`);
        continue;
      }

      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${schemaName}".judit_trackings ADD COLUMN IF NOT EXISTS last_webhook_received_at TIMESTAMPTZ DEFAULT NULL`
      );
      console.log(`  → Coluna last_webhook_received_at adicionada.`);
    } catch (err) {
      console.error(`  → Erro:`, err.message);
    }
  }

  console.log('\nConcluído.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
