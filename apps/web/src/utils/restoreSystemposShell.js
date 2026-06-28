import client from '../api/client';
import { getTerminalRequestHeaders, isSystemTerminalContext } from './terminalContext';

export async function restoreSystemposShell() {
  if (!isSystemTerminalContext()) return false;

  try {
    const res = await client.post('/auth/restore-systempos-shell', {}, {
      headers: getTerminalRequestHeaders(),
    });
    return Boolean(res.data?.data?.restored_systempos);
  } catch {
    return false;
  }
}
