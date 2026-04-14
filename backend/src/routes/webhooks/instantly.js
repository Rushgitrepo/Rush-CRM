const express = require('express');
const router = express.Router();
const instantlyWebhookController = require('../../controllers/webhooks/instantlyWebhookController');

// Public route (accessed by Instantly.ai)
router.post('/:orgId', instantlyWebhookController.handleWebhook);

module.exports = router;
