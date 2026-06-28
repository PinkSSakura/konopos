# TouDev

Local POS app for restaurants and cafés.

- Backend: Express + SQLite (`node:sqlite`)
- Web: React + Vite + shadcn/ui
- Desktop: Electron + electron-builder

Windows installer releases: [GitHub Releases](https://github.com/PinkSSakura/konopos/releases)

## Important

Run `npm` commands from **Windows PowerShell/CMD**, not WSL. Mixing WSL and Windows `node_modules` can break native binaries and Electron packaging.

```powershell
cd "C:\Users\Pink\Documents\Projects\KonoPOS"
```

## First Install

```powershell
npm install
copy apps\api\.env.example apps\api\.env
npm run seed
```

## Test In Browser

Start API + web together:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

Default seeded login:

```text
username: superadmin
password: SuperAdmin@123
```

API runs on:

```text
http://localhost:5000
```

## Run Electron In Dev

```powershell
npm run desktop
```

## Build The Windows EXE Installer

```powershell
npm run build:desktop
```

Output:

```text
release-build\TouDev-Setup-<version>.exe
release-build\win-unpacked\
```

Publish to GitHub:

```powershell
npm run publish:desktop
```

## Installed App Data

```powershell
explorer "$env:APPDATA\TouDev\data"
```

SQLite DB path:

```text
%APPDATA%\TouDev\data\konopos.sqlite3
```

Installed config file:

```text
%APPDATA%\TouDev\api.env
```

## Useful Commands

```powershell
npm run dev:api        # API only
npm run dev:web        # Web only
npm run build          # Web production build only
npm run seed           # Seed roles, permissions, superadmin
npm run build:desktop  # Full Windows installer build
npm run publish:desktop # Build + publish to GitHub Releases
```

## More Desktop Build Notes

See `apps/electron-desktop/BUILD.md`.
