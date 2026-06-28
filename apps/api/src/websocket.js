const { Server } = require('socket.io');
const { User, UserSession, Establishment } = require('./models');
const { auth: authService, notify } = require('./services')();
const { isCdsUnlocked } = require('./services/cds');
const { verifyToken } = authService;
const { setIo } = notify;
const { authcookie, cors } = require('./utils')();
const { parseCookies, COOKIE_NAME } = authcookie;
const { createCorsOptions } = cors;

function cdsRoom(establishmentId) {
  return `cds:${establishmentId}`;
}

function getSocketToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const cookies = parseCookies({ headers: { cookie: socket.handshake.headers.cookie } });
  return cookies[COOKIE_NAME] || null;
}

function initWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: createCorsOptions(),
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      if (socket.handshake.auth?.cds === true) {
        const establishment = await Establishment.findOne({ is_deleted: false });
        if (!establishment) return next(new Error('Établissement indisponible.'));
        const unlocked = await isCdsUnlocked(establishment._id);
        if (!unlocked) return next(new Error('Écran client verrouillé.'));
        socket.isCds = true;
        socket.establishmentId = String(establishment._id);
        return next();
      }

      const token = getSocketToken(socket);
      if (!token) return next(new Error('Authentification requise.'));

      const payload = verifyToken(token);
      const session = await UserSession.findOne({ session_token: token, is_active: true });
      if (!session) return next(new Error('Session expirée ou invalide.'));

      const user = await User.findById(payload.sub).populate('role').populate('establishment');
      if (!user || user.is_deleted || !user.is_active || user.status !== 'actif') {
        return next(new Error('Utilisateur invalide.'));
      }

      const estId = user.establishment?._id || user.establishment;
      socket.user = user;
      socket.userId = String(user._id);
      socket.establishmentId = estId ? String(estId) : null;
      return next();
    } catch {
      return next(new Error('Jeton invalide.'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.isCds) {
      if (socket.establishmentId) {
        socket.join(cdsRoom(socket.establishmentId));
      }
      return;
    }

    socket.join(`user:${socket.userId}`);
    if (socket.establishmentId) {
      socket.join(`est:${socket.establishmentId}`);
    }
  });

  setIo(io);
  return io;
}

module.exports = { initWebSocket };
