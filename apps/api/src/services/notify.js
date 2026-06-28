let io = null;

function setIo(instance) {
  io = instance;
}

function estRoom(establishmentId) {
  return `est:${establishmentId}`;
}

function cdsRoom(establishmentId) {
  return `cds:${establishmentId}`;
}

function emitToEstablishment(establishmentId, event, payload) {
  if (!io || !establishmentId) return;
  io.to(estRoom(establishmentId)).emit(event, payload);
}

function emitCdsChanged(establishmentId) {
  if (!io || !establishmentId) return;
  io.to(cdsRoom(establishmentId)).emit('cds:changed', {});
}

function emitKdsChanged(establishmentId, productType) {
  emitToEstablishment(establishmentId, 'kds:changed', {
    productType: productType || null,
  });
}

function emitOrderChanged(establishmentId, orderId) {
  emitToEstablishment(establishmentId, 'order:changed', {
    orderId: String(orderId),
  });
  emitCdsChanged(establishmentId);
}

function emitTablesChanged(establishmentId, roomId) {
  emitToEstablishment(establishmentId, 'tables:changed', {
    roomId: roomId ? String(roomId) : null,
  });
}

function emitServiceChanged(establishmentId) {
  emitToEstablishment(establishmentId, 'service:changed', {});
  emitCdsChanged(establishmentId);
}

function emitServiceItemReady(userId, payload) {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit('service:item_ready', payload);
}

function emitServiceItemServed(userId, payload) {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit('service:item_served', payload);
}

function userRoom(userId) {
  return `user:${userId}`;
}

function emitLoginChallenge(userId, payload) {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit('auth:login_challenge', payload);
}

function emitLoginChallengeResolved(userId, payload) {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit('auth:login_challenge_resolved', payload);
}

function emitSessionRevoked(userId, payload) {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit('auth:session_revoked', payload);
}

module.exports = {
  setIo,
  emitKdsChanged,
  emitOrderChanged,
  emitTablesChanged,
  emitServiceChanged,
  emitServiceItemReady,
  emitServiceItemServed,
  emitLoginChallenge,
  emitLoginChallengeResolved,
  emitSessionRevoked,
};
