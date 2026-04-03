const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log('\n🔧 CREATING MISSING TABLES...\n');
console.log('='.repeat(70));

async function createTableIfNotExists(tableName, createSQL) {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = $1
    `;
    const result = await pool.query(checkQuery, [tableName]);
    
    if (result.rows.length === 0) {
      await pool.query(createSQL);
      console.log(`✅ Created: ${tableName}`);
      return true;
    } else {
      console.log(`⏭️  Exists: ${tableName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error creating ${tableName}:`, error.message);
    return false;
  }
}

async function createMissingTables() {
  let createdCount = 0;
  
  try {
    console.log('\n📋 Checking and creating missing tables...\n');
    
    // 1. profiles table
    if (await createTableIfNotExists('profiles', `
      CREATE TABLE profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        org_id UUID,
        job_title VARCHAR(255),
        department VARCHAR(255),
        phone VARCHAR(50),
        avatar VARCHAR(500),
        bio TEXT,
        location VARCHAR(255),
        timezone VARCHAR(100),
        language VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) createdCount++;
    
    // 2. connected_drives table
    if (await createTableIfNotExists('connected_drives', `
      CREATE TABLE connected_drives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        user_id UUID,
        drive_type VARCHAR(50),
        drive_name VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) createdCount++;
    
    // 3. connected_mailboxes table
    if (await createTableIfNotExists('connected_mailboxes', `
      CREATE TABLE connected_mailboxes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        user_id UUID,
        email VARCHAR(255) NOT NULL,
        provider VARCHAR(50),
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        sync_enabled BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) createdCount++;
    
    // 4. call_logs table
    if (await createTableIfNotExists('call_logs', `
      CREATE TABLE call_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        user_id UUID,
        contact_id UUID,
        lead_id UUID,
        deal_id UUID,
        phone_number VARCHAR(50),
        call_type VARCHAR(50),
        direction VARCHAR(20),
        duration INTEGER,
        status VARCHAR(50),
        recording_url TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) createdCount++;
    
    // 5. emails table
    if (await createTableIfNotExists('emails', `
      CREATE TABLE emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        user_id UUID,
        contact_id UUID,
        lead_id UUID,
        deal_id UUID,
        from_email VARCHAR(255),
        to_email VARCHAR(255),
        cc TEXT,
        bcc TEXT,
        subject TEXT,
        body TEXT,
        is_sent BOOLEAN DEFAULT false,
        sent_at TIMESTAMPTZ,
        opened_at TIMESTAMPTZ,
        clicked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) createdCount++;
    
    // 6. signing_parties table
    if (await createTableIfNotExists('signing_parties', `
      CREATE TABLE signing_parties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        deal_id UUID,
        contact_id UUID,
        name VARCHAR(255),
        email VARCHAR(255),
        role VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        signed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) createdCount++;
    
    // 7. deal_signing_parties table
    if (await createTableIfNotExists('deal_signing_parties', `
      CREATE TABLE deal_signing_parties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        deal_id UUID NOT NULL,
        signing_party_id UUID NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) createdCount++;
    
    console.log('\n' + '='.repeat(70));
    console.log(`✅ Created ${createdCount} new tables`);
    console.log('='.repeat(70));
    
    // Final count
    const finalCount = await pool.query(`
      SELECT COUNT(*) as total 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != 'migrations'
    `);
    
    console.log(`\n📊 Total tables now: ${finalCount.rows[0].total}`);
    
    if (parseInt(finalCount.rows[0].total) >= 104) {
      console.log('\n🎉 DATABASE COMPLETE! All 104+ tables created!\n');
    } else {
      console.log(`\n⚠️  Still missing ${104 - parseInt(finalCount.rows[0].total)} tables\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createMissingTables();