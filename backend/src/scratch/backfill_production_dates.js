const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Robust date parser helper
const parseInstantlyDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
    const num = Number(val);
    return new Date(num < 10000000000 ? num * 1000 : num);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

async function backfill() {
  // Load connection string from .env.production first, fallback to .env or process.env
  let connectionString = process.env.DATABASE_URL;
  
  const prodEnvPath = path.join(__dirname, '..', '..', '.env.production');
  const devEnvPath = path.join(__dirname, '..', '..', '.env');
  
  if (fs.existsSync(devEnvPath)) {
    const content = fs.readFileSync(devEnvPath, 'utf8');
    const match = content.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (match && match[1]) {
      connectionString = match[1];
      console.log('Using database connection from .env');
    }
  } else if (fs.existsSync(prodEnvPath)) {
    const content = fs.readFileSync(prodEnvPath, 'utf8');
    const match = content.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (match && match[1]) {
      connectionString = match[1];
      console.log('Using database connection from .env.production');
    }
  }

  if (!connectionString) {
    console.error('Error: DATABASE_URL not found in environment or config files.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to database. Fetching unibox emails...');
    
    const { rows: emails } = await client.query('SELECT id, sender_email, metadata, received_at FROM unibox_emails');
    console.log(`Found ${emails.length} unibox email records to analyze.`);
    
    let updatedEmailsCount = 0;
    let updatedLeadsCount = 0;

    for (const email of emails) {
      const meta = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
      const item = meta.item || {};
      
      // Try to find the original correct time from metadata fields
      const rawTime = item.timestamp_email || 
                      item.timestamp_created || 
                      item.timestamp_updated || 
                      meta.timestamp || 
                      meta.timestamp_email || 
                      meta.timestamp_created || 
                      email.received_at;
                      
      const correctDate = parseInstantlyDate(rawTime);
      
      if (correctDate) {
        // Update unibox_email received_at
        await client.query(
          'UPDATE unibox_emails SET received_at = $1 WHERE id = $2',
          [correctDate, email.id]
        );
        updatedEmailsCount++;
        
        // Update matching lead created_at
        const leadUpdateResult = await client.query(
          `UPDATE leads 
           SET created_at = $1 
           WHERE id = (SELECT converted_to_lead_id FROM unibox_emails WHERE id = $2)
              OR (email = $3 AND source = 'Instantly')`,
          [correctDate, email.id, email.sender_email]
        );
        
        updatedLeadsCount += leadUpdateResult.rowCount;
      }
    }
    
    console.log(`Backfill completed successfully!`);
    console.log(`- Updated received_at for ${updatedEmailsCount} unibox emails.`);
    console.log(`- Updated created_at for ${updatedLeadsCount} leads.`);
    
  } catch (err) {
    console.error('Backfill failed:', err);
  } finally {
    await client.end();
  }
}

backfill();
