require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Starting comprehensive migration...');

    // =====================================================
    // EMAILS TABLE MIGRATION
    // =====================================================
    console.log('Migrating emails table...');

    const columnsToAdd = [
      { name: 'mailbox_id', type: 'uuid REFERENCES connected_mailboxes(id) ON DELETE CASCADE' },
      { name: 'snippet', type: 'text' },
      { name: 'org_id', type: 'uuid REFERENCES organizations(id) ON DELETE CASCADE' },
      { name: 'labels', type: 'text[]' },
      { name: 'has_attachments', type: 'boolean DEFAULT false' },
      { name: 'updated_at', type: 'timestamp without time zone DEFAULT CURRENT_TIMESTAMP' },
    ];

    for (const col of columnsToAdd) {
      const checkCol = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='emails' AND column_name=$1
      `, [col.name]);

      if (checkCol.rows.length === 0) {
        console.log(`Adding ${col.name} column...`);
        await client.query(`ALTER TABLE emails ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    // UNIQUE message_id
    const checkConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name='emails' 
      AND constraint_type='UNIQUE'
      AND constraint_name='emails_message_id_key'
    `);

    if (checkConstraint.rows.length === 0) {
      console.log('Adding UNIQUE constraint...');
      await client.query(`
        ALTER TABLE emails 
        ADD CONSTRAINT emails_message_id_key UNIQUE (message_id)
      `);
    }

    // Index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id 
      ON emails(mailbox_id)
    `);

    // =====================================================
    // CALENDAR EVENT ATTENDEES MIGRATION
    // =====================================================
    console.log('Migrating calendar_event_attendees table...');

    await client.query(`
      ALTER TABLE public.calendar_event_attendees 
      ADD COLUMN IF NOT EXISTS email text,
      ADD COLUMN IF NOT EXISTS is_organizer boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS org_id uuid;
    `);

    // =====================================================
    // CALENDAR EVENTS MIGRATION
    // =====================================================
    console.log('Migrating calendar_events table...');

    await client.query(`
      ALTER TABLE public.calendar_events 
      ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
    `);

    console.log('✅ Comprehensive migration completed successfully');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();