const { push } = require('../services')();
const { query } = require('../utils')();
const { getEstablishmentId } = query;
const { getVapidPublicKey, saveSubscription, removeSubscription } = push;

async function vapidPublicKey(req, res, next) {
  try {
    res.json({
      success: true,
      data: { publicKey: getVapidPublicKey() },
    });
  } catch (err) {
    next(err);
  }
}

async function subscribe(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const sub = await saveSubscription(req.user, estId, req.body.subscription, req);
    res.json({ success: true, data: { id: String(sub._id) } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function unsubscribe(req, res, next) {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint requis.' });
    }
    await removeSubscription(req.user._id, endpoint);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  vapidPublicKey,
  subscribe,
  unsubscribe,
};
