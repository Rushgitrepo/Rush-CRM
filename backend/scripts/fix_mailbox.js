const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:haris.exe@localhost:5432/CRM' });

pool.query(
  `UPDATE connected_mailboxes SET
    smtp_host = 'smtp.gmail.com',
    smtp_port = 587,
    imap_host = 'imap.gmail.com',
    imap_port = 993
  WHERE id = '5d89840b-6c94-42a3-80e8-8f40fba6af26'
  RETURNING id, email_address, smtp_host, smtp_port, imap_host, imap_port`
)
  .then(r => { console.log('Updated:', JSON.stringify(r.rows[0], null, 2)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
