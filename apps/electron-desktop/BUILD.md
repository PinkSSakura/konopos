# Guide — construire l'application bureau KonoPOS



Ce guide explique comment regénérer l'installateur Windows après une modification du code (API, interface web ou shell Electron).



## Prérequis



**Pour construire** (sur votre PC de développement) :



- **Node.js 22.17+**

- `npm install` à la racine du dépôt

> Si le dossier est sur Windows mais que vous utilisez aussi WSL, construisez l'installateur depuis PowerShell/CMD Windows avec les dépendances installées par Windows. Ne mélangez pas un `node_modules` Windows avec une commande `npm` lancée dans WSL.



**Pour lancer l'installateur** (sur le PC caisse) :



- Aucun service de base de données externe requis (SQLite local)

- **Node.js non requis** — l'app utilise le runtime Node intégré à Electron



## Structure livrée



L'installateur empaquette :



| Composant | Rôle |

|-----------|------|

| Shell Electron | Tableau de bord, QR code, bouton EXIT |

| `apps/api` | Backend Express + SQLite |

| `apps/web/dist` | Interface React compilée |

| `node_modules` | Dépendances runtime de l'API |



## Étapes de build (commande unique)



À la racine du projet :



```bash

npm run build:desktop

```



Cette commande enchaîne :



1. `npm run build -w @konopos/web` — compile l'interface dans `apps/web/dist`

2. `npm run dist:win -w @konopos/electron-desktop` — produit l'installateur Windows



## Résultat



Les fichiers générés se trouvent dans :



```

release-build/

  KonoPOS-Setup-0.1.0.exe    # Installateur NSIS

  win-unpacked/                   # Version portable (sans installateur)

```



## Après installation — configuration SQLite



Au **premier lancement**, l'app crée automatiquement un fichier de configuration :



```

%APPDATA%\KonoPOS\api.env

```



1. Fermer l'app si elle tourne

2. Éditer `api.env` uniquement si vous voulez personnaliser `SQLITE_PATH` ou `JWT_SECRET`

3. Relancer KonoPOS



La base et les images uploadées sont stockées dans `%APPDATA%\KonoPOS\data\` par défaut.



## Rebuild après une modification



| Vous avez modifié… | Commande |

|--------------------|----------|

| Interface React (`apps/web`) | `npm run build:desktop` |

| API (`apps/api`) | `npm run build:desktop` (recompile aussi le web ; inutile mais sans risque) |

| Shell Electron uniquement | `npm run dist:win -w @konopos/electron-desktop` |

| Dépendances npm | `npm install` puis `npm run build:desktop` |



## Développement sans build



Pour tester sans créer d'installateur :



```bash

npm run desktop

```



L'app démarre en mode développement et lance le backend + l'interface via npm.



## Dépannage



| Problème | Piste |

|----------|-------|

| Build web échoue | Vérifier les erreurs TypeScript/ESLint dans `apps/web` |

| `electron-builder` introuvable | `npm install` à la racine |

| `EACCES` dans `node_modules\\...\\.bin` pendant `electron-builder` | `node_modules` a été créé ou modifié depuis WSL. Fermer Node/Electron, supprimer `node_modules`, puis refaire `npm install` depuis PowerShell/CMD Windows. |

| Avertissements `resources\\bundle\\node_modules\\@konopos\\web\\node_modules\\.pnpm` | Supprimer `release-build` et les `node_modules` locaux sous `apps/*`, puis relancer `npm install` depuis PowerShell/CMD Windows. |

| Installateur très volumineux | Normal : `node_modules` est inclus pour faire tourner l'API hors ligne |

| App installée ne démarre pas l'API | Vérifier `SQLITE_PATH` et les droits d'écriture dans `%APPDATA%\KonoPOS\data` |

| Port 5000 / 5173 occupé | Fermer une autre instance ou un `npm run dev` en cours |



## Versions



- Incrémenter `"version"` dans `apps/electron-desktop/package.json` avant chaque release pour nommer correctement l'installateur (`KonoPOS-Setup-x.y.z.exe`).

