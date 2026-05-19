const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:haris.exe@localhost:5432/CRM' });

pool.query(
  `SELECT id, email_address, smtp_host, smtp_port, smtp_username,
          LEFT(encrypted_password, 4) || '****' AS password_preview
   FROM connected_mailboxes WHERE is_active = true`
)
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
