const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log('\n🔧 FIXING FAILED MIGRATIONS...\n');
console.log('='.repeat(70));

async function addColumnIfNotExists(tableName, columnName, columnType, defaultValue = null) {
  try {
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `;
    const result = await pool.query(checkQuery, [tableName, columnName]);
    
    if (result.rows.length === 0) {
      let alterQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
      if (defaultValue !== null) {
        alterQuery += ` DEFAULT ${defaultValue}`;
      }
      await pool.query(alterQuery);
      console.log(`✅ Added ${tableName}.${columnName}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error adding ${tableName}.${columnName}:`, error.message);
    return false;
  }
}

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
      console.log(`✅ Created table: ${tableName}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error creating ${tableName}:`, error.message);
    return false;
  }
}

async function fixAll() {
  let fixedCount = 0;
  
  try {
    console.log('\n📋 Creating missing tables...\n');
    
    // Create profiles table if missing
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
    `)) fixedCount++;
    
    // Create unibox_emails if missing
    if (await createTableIfNotExists('unibox_emails', `
      CREATE TABLE unibox_emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        external_id VARCHAR(255),
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255),
        recipient_email VARCHAR(255),
        recipient_name VARCHAR(255),
        subject TEXT,
        body TEXT,
        body_text TEXT,
        body_html TEXT,
        status VARCHAR(50) DEFAULT 'New',
        priority VARCHAR(50) DEFAULT 'Normal',
        received_at TIMESTAMPTZ,
        is_read BOOLEAN DEFAULT false,
        is_starred BOOLEAN DEFAULT false,
        is_archived BOOLEAN DEFAULT false,
        assigned_to UUID,
        converted_to_lead_id UUID,
        tags TEXT[],
        attachments JSONB,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)) fixedCount++;
    
    console.log('\n📋 Adding missing columns to existing tables...\n');
    
    // Fix users table
    if (await addColumnIfNotExists('users', 'org_id', 'UUID')) fixedCount++;
    
    // Fix roles table
    if (await addColumnIfNotExists('roles', 'org_id', 'UUID')) fixedCount++;
    
    // Fix permissions table
    if (await addColumnIfNotExists('permissions', 'org_id', 'UUID')) fixedCount++;
    
    // Fix user_roles table
    if (await addColumnIfNotExists('user_roles', 'org_id', 'UUID')) fixedCount++;
    
    // Fix leave_types table
    if (await addColumnIfNotExists('leave_types', 'user_id', 'UUID')) fixedCount++;
    
    // Fix warehouses table
    if (await addColumnIfNotExists('warehouses', 'org_id', 'UUID')) fixedCount++;
    
    // Fix contacts table
    if (await addColumnIfNotExists('contacts', 'company_name', 'VARCHAR(255)')) fixedCount++;
    
    // Fix leads table
    if (await addColumnIfNotExists('leads', 'stage', 'VARCHAR(100)', "'new'")) fixedCount++;
    if (await addColumnIfNotExists('leads', 'last_contacted_date', 'TIMESTAMPTZ')) fixedCount++;
    
    // Fix deals table
    if (await addColumnIfNotExists('deals', 'converted_from_lead_id', 'UUID')) fixedCount++;
    
    // Fix leave_requests table
    if (await addColumnIfNotExists('leave_requests', 'user_id', 'UUID')) fixedCount++;
    
    // Fix hrms_notifications table
    if (await addColumnIfNotExists('hrms_notifications', 'notification_type', 'VARCHAR(100)')) fixedCount++;
    if (await addColumnIfNotExists('hrms_notifications', 'user_id', 'UUID')) fixedCount++;
    
    console.log('\n' + '='.repeat(70));
    console.log(`✅ Fixed ${fixedCount} issues`);
    console.log('='.repeat(70));
    console.log('\n🎉 ALL FIXES APPLIED!\n');
    console.log('Now run: node complete-setup-for-team.js\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixAll();