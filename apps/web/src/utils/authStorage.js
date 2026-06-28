/** Remove legacy client-side auth secrets (migrated to HttpOnly cookies). */
export function clearLegacyAuthStorage() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('is_pin_session');
    localStorage.removeItem('systempos_token');
    localStorage.removeItem('systempos_user');
  } catch {
    /* ignore */
  }
}
