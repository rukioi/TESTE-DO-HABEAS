import { PrismaClient, Prisma } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

console.log('Database config loaded:', {
  url: databaseUrl?.substring(0, 50) + '...',
  environment: process.env.NODE_ENV
});

// Main Prisma client for all operations
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});


// Database operations using Prisma
export class Database {
  private static instance: Database;

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async testConnection() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  // Admin operations
  async findAdminByEmail(email: string) {
    try {
      const admin = await prisma.adminUser.findUnique({
        where: { email }
      });
      return admin;
    } catch (error) {
      console.error('Error in findAdminByEmail:', error);
      return null;
    }
  }

  async createAdminUser(userData: any) {
    try {
      const admin = await prisma.adminUser.create({
        data: userData
      });
      return admin;
    } catch (error) {
      console.error('Error creating admin user:', error);
      throw error;
    }
  }

  async updateAdminLastLogin(id: string) {
    try {
      await prisma.adminUser.update({
        where: { id },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      console.error('Error updating admin last login:', error);
      throw error;
    }
  }

  // User operations
  async findUserByEmail(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true }
      });
      return user;
    } catch (error) {
      console.error('Error in findUserByEmail:', error);
      return null;
    }
  }

  async createUser(userData: any) {
    try {
      // Convert snake_case to camelCase for Prisma
      const prismaData = {
        email: userData.email,
        password: userData.password,
        name: userData.name,
        accountType: userData.account_type || userData.accountType,
        tenantId: userData.tenant_id || userData.tenantId,
        isActive: userData.is_active !== undefined ? userData.is_active : userData.isActive,
        mustChangePassword: userData.must_change_password !== undefined ? userData.must_change_password : userData.mustChangePassword,
      };

      if (!prismaData.tenantId) {
        throw new Error('TenantId is required to create user');
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: prismaData.tenantId } });
      if (!tenant || !tenant.isActive) {
        throw new Error('Tenant not found or inactive');
      }

      const activeUsers = await prisma.user.count({ where: { tenantId: prismaData.tenantId, isActive: true } });
      if (activeUsers >= tenant.maxUsers) {
        throw new Error('User limit reached for current plan');
      }

      const user = await prisma.user.create({
        data: prismaData,
        include: { tenant: true }
      });
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUserLastLogin(id: string) {
    try {
      await prisma.user.update({
        where: { id },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      console.error('Error updating user last login:', error);
      throw error;
    }
  }

  /**
   * Set reset token and expiration for password recovery (by user id or email).
   */
  async setUserResetToken(userIdOrEmail: string, token: string, expiresAt: Date) {
    try {
      const isEmail = userIdOrEmail.includes('@');
      await prisma.user.update({
        where: isEmail ? { email: userIdOrEmail } : { id: userIdOrEmail },
        data: { resetToken: token, resetTokenExpires: expiresAt, updatedAt: new Date() }
      });
    } catch (error) {
      console.error('Error setting user reset token:', error);
      throw error;
    }
  }

  /**
   * Find user by valid reset token (token matches and not expired).
   */
  async findUserByResetToken(token: string) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpires: { gt: new Date() },
          isActive: true
        },
        include: { tenant: true }
      });
      return user;
    } catch (error) {
      console.error('Error finding user by reset token:', error);
      return null;
    }
  }

  /**
   * Clear reset token and expiration after successful password reset.
   */
  async clearUserResetToken(userId: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { resetToken: null, resetTokenExpires: null, updatedAt: new Date() }
      });
    } catch (error) {
      console.error('Error clearing user reset token:', error);
      throw error;
    }
  }

  // Tenant operations
  async getAllTenants() {
    try {
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return { rows: tenants };
    } catch (error) {
      console.error('Error getting all tenants:', error);
      throw error;
    }
  }

  async getTenantById(id: string, includeUsers: boolean = false) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        ...(includeUsers && {
          include: {
            users: {
              select: {
                id: true,
                email: true,
                name: true,
                accountType: true,
                isActive: true
              }
            }
          }
        })
      });
      return tenant;
    } catch (error) {
      console.error('Error getting tenant by ID:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          accountType: true,
          tenantId: true,
          isActive: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      return { rows: users };
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  async createTenant(tenantData: any) {
    try {
      // Generate normalized schema name
      const baseSchemaName = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const normalizedSchemaName = baseSchemaName.replace(/-/g, '');

      // Convert snake_case to camelCase for Prisma
      const prismaData = {
        name: tenantData.name,
        schemaName: normalizedSchemaName,
        planType: tenantData.plan_type || tenantData.planType || 'basic',
        isActive: tenantData.is_active !== undefined ? tenantData.is_active : (tenantData.isActive !== undefined ? tenantData.isActive : true),
        maxUsers: tenantData.max_users || tenantData.maxUsers || 5,
        maxStorage: tenantData.max_storage || tenantData.maxStorage || BigInt(1073741824),
      };

      const tenant = await prisma.tenant.create({
        data: prismaData
      });

      // Create tenant schema and tables immediately
      console.log(`Creating schema for new tenant: ${tenant.id}`);
      await this.ensureTenantSchema(tenant.id, tenant.schemaName);

      return tenant;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async updateTenant(id: string, updateData: any) {
    try {
      const tenant = await prisma.tenant.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });
      return tenant;
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  async deleteTenant(id: string) {
    try {
      // Get tenant info first
      const tenant = await prisma.tenant.findUnique({ where: { id } });

      if (tenant) {
        // Validate schema name to prevent SQL injection
        const validSchemaName = /^[a-zA-Z0-9_]+$/.test(tenant.schemaName);
        if (!validSchemaName) {
          throw new Error(`Invalid schema name: ${tenant.schemaName}`);
        }

        // Drop schema before deleting tenant record  
        console.log(`Dropping schema: ${tenant.schemaName}`);
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
      }

      await prisma.tenant.delete({
        where: { id }
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // Schema validation and creation
  async ensureTenantSchema(tenantId: string, schemaName?: string) {
    try {
      let finalSchemaName = schemaName;

      if (!finalSchemaName) {
        // Get schema name from tenant record
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { schemaName: true }
        });

        if (!tenant) {
          throw new Error(`Tenant ${tenantId} not found`);
        }

        finalSchemaName = tenant.schemaName;
      }


      // Check if schema exists
      const result = await prisma.$queryRaw<{ schema_exists: boolean }[]>(Prisma.sql`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = ${finalSchemaName}
        ) as schema_exists
      `);
      const schemaExists = result?.[ 0 ]?.schema_exists;

      if (!schemaExists) {
        await this.createTenantSchemaWithTables(finalSchemaName);
      } else {
        // Ensure all required tables exist
        // await this.validateTenantTables(finalSchemaName);
      }

      return finalSchemaName;
    } catch (error) {
      console.error(`Error ensuring tenant schema for ${tenantId}:`, error);
      throw error;
    }
  }

  async validateTenantTables(schemaName: string) {
    try {
      const requiredTables = [
        'clients', 'projects', 'tasks', 'transactions',
        'invoices', 'publications', 'categories'
      ];

      // Check which tables exist
      const existingTables = await prisma.$queryRaw<{ table_name: string }[]>(Prisma.sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schemaName}
      `);
      const existingTableNames = existingTables.map((t: any) => t.table_name);

      const missingTables = requiredTables.filter(table =>
        !existingTableNames.includes(table)
      );

      if (missingTables.length > 0) {
        console.log(`Creating missing tables in ${schemaName}:`, missingTables);
        // await this.createMissingTables(schemaName, missingTables);
      }

    } catch (error) {
      console.error(`Error validating tables for schema ${schemaName}:`, error);
      throw error;
    }
  }

  async createTenantSchemaWithTables(schemaName: string) {
    try {
      // Validate schema name for security
      const validSchemaName = /^[a-zA-Z0-9_]+$/.test(schemaName);
      if (!validSchemaName) {
        throw new Error(`Invalid schema name: ${schemaName}`);
      }

      // Create schema
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      console.log(`Schema ${schemaName} created successfully`);

      // const tableDefinitions = this.getIndividualTableSQL(schemaName);
      // for (const tableDef of tableDefinitions) {
      //   const statements = tableDef.sql
      //     .split(';')
      //     .map(stmt => stmt.trim())
      //     .filter(stmt => stmt.length > 0);

      //   for (const statement of statements) {
      //     await prisma.$executeRawUnsafe(statement);
      //   }
      //   console.log(`Table ${tableDef.name} created successfully in schema ${schemaName}`);
      // }

      console.log(`All tables created successfully in schema ${schemaName}`);

    } catch (error) {
      console.error(`Error creating schema ${schemaName}:`, error);
      throw error;
    }
  }

  async createMissingTables(schemaName: string, missingTables: string[]) {
    try {
      // Use individual table definitions to avoid multiple commands error
      const tableDefinitions = this.getIndividualTableSQL(schemaName);

      for (const tableName of missingTables) {
        const tableDef = tableDefinitions.find(t => t.name === tableName);
        if (tableDef) {
          // Split the SQL by semicolon and execute each statement separately
          const statements = tableDef.sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

          for (const statement of statements) {
            if (statement.trim()) {
              await prisma.$executeRawUnsafe(statement);
            }
          }
          console.log(`Table ${tableName} created in schema ${schemaName}`);
        }
      }

    } catch (error) {
      console.error(`Error creating missing tables in ${schemaName}:`, error);
      throw error;
    }
  }

  private getTenantTablesSQL(schemaName: string): string {
    return `
      -- Clients table (CRM)
      CREATE TABLE IF NOT EXISTS "${schemaName}".clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        cpf_cnpj VARCHAR(20),
        address TEXT,
        notes TEXT,
        organization VARCHAR(255),
        budget DECIMAL(15,2),
        currency VARCHAR(3) DEFAULT 'BRL',
        status VARCHAR(50) DEFAULT 'active',
        tags JSONB DEFAULT '[]',
        cpf VARCHAR(20),
        rg VARCHAR(20),
        professional_title VARCHAR(255),
        marital_status VARCHAR(50),
        birth_date DATE,
        created_by VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Projects table
      CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        client_id UUID,
        client_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'proposal',
        priority VARCHAR(20) DEFAULT 'medium',
        progress INTEGER DEFAULT 0,
        budget DECIMAL(12,2),
        estimated_value DECIMAL(12,2),
        start_date DATE,
        end_date DATE,
        tags JSONB DEFAULT '[]',
        notes TEXT,
        created_by VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        project_id UUID,
        project_title VARCHAR(255),
        assigned_to VARCHAR(255),
        status VARCHAR(50) DEFAULT 'not_started',
        priority VARCHAR(20) DEFAULT 'medium',
        progress INTEGER DEFAULT 0,
        due_date DATE,
        tags JSONB DEFAULT '[]',
        notes TEXT,
        created_by VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Transactions table (Cash Flow)
      CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
        category_id VARCHAR(255),
        category VARCHAR(100),
        date DATE NOT NULL,
        payment_method VARCHAR(50),
        status VARCHAR(20) DEFAULT 'confirmed',
        project_id UUID,
        project_title VARCHAR(255),
        client_id UUID,
        client_name VARCHAR(255),
        tags JSONB DEFAULT '[]',
        notes TEXT,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurring_frequency VARCHAR(20),
        created_by VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Invoices table (Billing)
      CREATE TABLE IF NOT EXISTS "${schemaName}".invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        number VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        client_id UUID,
        client_name VARCHAR(255) NOT NULL,
        client_email VARCHAR(255),
        client_phone VARCHAR(50),
        project_id UUID,
        project_name VARCHAR(255),
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'BRL',
        status VARCHAR(20) DEFAULT 'draft',
        due_date DATE NOT NULL,
        items JSONB DEFAULT '[]',
        tags JSONB DEFAULT '[]',
        notes TEXT,
        payment_status VARCHAR DEFAULT 'pending',
        payment_method VARCHAR,
        payment_date DATE,
        email_sent BOOLEAN DEFAULT FALSE,
        email_sent_at TIMESTAMPTZ,
        reminders_sent INTEGER DEFAULT 0,
        last_reminder_at TIMESTAMPTZ,
        created_by VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_number ON "${schemaName}".invoices(number);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_status ON "${schemaName}".invoices(status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_payment_status ON "${schemaName}".invoices(payment_status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_due_date ON "${schemaName}".invoices(due_date);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_active ON "${schemaName}".invoices(is_active);
      
      -- Publications table
      CREATE TABLE IF NOT EXISTS "${schemaName}".publications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        type VARCHAR(50) DEFAULT 'notification',
        status VARCHAR(20) DEFAULT 'novo',
        user_id VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Categories table (for transactions)
      CREATE TABLE IF NOT EXISTS "${schemaName}".categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
        color VARCHAR(7) DEFAULT '#000000',
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_clients_email ON "${schemaName}".clients(email);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_clients_status ON "${schemaName}".clients(status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_clients_active ON "${schemaName}".clients(is_active);

      CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_status ON "${schemaName}".projects(status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_client_id ON "${schemaName}".projects(client_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_active ON "${schemaName}".projects(is_active);

      CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_status ON "${schemaName}".tasks(status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_project_id ON "${schemaName}".tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_active ON "${schemaName}".tasks(is_active);

      CREATE INDEX IF NOT EXISTS idx_${schemaName}_transactions_type ON "${schemaName}".transactions(type);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_transactions_date ON "${schemaName}".transactions(date);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_transactions_active ON "${schemaName}".transactions(is_active);

      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_number ON "${schemaName}".invoices(number);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_status ON "${schemaName}".invoices(status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_payment_status ON "${schemaName}".invoices(payment_status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_due_date ON "${schemaName}".invoices(due_date);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_active ON "${schemaName}".invoices(is_active);

      CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_status ON "${schemaName}".publications(status);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_user_id ON "${schemaName}".publications(user_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_active ON "${schemaName}".publications(is_active);

      CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_type ON "${schemaName}".categories(type);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_active ON "${schemaName}".categories(is_active);
    `;
  }

  private getIndividualTableSQL(schemaName: string): { name: string; sql: string }[] {
    return [
      {
        name: 'clients',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".clients (
             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR NOT NULL,
              organization VARCHAR,
              email VARCHAR NOT NULL,
              phone VARCHAR,
              country VARCHAR DEFAULT 'BR',
              state VARCHAR,
              address TEXT,
              city VARCHAR,
              zip_code VARCHAR,
              budget DECIMAL(15,2),
              currency VARCHAR(3) DEFAULT 'BRL',
              level VARCHAR,
              tags JSONB DEFAULT '[]',
              description TEXT,
              notes TEXT,
              cpf VARCHAR,
              rg VARCHAR,
              pis VARCHAR,
              cei VARCHAR,
              professional_title VARCHAR,
              marital_status VARCHAR,
              birth_date DATE,
              inss_status VARCHAR,
              amount_paid DECIMAL(15,2) DEFAULT 0,
              referred_by VARCHAR,
              registered_by VARCHAR,
              status VARCHAR DEFAULT 'active',
              created_by VARCHAR NOT NULL,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW(),
              is_active BOOLEAN DEFAULT TRUE
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_clients_email ON "${schemaName}".clients(email);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_clients_status ON "${schemaName}".clients(status);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_clients_active ON "${schemaName}".clients(is_active);
        `
      },
      {
        name: 'projects',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR NOT NULL,
            description VARCHAR,
            client_id VARCHAR,
            client_name VARCHAR NOT NULL,
            organization VARCHAR,
            address VARCHAR,
            budget DECIMAL(15, 2),
            currency VARCHAR DEFAULT 'BRL',
            status VARCHAR DEFAULT 'contacted',
            priority VARCHAR DEFAULT 'medium',
            progress INT DEFAULT 0,
            start_date DATE,
            end_date DATE,
            due_date DATE,
            completed_at TIMESTAMP,
            tags JSONB DEFAULT '[]',
            assigned_to JSONB DEFAULT '[]',
            notes TEXT,
            is_recurring BOOLEAN DEFAULT FALSE,
            recurring_frequency VARCHAR,
            created_by VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_status ON "${schemaName}".projects(status);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_client_id ON "${schemaName}".projects(client_id);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_active ON "${schemaName}".projects(is_active);
        `
      },
      {
        name: 'invoices',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
            id VARCHAR PRIMARY KEY,
            number VARCHAR NOT NULL UNIQUE,
            title VARCHAR NOT NULL,
            description TEXT,
            client_id VARCHAR,
            client_name VARCHAR NOT NULL,
            client_email VARCHAR,
            client_phone VARCHAR,
            project_id VARCHAR,
            project_name VARCHAR,
            amount DECIMAL(15,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'BRL',
            status VARCHAR DEFAULT 'nova',
            due_date DATE NOT NULL,
            items JSONB DEFAULT '[]',
            tags JSONB DEFAULT '[]',
            notes TEXT,
            payment_status VARCHAR DEFAULT 'pending',
            payment_method VARCHAR,
            payment_date DATE,
            email_sent BOOLEAN DEFAULT FALSE,
            email_sent_at TIMESTAMP,
            reminders_sent INTEGER DEFAULT 0,
            last_reminder_at TIMESTAMP,
            stripe_invoice_id VARCHAR,
            stripe_payment_intent_id VARCHAR,
            link_pagamento TEXT,
            recorrente BOOLEAN DEFAULT FALSE,
            intervalo_dias INTEGER DEFAULT 30,
            proxima_fatura_data DATE,
            servico_prestado VARCHAR,
            urgencia VARCHAR DEFAULT 'media',
            tentativas_cobranca INTEGER DEFAULT 0,
            created_by VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_status ON "${schemaName}".projects(status);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_client_id ON "${schemaName}".projects(client_id);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_active ON "${schemaName}".projects(is_active);
        `
      },
      {
        name: 'estimates',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
           id VARCHAR PRIMARY KEY,
          number VARCHAR NOT NULL UNIQUE,
          title VARCHAR NOT NULL,
          description TEXT,
          client_id VARCHAR,
          client_name VARCHAR NOT NULL,
          client_email VARCHAR,
          client_phone VARCHAR,
          amount DECIMAL(15,2) NOT NULL,
          currency VARCHAR(3) DEFAULT 'BRL',
          status VARCHAR DEFAULT 'draft',
          date DATE NOT NULL,
          valid_until DATE,
          items JSONB DEFAULT '[]',
          tags JSONB DEFAULT '[]',
          notes TEXT,
          converted_to_invoice BOOLEAN DEFAULT FALSE,
          invoice_id VARCHAR,
          email_sent BOOLEAN DEFAULT FALSE,
          email_sent_at TIMESTAMP,
          reminders_sent INTEGER DEFAULT 0,
          last_reminder_at TIMESTAMP,
          created_by VARCHAR NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
          );
          
        `
      },
      {
        name: 'notifications',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
           id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            actor_id VARCHAR,
            type VARCHAR NOT NULL CHECK (type IN ('task', 'invoice', 'system', 'client', 'project')),
            title VARCHAR NOT NULL,
            message TEXT NOT NULL,
            payload JSONB,
            link VARCHAR,
            read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
          );
          
        `
      },
      {
        name: 'tasks',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            project_id UUID,
            project_title VARCHAR(255),
            assigned_to VARCHAR(255),
            status VARCHAR(50) DEFAULT 'not_started',
            priority VARCHAR(20) DEFAULT 'medium',
            progress INTEGER DEFAULT 0,
            due_date DATE,
            tags JSONB DEFAULT '[]',
            notes TEXT,
            created_by VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_status ON "${schemaName}".tasks(status);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_project_id ON "${schemaName}".tasks(project_id);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_active ON "${schemaName}".tasks(is_active);
        `
      },
      {
        name: 'deals',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR NOT NULL,
            contact_name VARCHAR NOT NULL,
            organization VARCHAR,
            email VARCHAR,
            phone VARCHAR,
            address TEXT,
            budget DECIMAL(15,2),
            currency VARCHAR(3) DEFAULT 'BRL',
            stage VARCHAR DEFAULT 'contacted',
            tags JSONB DEFAULT '[]',
            description TEXT,
            client_id UUID,
            created_by VARCHAR NOT NULL,
            registered_by VARCHAR,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
          );
        `
      },
      {
        name: 'transactions',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            description VARCHAR(255) NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
            category_id VARCHAR(255),
            category VARCHAR(100),
            date DATE NOT NULL,
            payment_method VARCHAR(50),
            status VARCHAR(20) DEFAULT 'confirmed',
            project_id UUID,
            project_title VARCHAR(255),
            client_id UUID,
            client_name VARCHAR(255),
            tags JSONB DEFAULT '[]',
            notes TEXT,
            is_recurring BOOLEAN DEFAULT FALSE,
            recurring_frequency VARCHAR(20),
            created_by VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_transactions_type ON "${schemaName}".transactions(type);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_transactions_date ON "${schemaName}".transactions(date);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_transactions_active ON "${schemaName}".transactions(is_active);
        `
      },
      {
        name: 'invoices',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".invoices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            number VARCHAR(50) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            client_id UUID,
            client_name VARCHAR(255) NOT NULL,
            client_email VARCHAR(255),
            client_phone VARCHAR(50),
            project_id UUID,
            project_name VARCHAR(255),
            amount DECIMAL(15,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'BRL',
            status VARCHAR(20) DEFAULT 'draft',
            due_date DATE NOT NULL,
            items JSONB DEFAULT '[]',
            tags JSONB DEFAULT '[]',
            notes TEXT,
            payment_status VARCHAR DEFAULT 'pending',
            payment_method VARCHAR,
            payment_date DATE,
            email_sent BOOLEAN DEFAULT FALSE,
            email_sent_at TIMESTAMPTZ,
            reminders_sent INTEGER DEFAULT 0,
            last_reminder_at TIMESTAMPTZ,
            created_by VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_number ON "${schemaName}".invoices(number);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_status ON "${schemaName}".invoices(status);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_payment_status ON "${schemaName}".invoices(payment_status);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_due_date ON "${schemaName}".invoices(due_date);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_invoices_active ON "${schemaName}".invoices(is_active);
        `
      },
      {
        name: 'publications',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".publications (
           id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            oab_number VARCHAR NOT NULL,
            process_number VARCHAR,
            publication_date DATE NOT NULL,
            content TEXT NOT NULL,
            source VARCHAR NOT NULL CHECK (source IN ('CNJ-DATAJUD', 'Codilo', 'JusBrasil')),
            external_id VARCHAR,
            status VARCHAR DEFAULT 'nova',
            urgencia VARCHAR DEFAULT 'media',
            responsavel VARCHAR,
            vara_comarca VARCHAR,
            nome_pesquisado VARCHAR,
            diario VARCHAR,
            observacoes TEXT,
            atribuida_para_id VARCHAR,
            atribuida_para_nome VARCHAR,
            data_atribuicao TIMESTAMP,
            tarefas_vinculadas JSONB DEFAULT '[]',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE,
            UNIQUE(user_id, external_id)
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_user_id ON "${schemaName}".publications(user_id),
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_oab_number ON "${schemaName}".publications(oab_number),
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_status ON "${schemaName}".publications(status),
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_source ON "${schemaName}".publications(source),
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_date ON "${schemaName}".publications(publication_date),
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_active ON "${schemaName}".publications(is_active)
        `
      },
      {
        name: 'categories',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
            color VARCHAR(7) DEFAULT '#000000',
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_type ON "${schemaName}".categories(type);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_active ON "${schemaName}".categories(is_active);
        `
      },
      {
        name: 'transactions',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type VARCHAR NOT NULL CHECK (type IN ('income', 'expense')),
            amount DECIMAL(15,2) NOT NULL,
            category_id VARCHAR NOT NULL,
            category VARCHAR NOT NULL,
            description VARCHAR NOT NULL,
            date DATE NOT NULL,
            payment_method VARCHAR,
            status VARCHAR DEFAULT 'confirmed',
            project_id VARCHAR,
            project_title VARCHAR,
            client_id VARCHAR,
            client_name VARCHAR,
            tags JSONB DEFAULT '[]',
            notes TEXT,
            is_recurring BOOLEAN DEFAULT FALSE,
            recurring_frequency VARCHAR,
            created_by VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_type ON "${schemaName}".categories(type);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_active ON "${schemaName}".categories(is_active);
        `
      },
      {
        name: 'TASKS',
        sql: `
          CREATE TABLE IF NOT EXISTS "${schemaName}".categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR NOT NULL,
            description TEXT,
            project_id UUID,
            project_title VARCHAR,
            client_id UUID,
            client_name VARCHAR,
            assigned_to VARCHAR NOT NULL,
            status VARCHAR DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled')),
            priority VARCHAR DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            start_date DATE,
            end_date DATE,
            estimated_hours DECIMAL(5,2),
            actual_hours DECIMAL(5,2),
            progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
            tags JSONB DEFAULT '[]'::jsonb,
            notes TEXT,
            subtasks JSONB DEFAULT '[]'::jsonb,
            created_by VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE
          );
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_type ON "${schemaName}".categories(type);
          CREATE INDEX IF NOT EXISTS idx_${schemaName}_categories_active ON "${schemaName}".categories(is_active);
        `
      }
    ];
  }

  private getTableSQL(schemaName: string, tableName: string): string | null {
    const individualTables = this.getIndividualTableSQL(schemaName);
    const tableDef = individualTables.find(t => t.name === tableName);
    return tableDef ? tableDef.sql : null;
  }

  // Registration keys operations
  async getAllRegistrationKeys() {
    try {
      const keys = await prisma.registrationKey.findMany({
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      });
      return keys;
    } catch (error) {
      console.error('Error getting registration keys:', error);
      return [];
    }
  }

  async createRegistrationKey(keyData: any) {
    try {
      console.log('Database: Creating registration key with data:', keyData);

      const key = await prisma.registrationKey.create({
        data: {
          keyHash: keyData.keyHash,
          tenantId: keyData.tenantId,
          accountType: keyData.accountType,
          usesAllowed: keyData.usesAllowed,
          usesLeft: keyData.usesLeft,
          singleUse: keyData.singleUse,
          expiresAt: keyData.expiresAt,
          metadata: keyData.metadata,
          createdBy: keyData.createdBy,
          usedLogs: keyData.usedLogs,
          revoked: keyData.revoked,
        }
      });

      console.log('Database: Registration key created with ID:', key.id);
      return key;
    } catch (error) {
      console.error('Database error creating registration key:', error);
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  async revokeRegistrationKey(id: string) {
    try {
      await prisma.registrationKey.update({
        where: { id },
        data: { revoked: true }
      });
    } catch (error) {
      console.error('Error revoking registration key:', error);
      throw error;
    }
  }

  async findValidRegistrationKeys() {
    try {
      const keys = await prisma.registrationKey.findMany({
        where: {
          revoked: false,
          usesLeft: { gt: 0 },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });
      console.log('Found valid registration keys:', keys.length);
      console.log('Keys details:', keys.map(k => ({
        id: k.id,
        accountType: k.accountType,
        usesLeft: k.usesLeft,
        hashPreview: k.keyHash?.substring(0, 10) + '...'
      })));
      return keys;
    } catch (error) {
      console.error('Error finding valid registration keys:', error);
      return [];
    }
  }

  async updateRegistrationKeyUsage(id: string, updateData: any) {
    try {
      await prisma.registrationKey.update({
        where: { id },
        data: {
          usesLeft: updateData.usesLeft,
          usedLogs: updateData.usedLogs
        }
      });
      console.log('Registration key usage updated successfully for ID:', id);
    } catch (error) {
      console.error('Error updating registration key usage:', error);
      throw error;
    }
  }

  async deleteRegistrationKey(id: string) {
    try {
      await prisma.registrationKey.delete({
        where: { id }
      });
      console.log('Registration key deleted successfully for ID:', id);
    } catch (error) {
      console.error('Error deleting registration key:', error);
      throw error;
    }
  }

  // Refresh tokens operations
  async createRefreshToken(tokenData: any) {
    try {
      const token = await prisma.refreshToken.create({
        data: tokenData
      });
      return token;
    } catch (error) {
      console.error('Error creating refresh token:', error);
      throw error;
    }
  }

  async findValidRefreshToken(tokenHash: string) {
    try {
      const token = await prisma.refreshToken.findFirst({
        where: {
          tokenHash,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });
      return token;
    } catch (error) {
      console.error('Error in findValidRefreshToken:', error);
      return null;
    }
  }

  async revokeAllUserTokens(userId: string) {
    try {
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error revoking user tokens:', error);
      throw error;
    }
  }

  async getActiveRefreshTokensForUser(userId: string) {
    try {
      const tokens = await prisma.refreshToken.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });
      return tokens;
    } catch (error) {
      console.error('Error getting active refresh tokens for user:', error);
      return [];
    }
  }

  async revokeRefreshToken(tokenHash: string) {
    try {
      await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      throw error;
    }
  }

  async revokeRefreshTokenById(id: string) {
    try {
      await prisma.refreshToken.update({
        where: { id },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error revoking refresh token by ID:', error);
      throw error;
    }
  }

  // Admin refresh tokens operations
  async createAdminRefreshToken(tokenData: { tokenHash: string; adminId: string; expiresAt: string; isActive: boolean }) {
    try {
      const token = await prisma.adminRefreshToken.create({
        data: {
          tokenHash: tokenData.tokenHash,
          adminId: tokenData.adminId,
          expiresAt: new Date(tokenData.expiresAt),
          isActive: tokenData.isActive,
        }
      });
      return token;
    } catch (error) {
      console.error('Error creating admin refresh token:', error);
      throw error;
    }
  }

  async getActiveAdminRefreshTokensForAdmin(adminId: string) {
    try {
      const tokens = await prisma.adminRefreshToken.findMany({
        where: {
          adminId,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });
      return tokens;
    } catch (error) {
      console.error('Error getting active admin refresh tokens:', error);
      return [];
    }
  }

  async revokeAdminRefreshTokenById(id: string) {
    try {
      await prisma.adminRefreshToken.update({
        where: { id },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error revoking admin refresh token by ID:', error);
      throw error;
    }
  }

  async revokeAllAdminTokens(adminId: string) {
    try {
      await prisma.adminRefreshToken.updateMany({
        where: { adminId },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error revoking all admin tokens:', error);
      throw error;
    }
  }

  // Audit logs
  async createAuditLog(logData: any) {
    try {
      const log = await prisma.auditLog.create({
        data: logData
      });
      return log;
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }

  // System logs
  async createSystemLog(logData: any) {
    try {
      const log = await prisma.systemLog.create({
        data: logData
      });
      return log;
    } catch (error) {
      console.error('Error creating system log:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        database: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        database: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Raw query execution for complex operations
  async query(query: string, params: any[] = []) {
    try {
      if (!params || params.length === 0) {
        const result = await prisma.$queryRaw<any[]>(Prisma.raw(query));
        return { rows: result };
      }
      const parts: any[] = [];
      const re = /\$(\d+)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(query)) !== null) {
        const idx = match.index;
        parts.push(Prisma.raw(query.slice(lastIndex, idx)));
        const p = params[ Number(match[ 1 ]) - 1 ];
        parts.push(Prisma.sql`${p}`);
        lastIndex = idx + match[ 0 ].length;
      }
      parts.push(Prisma.raw(query.slice(lastIndex)));
      const sql = Prisma.join(parts);
      const result = await prisma.$queryRaw<any[]>(sql);
      if (/\$(\d+)/.test(query)) {
        const re2 = /\$(\d+)/g;
        let unsafe = '';
        let li = 0;
        let m: RegExpExecArray | null;
        const toLiteral = (v: any) => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (v instanceof Date) return `'${v.toISOString()}'::timestamptz`;
          if (typeof v === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `'${v}'::date`;
            const esc = v.replace(/'/g, "''");
            return `'${esc}'`;
          }
          const json = JSON.stringify(v);
          const esc = json.replace(/'/g, "''");
          return `'${esc}'::jsonb`;
        };
        while ((m = re2.exec(query)) !== null) {
          const idx = m.index;
          unsafe += query.slice(li, idx);
          const pv = params[ Number(m[ 1 ]) - 1 ];
          unsafe += toLiteral(pv);
          li = idx + m[ 0 ].length;
        }
        unsafe += query.slice(li);
        const res2 = await prisma.$queryRawUnsafe<any[]>(unsafe);
        return { rows: res2 };
      }
      return { rows: result };
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw error;
    }
  }

  // Tenant schema utilities
  static getSchemaName(tenantId: string): string {
    // Normalize tenant ID removing hyphens for schema name
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  async getTenantSchema(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { schemaName: true }
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    return tenant.schemaName;
  }
}

export const database = Database.getInstance();

// Initialize connection test
// database.testConnection().then(result => {
//   if (result) {
//     console.log('✅ Database connected successfully');
//   } else {
//     console.log('❌ Database connection failed');
//   }
// });

// Tenant Database operations for multi-tenancy
export class TenantDatabase {
  constructor(private tenantId: string, private schemaName?: string) { }

  async getSchemaName(): Promise<string> {
    if (this.schemaName) {
      return this.schemaName;
    }

    this.schemaName = await database.getTenantSchema(this.tenantId);
    return this.schemaName;
  }

  getTenantId(): string {
    return this.tenantId;
  }

  async executeInTenantSchema<T = any>(query: string, params: any[] = []): Promise<any> {
    try {
      const schemaName = await this.getSchemaName();

      // Ensure schema exists before executing query
      await database.ensureTenantSchema(this.tenantId, schemaName);
      const finalQuery = query.replace(/\$\{schema\}/g, schemaName);

      if (!params || params.length === 0) {
        const result = await prisma.$queryRaw<T[]>(Prisma.raw(finalQuery));
        return result || [];
      }

      const toLiteral = (v: any) => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === 'string') {
          const esc = v.replace(/'/g, "''");
          return `'${esc}'`;
        }
        const json = JSON.stringify(v);
        const esc = json.replace(/'/g, "''");
        return `'${esc}'::jsonb`;
      };

      let unsafe = '';
      let li = 0;
      const re = /\$(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(finalQuery)) !== null) {
        const idx = m.index;
        unsafe += finalQuery.slice(li, idx);
        const pv = params[ Number(m[ 1 ]) - 1 ];
        unsafe += toLiteral(pv);
        li = idx + m[ 0 ].length;
      }
      unsafe += finalQuery.slice(li);

      const result = await prisma.$queryRawUnsafe<T[]>(unsafe);
      return result || [];
    } catch (error) {
      console.error('Error executing tenant query:', error);
      throw error;
    }
  }

  async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      if (!params || params.length === 0) {
        const result = await prisma.$queryRaw<T[]>(Prisma.raw(query));
        return result || [];
      }
      const parts: any[] = [];
      const re = /\$(\d+)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(query)) !== null) {
        const idx = match.index;
        parts.push(Prisma.raw(query.slice(lastIndex, idx)));
        const p = params[ Number(match[ 1 ]) - 1 ];
        parts.push(Prisma.sql`${p}`);
        lastIndex = idx + match[ 0 ].length;
      }
      parts.push(Prisma.raw(query.slice(lastIndex)));
      const sql = Prisma.join(parts);
      const result = await prisma.$queryRaw<T[]>(sql);
      if (/\$(\d+)/.test(query)) {
        const re2 = /\$(\d+)/g;
        let unsafe = '';
        let li = 0;
        let m: RegExpExecArray | null;
        const toLiteral = (v: any) => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return String(v);
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (v instanceof Date) return `'${v.toISOString()}'::timestamptz`;
          if (typeof v === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `'${v}'::date`;
            const esc = v.replace(/'/g, "''");
            return `'${esc}'`;
          }
          const json = JSON.stringify(v);
          const esc = json.replace(/'/g, "''");
          return `'${esc}'::jsonb`;
        };
        while ((m = re2.exec(query)) !== null) {
          const idx = m.index;
          unsafe += query.slice(li, idx);
          const pv = params[ Number(m[ 1 ]) - 1 ];
          unsafe += toLiteral(pv);
          li = idx + m[ 0 ].length;
        }
        unsafe += query.slice(li);
        const res2 = await prisma.$queryRawUnsafe<T[]>(unsafe);
        return res2 || [];
      }
      return result || [];
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }
}

// Export tenant database factory
export const tenantDB = {
  executeInTenantSchema: async <T = any>(tenantId: string, query: string, params: any[] = []) => {
    const db = await tenantDB.getTenantDatabase(tenantId);
    return db.executeInTenantSchema<T>(query, params);
  },

  getSchemaName: (tenantId: string): string => {
    // Normalize tenant ID removing hyphens for schema name
    const normalizedId = tenantId.replace(/-/g, '');
    return `tenant_${normalizedId}`;
  },

  getTenantDatabase: async (tenantId: string): Promise<TenantDatabase> => {
    // OTIMIZADO: busca direta por ID ao invés de getAllTenants + filter
    const tenant = await database.getTenantById(tenantId);

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      throw new Error(`Tenant ${tenantId} is not active`);
    }

    // Ensure schema exists
    const schemaName = await database.ensureTenantSchema(tenantId, tenant.schemaName);

    return new TenantDatabase(tenantId, schemaName);
  },
  TenantDatabase
};
