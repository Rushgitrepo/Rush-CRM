const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const uniboxController = require('../../controllers/collaboration/uniboxController');

router.use(auth, requireOrg);

// Email management
router.get('/emails', uniboxController.getEmails);
router.get('/emails/:id', uniboxController.getEmail);
router.patch('/emails/:id/status', uniboxController.updateEmailStatus);
router.patch('/emails/:id/starred', uniboxController.toggleStarred);
router.patch('/emails/:id/read', uniboxController.markAsRead);
router.patch('/emails/:id/archive', uniboxController.toggleArchive);
router.post('/emails/:id/convert-to-lead', uniboxController.convertToLead);
router.get('/emails/:id/lead-info', uniboxController.getEmailLeadInfo);
router.post('/emails/sample', uniboxController.createSampleEmail);

// Statistics and templates
router.get('/stats', uniboxController.getStats);
router.get('/templates', uniboxController.getTemplates);
router.get('/campaigns', uniboxController.getCampaigns);

// Permissions
router.get('/permission', uniboxController.checkPermission);
router.get('/permissions', uniboxController.getPermissions);
router.post('/permissions', uniboxController.grantPermission);
router.delete('/permissions/:user_id', uniboxController.revokePermission);

module.exports = router;
