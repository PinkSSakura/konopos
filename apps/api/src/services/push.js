const webpush = require('web-push');
const config = require('../config');
const { PushSubscription, Order } = require('../models');
const { emitServiceItemReady } = require('./notify');

const TYPE_LABELS = {
  FOOD: 'Cuisine',
  DRINK: 'Bar',
};

let devVapidKeys = null;

function getVapidKeys() {
  if (config.vapidPublicKey && config.vapidPrivateKey) {
    return {
      publicKey: config.vapidPublicKey,
      privateKey: config.vapidPrivateKey,
    };
  }
  if (!devVapidKeys) {
    devVapidKeys = webpush.generateVAPIDKeys();
    console.warn(
      '[push] VAPID keys not configured — using ephemeral dev keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for production.',
    );
  }
  return devVapidKeys;
}

function ensureWebPushConfigured() {
  const keys = getVapidKeys();
  webpush.setVapidDetails(config.vapidSubject, keys.publicKey, keys.privateKey);
  return keys;
}

function getVapidPublicKey() {
  return ensureWebPushConfigured().publicKey;
}

function buildItemReadyPayload(order, item) {
  const tablePart = order.table?.name ? `Table ${order.table.name}` : 'Sans table';
  const typeLabel = TYPE_LABELS[item.product_type] || item.product_type || '';
  const body = `${item.quantity}× ${item.name} — ${order.order_number} (${tablePart})`;
  const title = typeLabel ? `${typeLabel} — prêt à servir` : 'Article prêt à servir';

  return {
    title,
    body,
    tag: `ready-${item._id}`,
    url: '/service',
    orderId: String(order._id),
    itemId: String(item._id),
    orderNumber: order.order_number,
    tableName: order.table?.name || null,
    productType: item.product_type || null,
    itemName: item.name,
    quantity: item.quantity,
  };
}

async function saveSubscription(user, establishmentId, subscription, req) {
  ensureWebPushConfigured();
  const endpoint = subscription?.endpoint;
  const keys = subscription?.keys;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    const err = new Error('Abonnement push invalide.');
    err.status = 400;
    throw err;
  }

  const existing = await PushSubscription.findOne({ endpoint });
  if (existing) {
    existing.user = user._id;
    existing.establishment = establishmentId;
    existing.keys = keys;
    existing.user_agent = req.headers['user-agent'] || null;
    await existing.save();
    return existing;
  }

  return PushSubscription.create({
    user: user._id,
    establishment: establishmentId,
    endpoint,
    keys,
    user_agent: req.headers['user-agent'] || null,
  });
}

async function removeSubscription(userId, endpoint) {
  const sub = await PushSubscription.findOne({ endpoint, user: userId, is_deleted: false });
  if (!sub) return false;
  sub.is_deleted = true;
  sub.deleted_at = new Date();
  await sub.save();
  return true;
}

async function sendWebPushToUser(userId, payload) {
  ensureWebPushConfigured();
  const subs = await PushSubscription.find({ user: userId, is_deleted: false });
  if (!subs.length) return;

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    url: payload.url,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  });

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        notification,
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        sub.is_deleted = true;
        sub.deleted_at = new Date();
        await sub.save();
      }
    }
  }));
}

async function notifyItemReady(establishmentId, orderId, item, actorUserId) {
  if (!item || item.status !== 'ready') return;

  const order = await Order.findOne({ _id: orderId, establishment: establishmentId })
    .populate('table', 'name')
    .select('order_number created_by table');
  if (!order?.created_by) return;

  const ownerId = String(order.created_by._id || order.created_by);
  if (actorUserId && ownerId === String(actorUserId)) return;

  const payload = buildItemReadyPayload(order, item);
  emitServiceItemReady(ownerId, payload);
  await sendWebPushToUser(ownerId, payload);
}

module.exports = {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  notifyItemReady,
};
