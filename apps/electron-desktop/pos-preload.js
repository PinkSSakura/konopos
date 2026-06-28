const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('TouDevShell', {
  reload: () => ipcRenderer.invoke('pos-reload'),
  stop: () => ipcRenderer.invoke('pos-close'),
});

function injectPosToolbar() {
  if (document.getElementById('kono-pos-shell-root')) return;

  const style = document.createElement('style');
  style.textContent = `
    #kono-pos-shell-root {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      font-family: "Segoe UI", system-ui, sans-serif;
      pointer-events: none;
    }
    #kono-pos-shell-root * {
      pointer-events: auto;
    }
    #kono-pos-shell-menu {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      opacity: 0;
      transform: translateY(8px) scale(0.96);
      transform-origin: bottom right;
      visibility: hidden;
      transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
    }
    #kono-pos-shell-root.is-open #kono-pos-shell-menu {
      opacity: 1;
      transform: translateY(0) scale(1);
      visibility: visible;
    }
    .kono-pos-shell-action {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 42px;
      padding: 0 14px 0 12px;
      border: none;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      color: #34373c;
      background: #fff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      white-space: nowrap;
    }
    .kono-pos-shell-action:hover {
      filter: brightness(1.03);
    }
    .kono-pos-shell-action--reload {
      background: #c2462d;
    }
    .kono-pos-shell-action--stop {
      color: #991b1b;
    }
    .kono-pos-shell-action svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    #kono-pos-shell-toggle {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      color: #fff;
      background: rgba(52, 55, 60, 0.94);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.18s ease, background 0.18s ease;
    }
    #kono-pos-shell-toggle:hover {
      background: rgba(52, 55, 60, 1);
    }
    #kono-pos-shell-root.is-open #kono-pos-shell-toggle {
      transform: rotate(45deg);
      background: #34373c;
    }
    #kono-pos-shell-toggle svg {
      width: 20px;
      height: 20px;
    }
  `;
  document.head.appendChild(style);

  const icons = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  };

  const root = document.createElement('div');
  root.id = 'kono-pos-shell-root';
  root.setAttribute('aria-label', 'Contrôles POS');

  const menu = document.createElement('div');
  menu.id = 'kono-pos-shell-menu';
  menu.setAttribute('role', 'menu');

  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'kono-pos-shell-action kono-pos-shell-action--reload';
  reloadBtn.title = 'Recharger la page (F5)';
  reloadBtn.setAttribute('role', 'menuitem');
  reloadBtn.innerHTML = `${icons.reload}<span>Recharger</span>`;
  reloadBtn.addEventListener('click', () => {
    closeMenu();
    ipcRenderer.invoke('pos-reload');
  });

  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.className = 'kono-pos-shell-action kono-pos-shell-action--stop';
  stopBtn.title = 'Fermer la fenêtre POS';
  stopBtn.setAttribute('role', 'menuitem');
  stopBtn.innerHTML = `${icons.stop}<span>Arrêter</span>`;
  stopBtn.addEventListener('click', () => {
    closeMenu();
    ipcRenderer.invoke('pos-close');
  });

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'kono-pos-shell-toggle';
  toggle.title = 'Contrôles POS';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-haspopup', 'menu');
  toggle.innerHTML = icons.plus;

  menu.append(reloadBtn, stopBtn);
  root.append(menu, toggle);
  document.body.appendChild(root);

  function openMenu() {
    root.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    root.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    if (root.classList.contains('is-open')) closeMenu();
    else openMenu();
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu();
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

window.addEventListener('DOMContentLoaded', injectPosToolbar);
