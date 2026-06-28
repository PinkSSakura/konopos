# KonoPOS — Spécification projet

**Nom** : KonoPOS  
**Version cible** : 1.0 (restaurant / café)  
**Langue interface** : Français  
**Devise** : Dirham marocain (MAD), **prix affichés TTC** (TVA incluse)  
**Déploiement** : Réseau local (LAN), auto-hébergé, sans internet requis après installation  
**Établissements** : Un seul établissement par installation  

**Référence technique** : `C:\Users\Pink\Documents\Projects\caferesdev_final`  
Application POS existante, fonctionnelle en dev et prod. KonoPOS la reprend comme base logique, avec une **nouvelle interface shadcn/ui**, une base de données **vierge**, et des améliorations ciblées.

**Questions en attente** : voir [`QUESTIONS_PENDING.txt`](./QUESTIONS_PENDING.txt)

---

## 1. Vision

KonoPOS est une application web légère, auto-hébergée sur le réseau local d’un restaurant ou café. Elle synchronise en temps réel les postes (caisse, tablettes, écrans cuisine/bar, laptop manager) via navigateur ou application Electron.

### Objectifs

- Système unifié, adaptable à différents types d’établissements (v1 optimisé **restaurant / café**).
- Faibles exigences matérielles (mini-PC, vieux PC).
- Synchronisation temps réel sur le LAN (Socket.io).
- Rapidité, fiabilité, simplicité pour le personnel non technique.
- Design modulaire : activer / désactiver des fonctionnalités par établissement.

### « Offline » — définition retenue

**Pas de sync PWA hors réseau pour la v1.**  
« Offline » signifie : l’application fonctionne **sans connexion internet**, entièrement sur le **réseau local**. Un PC héberge l’API + SQLite ; les autres postes s’y connectent en LAN. Si le LAN est coupé, le comportement de repli reste à préciser (voir `QUESTIONS_PENDING.txt`).

---

## 2. Décisions validées

| Sujet | Décision |
|-------|----------|
| Point de départ | Reprendre la logique de `caferesdev_final`, améliorer l’UI et l’architecture frontend |
| Base de données | **Fraîche** à chaque nouvelle installation (pas de migration de données prod) |
| Tests / CI ancien projet | Non repris |
| UI | **shadcn/ui** + Tailwind (remplace Ant Design) |
| Profil métier v1 | Restaurant / café |
| Plan de salle | **Drag-and-drop** obligatoire |
| Paiement | **Une addition par table** (pas de split bill en v1) |
| À servir (`/service`) | **Oui** — file d’attente service en salle |
| Réservations | **Hors scope v1** |
| Livraison | **Oui** — type de commande utilisé dans les établissements cibles |
| Sections serveur | **Oui** — zones de tables par serveur |
| Impression cuisine/bar | **Option activable** (KDS seul, impression seule, ou les deux) |
| Langue UI | Français |
| Prix | **Dhs TTC** (TVA incluse dans les prix affichés) |
| Fiscalité Maroc | **Oui** — conformité tickets / champs légaux (détails à préciser) |
| Multi-établissement | **Non** — un établissement par install |

---

## 3. Hors scope v1

| Fonctionnalité | Statut |
|----------------|--------|
| Sync offline PWA (hors LAN) | Non — LAN uniquement |
| Réservations | Non |
| Split bill (addition séparée par convive) | Non |
| Programme fidélité | Non |
| Gestion stock / alertes / fournisseurs | Non (champ texte fournisseur sur dépenses seulement) |
| Happy hour / remises avancées | Remises basiques en caisse / analytics |
| Scanners code-barres | À confirmer (probablement hors scope restaurant v1) |
| Installateurs Mac / Linux | Windows Electron en priorité |
| Multi-établissement / chaîne | Non |

### Reporté (phases ultérieures)

- Inventaire avancé (stock, alertes, bons de commande)
- Fidélité clients
- Mode magasin / food truck (code-barres, vente rapide)
- mDNS (`konopos.local`)
- Export CSV/PDF avancé, heatmaps

---

## 4. Stack technique

