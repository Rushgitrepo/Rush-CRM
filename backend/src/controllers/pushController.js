const pushService = require('../services/pushService');

const getVapidKey = (req, res) => {
  const keys = pushService.getVapidKeys();
  res.json({ publicKey: keys.publicKey });
};

const subscribe = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await pushService.saveSubscription(req.user.id, req.user.orgId, subscription);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
    await pushService.removeSubscription(req.user.id, endpoint);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { getVapidKey, subscribe, unsubscribe };
