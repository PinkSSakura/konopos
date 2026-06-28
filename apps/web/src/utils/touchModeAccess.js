/** Mode tactile global — tous les rôles (terminal SystemPOS forcé via TouchModeContext). */

export function canToggleTouchMode(roleKey) {
  if (roleKey === 'systempos') return false;
  return true;
}
