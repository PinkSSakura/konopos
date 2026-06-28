const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  host: process.env.HOST || '0.0.0.0',
  sqlitePath: process.env.SQLITE_PATH,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  licenseSigningSecret: process.env.LICENSE_SIGNING_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production',
  licenseEncryptionSecret: process.env.LICENSE_ENCRYPTION_SECRET || process.env.LICENSE_SIGNING_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production',
  sessionTimeoutMinutes: Number(process.env.SESSION_TIMEOUT_MINUTES) || 20,
  /** SystemPOS shell (login caisse, écran PIN) — déconnexion après inactivité */
  systemposSessionTimeoutMinutes: Number(process.env.SYSTEMPOS_SESSION_TIMEOUT_MINUTES) || 60,
  /** Connexion PIN depuis /login — inactivité glissante (1 min 45 s) */
  directPinSessionTimeoutSeconds: Number(process.env.DIRECT_PIN_SESSION_TIMEOUT_SECONDS) || 105,
  pinMaxAttempts: Number(process.env.PIN_MAX_ATTEMPTS) || 5,
  /** Première verrouillage PIN (secondes) après 5 échecs ; double à chaque cycle suivant */
  pinLockBaseSeconds: Number(process.env.PIN_LOCK_BASE_SECONDS) || 30,
  systemPosSessionHours: Number(process.env.SYSTEMPOS_SESSION_HOURS) || 16,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:noreply@konopos.local',
  /** Autorise les origines 192.168.x.x / 10.x.x.x (défaut: oui en dev, non en prod) */
  allowLanCors:
    process.env.ALLOW_LAN_CORS === 'true'
    || (process.env.ALLOW_LAN_CORS !== 'false' && process.env.NODE_ENV !== 'production'),
  defaultMainColor: '#fc2c46',
  defaultSecondaryColor: '#f5f5f5',
  defaultCurrency: 'MAD',
};

module.exports = config;
