const db = require('./src/config/database');

async function createTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.crm_custom_field_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id UUID NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          key VARCHAR(255) NOT NULL,
          type VARCHAR(50) DEFAULT 'string',
          section_id VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(org_id, entity_type, key)
      )
    `);
    console.log('Table crm_custom_field_templates created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create table:', err);
    process.exit(1);
  }
}

createTable();
