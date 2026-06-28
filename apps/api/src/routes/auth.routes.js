const { auth } = require('../controllers')();
const { Router } = require('express');
const {
  login, loginPin, loginPinDirect, loginSystemPos, logout, logoutPin, me, getAccess, updateProfile, changePassword, getSystemPosStatus, getLoginOptions, respondLoginChallenge, pollLoginChallenge, restoreSystemposShell } = auth;
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/login-options', getLoginOptions);
router.get('/systempos/status', getSystemPosStatus);
router.post('/restore-systempos-shell', restoreSystemposShell);
router.post('/login', login);
router.get('/login-challenge/:id', pollLoginChallenge);
router.post('/login-challenge/:id/respond', authenticate, respondLoginChallenge);
router.post('/login/pin-direct', loginPinDirect);
router.post('/login/pin', authenticate, loginPin);
router.post('/login/systempos', loginSystemPos);
router.post('/logout', authenticate, logout);
router.post('/logout/pin', authenticate, logoutPin);
router.get('/me', authenticate, me);
router.get('/access', authenticate, getAccess);
router.patch('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
