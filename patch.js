const fs = require('fs');
let c = fs.readFileSync('backend/src/controllers/collaboration/emailSyncController.js', 'utf8');

c = c.replace('const { mailbox_id, to, cc, bcc, subject, body, draft_id } = req.body;', 'const { mailbox_id, to, cc, bcc, subject, body, html_body, draft_id } = req.body;');

c = c.replace(`body || '', (body || '').substring`, `html_body || body || '', (body || '').substring`);
c = c.replace(`body || '', (body || '').substring`, `html_body || body || '', (body || '').substring`);

c = c.replace('await imapSyncService.saveDraft(mailbox_id, req.user.id, { to, subject, body });', 'await imapSyncService.saveDraft(mailbox_id, req.user.id, { to, subject, body, html_body });');

c = c.replace('await gmailSyncService.saveDraft(mailbox_id, req.user.id, { to, subject, body, draft_id: localId });', 'await gmailSyncService.saveDraft(mailbox_id, req.user.id, { to, subject, body, html_body, draft_id: localId });');

fs.writeFileSync('backend/src/controllers/collaboration/emailSyncController.js', c);
