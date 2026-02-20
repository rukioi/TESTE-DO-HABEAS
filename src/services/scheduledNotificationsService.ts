import { TenantDatabase } from '../config/database';
import { queryTenantSchema, insertInTenantSchema, updateInTenantSchema } from '../utils/tenantHelpers';

export class ScheduledNotificationsService {
  private tableName = 'scheduled_notifications';
  private ensured = new Set<string>();

  private async ensureTables(tenantDB: TenantDatabase) {
    const schema = await tenantDB.getSchemaName();
    if (this.ensured.has(schema)) return;
    const createTable = `
      CREATE TABLE IF NOT EXISTS ${schema}.${this.tableName} (
        id VARCHAR PRIMARY KEY,
        client_phone VARCHAR NOT NULL,
        message TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','failed','cancelled')),
        error TEXT,
        instance_name VARCHAR,
        target_invoice_id VARCHAR,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await queryTenantSchema(tenantDB, createTable);
    await queryTenantSchema(tenantDB, `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_scheduled ON ${schema}.${this.tableName}(scheduled_at)`);
    await queryTenantSchema(tenantDB, `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status ON ${schema}.${this.tableName}(status)`);
    this.ensured.add(schema);
  }

  async schedule(tenantDB: TenantDatabase, data: { clientPhone: string; message: string; scheduledAtISO: string; instanceName?: string; invoiceId?: string; }) {
    await this.ensureTables(tenantDB);
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return await insertInTenantSchema(tenantDB, this.tableName, {
      id,
      client_phone: data.clientPhone,
      message: data.message,
      scheduled_at: new Date(data.scheduledAtISO),
      status: 'scheduled',
      instance_name: data.instanceName || null,
      target_invoice_id: data.invoiceId || null
    });
  }

  async listDue(tenantDB: TenantDatabase, nowISO: string) {
    await this.ensureTables(tenantDB);
    const query = `
      SELECT * FROM \${schema}.${this.tableName}
      WHERE status = 'scheduled' AND scheduled_at <= $1
      ORDER BY scheduled_at ASC
      LIMIT 200
    `;
    return await queryTenantSchema<any>(tenantDB, query, [ nowISO ]);
  }

  async listAll(tenantDB: TenantDatabase, limit: number = 200) {
    await this.ensureTables(tenantDB);
    const query = `
      SELECT * FROM \${schema}.${this.tableName}
      ORDER BY scheduled_at DESC
      LIMIT $1
    `;
    return await queryTenantSchema<any>(tenantDB, query, [ limit ]);
  }

  async mark(tenantDB: TenantDatabase, id: string, patch: { status: 'sent' | 'failed' | 'cancelled'; error?: string; }) {
    await this.ensureTables(tenantDB);
    const data: any = { status: patch.status, updated_at: new Date(), error: patch.error || null };
    const query = `
    UPDATE \${schema}.${this.tableName}
    SET status = $2, error = $3, updated_at = NOW()
    WHERE id::text = $1
    RETURNING *`
    return await queryTenantSchema(tenantDB, query, [ id, data.status, data.error ]);
  }

  async update(tenantDB: TenantDatabase, id: string, patch: { message?: string; scheduledDate?: string; scheduledTime?: string; status?: string }) {
    await this.ensureTables(tenantDB);
    const sets: string[] = [];
    const params: any[] = [ id ];
    let idx = 2;
    if (patch.message != null) { sets.push(`message = $${idx}`); params.push(patch.message); idx++; }
    if (patch.status != null) { sets.push(`status = $${idx}`); params.push(patch.status); idx++; }
    if (patch.scheduledDate && patch.scheduledTime) {
      sets.push(`scheduled_at = $${idx}::timestamptz`);
      params.push(`${patch.scheduledDate}T${patch.scheduledTime}:00`);
      idx++;
    }
    if (sets.length === 0) return null;
    const query = `
      UPDATE \${schema}.${this.tableName}
      SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id::text = $1
      RETURNING *
    `;
    const rows = await queryTenantSchema<any>(tenantDB, query, params);
    return rows?.[0] || null;
  }

  async delete(tenantDB: TenantDatabase, id: string) {
    await this.ensureTables(tenantDB);
    const query = `
      DELETE FROM \${schema}.${this.tableName}
      WHERE id::text = $1
      RETURNING *
    `;
    const rows = await queryTenantSchema<any>(tenantDB, query, [ id ]);
    return rows?.[0] || null;
  }
}

export const scheduledNotificationsService = new ScheduledNotificationsService();