| Couche | Technologie | Détail |
|--------|-------------|--------|
| Runtime | **Node.js** ≥ 22.17 | Requis pour `node:sqlite` |
| Base de données | **SQLite** | Fichier local, WAL ; pas de serveur DB externe |
| Backend | **Express 5** + `node:sqlite` | Port `5000`, écoute `0.0.0.0` |
| Temps réel | **Socket.io 4.8** | KDS, commandes, tables, service |
| Frontend | **React 18** + **Vite 6** | Port `5173` |
| UI | **shadcn/ui** + **Tailwind CSS v4** | Composants en source, design system moderne |
| HTTP client | **Axios** | Proxy `/api` et `/socket.io` via Vite |
| Auth | **JWT** + sessions PIN | Bearer token, SystemPOS + PIN serveurs |
| Routing | **React Router 7** | SPA |
| Monorepo | **npm workspaces** | `apps/api`, `apps/web`, `apps/electron-desktop` |
| Bureau (optionnel) | **Electron 36** + electron-builder | Lance API + web, QR réseau local, `.exe` Windows |
| Impression | **ESC/POS** réseau | IP + port 9100 |

### Améliorations prévues vs `caferesdev_final`

- Interface **shadcn/ui** : plus moderne, accessible, thème personnalisable
- Nommage cohérent `@konopos/*` (packages workspace)
- Documentation unique (`project.md` + `QUESTIONS_PENDING.txt`)
- Options impression / KDS plus explicites dans les paramètres établissement
- Sections serveur et livraison intégrées dès la conception v1
- Conformité fiscale Maroc documentée et implémentée

---

## 5. Structure du dépôt

```
KonoPOS/
├── apps/
│   ├── api/                    # Backend Express + SQLite + Socket.io
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── db/             # Schéma, migrations code, ORM SQLite
│   │   │   ├── middleware/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── seeds/
│   │   │   ├── services/
│   │   │   ├── constants/
│   │   │   ├── app.js
│   │   │   ├── index.js
│   │   │   └── websocket.js
│   │   ├── data/               # Fichier SQLite (gitignored)
│   │   └── .env.example
│   ├── web/                    # Frontend React + shadcn/ui
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── ui/         # Composants shadcn
│   │   │   ├── pages/
│   │   │   ├── context/
│   │   │   ├── api/
│   │   │   ├── hooks/
│   │   │   ├── utils/
│   │   │   └── lib/
│   │   ├── components.json     # Config shadcn
│   │   └── vite.config.js
│   └── electron-desktop/       # Shell Electron (Windows)
│       ├── main.js
│       └── lib/
├── docs/                       # Guides opérationnels (futur)
├── backups/                    # Sauvegardes SQLite (futur)
├── package.json                # Workspaces racine
├── project.md                  # Ce fichier
└── QUESTIONS_PENDING.txt       # Questions ouvertes
```

---

## 6. Base de données

