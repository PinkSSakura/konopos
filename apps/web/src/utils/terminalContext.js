const TERMINAL_FLAG = 'TouDev_system_terminal';

function readFlag(storage) {
  try {
    return storage.getItem(TERMINAL_FLAG) === '1';
  } catch {
    return false;
  }
}

export function markSystemTerminal() {
  try {
    sessionStorage.setItem(TERMINAL_FLAG, '1');
    localStorage.setItem(TERMINAL_FLAG, '1');
  } catch {
    /* ignore */
  }
}

export function clearSystemTerminal() {
  try {
    sessionStorage.removeItem(TERMINAL_FLAG);
    localStorage.removeItem(TERMINAL_FLAG);
  } catch {
    /* ignore */
  }
}

export function isSystemTerminalContext() {
  return readFlag(sessionStorage) || readFlag(localStorage);
}

export function getTerminalRequestHeaders() {
  const headers = {};
  if (isSystemTerminalContext()) {
    headers['X-TouDev-Terminal'] = 'systempos';
  }
  return headers;
}