Moteur : **SQLite** via `node:sqlite` (`DatabaseSync`).  
Migrations : **code-driven** dans `apps/api/src/db/modelSchemas.js` (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`, version `schema_migrations`).

### Tables (22 entités — héritées de la référence)

| Table | Domaine |
|-------|---------|
| `establishments` | Config établissement, imprimantes, flags KDS/impression, TVA, thème |
| `roles` | `role_key` : superadmin, owner, manager, submanager, waiter, barman, cook, systempos |
| `permissions` | Codes RBAC granulaires |
| `role_permissions` | Liaison rôle ↔ permission |
| `users` | Identifiants, PIN hash, `is_system_pos` |
| `user_sessions` | Sessions JWT actives |
| `shifts` | Pointage, tiroir-caisse |
| `audit_logs` | Journal d’audit |
| `rooms` | Salles du plan de salle |
| `tables` | Tables, statut, position (drag-and-drop), fusion |
| `categories` | Catégories menu |
| `subcategories` | Sous-catégories |
| `menu_items` | Articles, variantes, type FOOD/DRINK |
| `extras` | Suppléments / modificateurs |
| `orders` | Commandes, totaux, statut paiement, type (sur place / emporter / livraison) |
| `order_items` | Lignes commande, statut KDS |
| `payments` | Encaissements, annulations, reçus |
| `customers` | Clients réguliers |
| `daily_closings` | Clôture journalière |
| `expenses` | Dépenses (fournisseur en texte libre) |
| `shift_plans` | Planning shifts |

### Champs transverses

- Soft delete : `is_deleted`
- Audit : `created_by`, `updated_by`, `created_at`, `updated_at`

### Extensions v1 prévues

- **Sections serveur** : liaison tables ↔ serveur / zone (détails dans `QUESTIONS_PENDING.txt`)
- **Livraison** : adresse, frais, statuts (détails à préciser)
- **Fiscalité Maroc** : numérotation tickets, champs légaux sur reçu (ICE, IF, RC, patente…)
- **Options impression** : flags établissement pour activer/désactiver impression cuisine, bar, KDS

---

## 7. API REST

Préfixe : `/api`  
Authentification : `Authorization: Bearer <JWT>`  
Middleware courant : `authenticate`, `requirePermission`, `requireOpenShift`, `blockKitchenStaff`

### Modules de routes

| Préfixe | Description |
|---------|-------------|
| `/health` | Santé API + IPs LAN |
| `/setup` | Statut installation initiale |
| `/auth` | Login, SystemPOS, PIN, logout, `/me` |
| `/establishment` | Config établissement, logo |
| `/menu` | Catégories, sous-catégories, articles, extras + uploads |
| `/rooms` | CRUD salles |
| `/tables` | CRUD tables, merge, split, assignation commandes |
| `/orders` | Cycle de vie commandes, envoi cuisine, checkout, impression |
| `/payments` | À encaisser, historique, clôture jour, annulation |
| `/customers` | Clients réguliers |
| `/expenses` | Dépenses |
| `/kds` | Écrans cuisine / bar |
| `/service` | File « à servir » en salle |
| `/shifts` | Pointage personnel |
| `/shift-admin` | Planning admin |
| `/admin` | Utilisateurs, rôles, permissions (Super Admin) |
| `/analytics` | Tableau de bord |
| `/uploads` | Fichiers statiques (images) |

### Commandes — endpoints clés

```
GET    /api/orders
GET    /api/orders/:id
POST   /api/orders
PUT    /api/orders/:id
POST   /api/orders/:id/cancel
POST   /api/orders/:id/send
POST   /api/orders/:id/checkout
POST   /api/orders/:id/print-kitchen
POST   /api/orders/:id/print-caisse
POST   /api/orders/:id/mark-delivered
POST   /api/orders/:id/items
PUT    /api/orders/:id/items/:itemId
DELETE /api/orders/:id/items/:itemId
```

---

## 8. Temps réel (Socket.io)

Connexion : `handshake.auth.token` (même JWT)  
Room : `est:{establishmentId}`  
Modèle : **serveur → client uniquement**

| Événement | Payload | Déclenché par |
|-----------|---------|---------------|
| `kds:changed` | `{ productType }` | Envoi cuisine, MAJ statut KDS |
| `order:changed` | `{ orderId }` | Commandes, paiements |
| `tables:changed` | `{ roomId }` | Assignation, fusion tables |
| `service:changed` | `{}` | Items prêts / servis |

---

## 9. Authentification

### Connexion mot de passe

1. `POST /api/auth/login` — identifiant + mot de passe
2. JWT (`sub`, `role_key`, `is_pin_session: false`)
3. Session en base (`user_sessions`) avec timeout glissant

### Terminal SystemPOS

1. Compte dédié : `role_key: systempos`, `is_system_pos: true`
2. `POST /api/auth/login/systempos` — identifiant + mot de passe
3. Session parente stockée côté client (`systempos_token`)
4. Redirection vers `/pin`

### PIN serveur (6 chiffres)

1. SystemPOS doit être connecté
2. `POST /api/auth/login/pin` — Bearer SystemPOS + `{ pin }`
3. JWT enfant : `is_pin_session: true`
4. Rôles PIN : `waiter`, `manager`, `submanager`, `cook`, `barman`
5. Verrouillage : 5 tentatives max, backoff exponentiel
6. Déconnexion PIN → restaure session SystemPOS

### Sécurité session

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `SESSION_TIMEOUT_MINUTES` | 20 | Inactivité avant déconnexion |
| `PIN_MAX_ATTEMPTS` | 5 | Tentatives PIN |
| `PIN_LOCK_BASE_SECONDS` | 30 | Base verrouillage PIN |
| `JWT_EXPIRES_IN` | 24h | Durée token standard |
| `JWT_SUPERADMIN_EXPIRES_IN` | 7d | Durée token superadmin |

---

## 10. Rôles utilisateurs

| Rôle | `role_key` | Connexion | Usage principal |
|------|------------|-----------|-----------------|
| Super Admin | `superadmin` | Identifiant + mot de passe | Config globale, utilisateurs, rôles, établissement |
| Propriétaire | `owner` | Identifiant + mot de passe | Pilotage complet, analytics, menu, caisse |
| Manager | `manager` | Identifiant + mot de passe | Opérations + admin, analytics, dépenses |
| Sous-manager | `submanager` | Identifiant + mot de passe | Opérations limitées, pas d’analytics |
| Serveur | `waiter` | PIN 6 chiffres sur SystemPOS | Prise de commande, encaissement |
| Barman | `barman` | Mot de passe ou PIN | KDS boissons (`/kds/drink`) |
| Cuisinier | `cook` | Mot de passe ou PIN | KDS plats (`/kds/food`) |
| SystemPOS | `systempos` | Identifiant + mot de passe | Terminal caisse permanent |

**Super Admin** : rôle masqué dans l’UI normale, tous les droits, créé via `npm run seed`.

**Permissions** : modifiables par Super Admin dans **Administration → Rôles & permissions**.

---

## 11. Routes frontend

### Publiques

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Connexion | Mot de passe |
| `/pin` | Clavier PIN | Session serveur sur SystemPOS |
| `/systempos` | Redirect | → `/login` |

### Protégées (layout principal)

| Route | Page | Garde / notes |
|-------|------|---------------|
| `/` | Redirect | Selon rôle |
| `/dashboard` | Tableau de bord | Permission `analytics.view` |
| `/pos` | Point de vente | Staff cuisine → KDS |
| `/orders` | Liste commandes | |
| `/shift` | Pointage | Si shift requis |
| `/menu/*` | Gestion menu | CRUD catégories, articles, extras |
| `/tables` | Plan de salle | Drag-and-drop, si tables activées |
| `/tables/new` | Nouvelle table | |
| `/kds/:type` | KDS | `food` ou `drink` |
| `/service` | À servir | File service en salle |
| `/caisse` | Encaissement | |
| `/caisse/history` | Historique paiements | |
| `/caisse/closing` | Clôture journalière | |
| `/admin/*` | Administration | Utilisateurs, rôles, dépenses, établissement |

### Redirection accueil par rôle

| Rôle | Accueil |
|------|---------|
| `systempos` | `/pin` |
| `owner`, `manager`, `submanager` | `/dashboard` |
| `cook` | `/kds/food` |
| `barman` | `/kds/drink` |
| `waiter` | `/pos` |

Si SystemPOS connecté sans session PIN → toutes les routes protégées redirigent vers `/pin`.

---

## 12. Guide opérationnel par profil

### Super Admin — première installation

1. `npm install` → `npm run seed`
2. Connexion `/login` (compte seed)
3. Créer l’établissement (**Administration → Établissement**)
4. Créer les comptes (**Administration → Utilisateurs**) :
   - Propriétaire (`owner`)
   - SystemPOS (`systempos`, **Terminal SystemPOS actif**)
   - Serveurs (`waiter`, PIN 6 chiffres)
   - Cuisinier, barman, managers selon besoin
5. Ajuster permissions (**Rôles & permissions**)

### Propriétaire

| Domaine | Écran | Actions |
|---------|-------|---------|
| Vue d’ensemble | `/dashboard` | Ventes, best-sellers, performance |
| Paramètres | Administration → Paramètres | Logo, couleurs, **Dhs TTC**, TVA, tickets, imprimantes |
| Menu | `/menu` | Catégories, articles FOOD/DRINK, variantes, extras |
| Salle | `/tables` | Salles, tables drag-and-drop, sections serveur |
| Équipe | Administration → Planning | Shifts planifiés |
| Finances | `/caisse/closing` | Clôture journalière |
| Dépenses | Administration → Dépenses | Saisie (fournisseur texte) |
| Clients | Administration → Clients | Fiches clients réguliers |

Le propriétaire **ne gère pas** les utilisateurs ni les rôles.

### SystemPOS — journée type

1. Ouvrir l’app (navigateur ou Electron) sur le PC caisse
2. `/login` avec compte SystemPOS
3. Redirection `/pin` — serveur entre son PIN
4. Travail : `/pos`, `/orders`, `/service`, `/caisse`
5. Déconnexion serveur → retour `/pin` (SystemPOS reste actif)
6. Serveur suivant entre son PIN

### Serveur (`waiter`)

- Uniquement via PIN sur SystemPOS
- Accès : menu (lecture), tables, commandes, **à servir**, encaissement, tickets cuisine, reçus
- Shift sur `/shift` si politique établissement l’exige

### Cuisinier / Barman

- Connexion mot de passe ou PIN
- Accueil : `/kds/food` ou `/kds/drink`
- Actions : accepter/refuser items, statuts New → Preparing → Ready
- Shift sur `/shift`

---

## 13. Fonctionnalités détaillées v1

### Menu

- Catégories, sous-catégories, articles
- Variantes (taille, supplément prix)
- Extras / modificateurs
- Type **FOOD** (cuisine) ou **DRINK** (bar)
- Images (catégories, articles, extras, logo)
- **Prix en Dhs TTC**

### Plan de salle & tables

- Salles et tables avec **position drag-and-drop**
- Assignation / désassignation commandes
- Fusion / scission tables
- **Sections serveur** (zones de tables)
- Option tables activées/désactivées (paramètres établissement)

### Commandes & POS

- Types : **sur place**, **à emporter**, **livraison**
- Panier tactile (`/pos`), mode tactile global
- Envoi cuisine/bar (selon options impression / KDS)
- Modification, annulation
- Liste commandes (`/orders`)
- **À servir** (`/service`) — service en salle
- **Paiement par table** (pas de split en v1)

### KDS

- `/kds/food` — cuisine
- `/kds/drink` — bar
- Filtrage FOOD / DRINK
- Acceptation / refus items
- Temps réel Socket.io

### Impression (configurable)

| Option | Description |
|--------|-------------|
| KDS seul | Écran cuisine/bar uniquement |
| Impression seule | Tickets réseau ESC/POS |
| Les deux | KDS + impression |

- Tickets cuisine et bar
- Reçu client avec mention **REIMPRESSION** si réimpression
- Imprimantes réseau (IP, port 9100)
- En-tête / pied de ticket personnalisables

### Caisse & paiements

- File **à encaisser** (`/caisse`)
- Historique paiements
- Clôture journalière
- Espèces / carte
- Paiements partiels (`partial`)
- Annulation paiement (rôles autorisés)

### Shifts

- Pointage entrée/sortie (`/shift`)
- Planning admin (`/admin/shifts`)
- Verrouillage navigation si shift requis et non ouvert
- Ouverture auto à la connexion PIN SystemPOS (selon politique)

### Analytics

- Tableau de bord owner/manager
- Ventes, périodes, remises, performance staff
- Permission `analytics.view`

### Administration

- Établissement, paramètres, clients réguliers
- Dépenses
- Utilisateurs et rôles (Super Admin uniquement)

---

## 14. Fiscalité Maroc (à implémenter)

Conformité requise pour les tickets de caisse. **Détails à valider** dans `QUESTIONS_PENDING.txt` :

- Numérotation séquentielle des tickets
- Champs légaux : ICE, IF, RC, patente, adresse établissement
- Type d’imprimante : thermique classique vs fiscale certifiée
- TVA : taux unique ou ventilation 10 % / 20 % sur ticket
- Affichage **montants TTC** (prix menu déjà TTC)

---

## 15. Variables d’environnement

Fichier : `apps/api/.env` (voir `.env.example`)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NODE_ENV` | `development` / `production` | `development` |
| `PORT` | Port API | `5000` |
| `HOST` | Interface d’écoute | `0.0.0.0` |
| `SQLITE_PATH` | Fichier SQLite | `apps/api/data/konopos.sqlite3` |
| `JWT_SECRET` | Secret JWT | **À changer en production** |
| `JWT_EXPIRES_IN` | Durée token | `24h` |
| `JWT_SUPERADMIN_EXPIRES_IN` | Token superadmin | `7d` |
| `SESSION_TIMEOUT_MINUTES` | Timeout inactivité | `20` |
| `PIN_MAX_ATTEMPTS` | Tentatives PIN | `5` |
| `PIN_LOCK_BASE_SECONDS` | Verrouillage PIN | `30` |
| `CORS_ORIGIN` | Origine web | `http://localhost:5173` |
| `ALLOW_LAN_CORS` | CORS IP LAN | `true` en dev |
| `SUPERADMIN_USERNAME` | Compte seed | `superadmin` |
| `SUPERADMIN_PASSWORD` | Mot de passe seed | *(voir .env.example)* |
| `SUPERADMIN_FULLNAME` | Nom affiché | `Super Admin` |
| `SUPERADMIN_EMAIL` | Email seed | `superadmin@local.pos` |

### Variables Electron / données

| Variable | Description |
|----------|-------------|
| `KONOPOS_DATA_DIR` | Répertoire données (SQLite, uploads) |
| `KONOPOS_ENV_FILE` | Chemin `.env` personnalisé |

### Variables frontend (Vite)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base API (défaut `/api`) |
| `VITE_SOCKET_URL` | Origine Socket.io |
| `VITE_API_PROXY_TARGET` | Cible proxy dev (`http://127.0.0.1:5000`) |
| `PORT` | Port Vite (défaut `5173`) |

---

## 16. Installation & scripts

### Prérequis

- Node.js ≥ 22.17
- npm (workspaces)

### Commandes racine

```bash
npm install          # Installe tous les workspaces
npm run dev          # API + web en parallèle
npm run dev:api      # API seule
npm run dev:web      # Web seule
npm run seed         # Bootstrap rôles, permissions, superadmin
npm run build        # Build frontend
npm run build:desktop  # Build web + installateur Windows
npm run desktop      # Electron en dev
```

### Flux opérationnel

```
Installation → seed → Super Admin crée établissement + utilisateurs
                ↓
Owner configure menu, paramètres, plan de salle, shifts
                ↓
SystemPOS sur PC caisse → serveurs PIN → POS / caisse / service
                ↓
Cuisine/Bar KDS · Managers dashboard · Clôture fin de journée
```

### Production typique

- **PC caisse** : Electron packagé (API + SQLite + web) ou `npm run dev`
- **Tablettes / KDS / manager** : navigateur → `http://<IP-LAN>:5173`
- QR code réseau affiché dans l’app Electron

---

## 17. Sécurité

1. **Auth** : PIN + mot de passe, RBAC granulaire
2. **Réseau** : LAN isolé ; HTTPS auto-signé (à confirmer)
3. **Données** : sauvegardes SQLite automatisées (futur), audit logs
4. **Validation** : sanitization entrées, requêtes paramétrées
5. **Physique** : auto-logout, clôture caisse, verrouillage PIN
6. **Sessions** : JWT + tracking en base, timeout glissant

---

## 18. Roadmap

### Phase 1 — v1 Restaurant / Café (en cours)

- [ ] Monorepo KonoPOS (`apps/api`, `apps/web`, `apps/electron-desktop`)
- [ ] Port backend depuis `caferesdev_final` (rebrand `@konopos/api`)
- [ ] Frontend shadcn/ui : auth, layout, navigation
- [ ] POS tactile + panier
- [ ] Menu CRUD
- [ ] Plan de salle drag-and-drop + sections serveur
- [ ] KDS cuisine / bar
- [ ] À servir (`/service`)
- [ ] Caisse + clôture jour
- [ ] Livraison (type commande + flux de base)
- [ ] Impression configurable (KDS / print / both)
- [ ] Fiscalité Maroc (tickets)
- [ ] Analytics dashboard
- [ ] Electron Windows

### Phase 2

- Inventaire & stock
- Rapports export CSV/PDF
- Sauvegardes automatisées
- HTTPS LAN / mDNS

### Phase 3

- Fidélité clients
- Réservations
- Adaptations food store / food truck
- Installateurs Mac / Linux

---

## 19. Matériel recommandé

| Poste | Recommandation |
|-------|----------------|
| Serveur / caisse | Mini-PC ou PC tactile |
| Terminaux service | Tablettes ou PC tactile + navigateur |
| Cuisine / bar | Écran dédié ou tablette murale |
| Imprimantes | Thermiques réseau ESC/POS (port 9100) |
| Réseau | LAN filaire ou Wi-Fi stable ; pas d’internet requis |

---

## 20. Référence — fichiers clés `caferesdev_final`

| Élément | Chemin référence |
|---------|------------------|
| Schéma DB | `apps/api/src/db/modelSchemas.js` |
| ORM SQLite | `apps/api/src/db/sqliteModel.js` |
| Seed | `apps/api/src/seeds/` |
| Auth | `apps/api/src/services/auth.service.js` |
| Routes | `apps/api/src/routes/index.js` |
| WebSocket | `apps/api/src/websocket.js` |
| Router frontend | `apps/web/src/App.jsx` |
| Plan de salle | `apps/web/src/pages/FloorPlanPage` (référence drag-and-drop) |
| Electron | `apps/electron-desktop/main.js` |

---

*Dernière mise à jour : 16 juin 2026*
