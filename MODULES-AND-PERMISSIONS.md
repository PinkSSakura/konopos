# KonoPOS — Modules, rôles & permissions

> Rebuilt from `tables.txt` via `apps/api/src/seeds/permissions.catalog.js`.
> **Runtime key:** `slug` (ex. `order_create`). **DB code:** `PREFIX-00001` (ex. `ORD-00004`).
> **Default grants:** only **Super Admin** at seed — assign other roles in **Rôles & permissions**.

| Élément | Valeur |
|---------|--------|
| Permissions | **138** |
| Rôles | **8** |
| SA default grants | **All permissions** |
| Other roles default grants | **None** (configure in UI) |

## Rôles

| role_key | display_name | Type | code_role |
|----------|--------------|------|-----------|
| `superadmin` | SUPERADMIN | `backoffice` | `SA00000` |
| `owner` | PROPRIÉTAIRE | `backoffice` | `OW00000` |
| `manager` | MANAGER | `backoffice` | `MG00000` |
| `submanager` | SOUS-MANAGER | `backoffice` | `SM00000` |
| `waiter` | SERVEUR | `frontoffice` | `WT00000` |
| `barman` | BARMAN | `frontoffice` | `BR00000` |
| `cook` | CUISINIER | `frontoffice` | `CK00000` |
| `systempos` | SYSTEMPOS | `systemoffice` | `SY00000` |

---

## Modules & permissions

### Journal équipe (`activity`) — Back-office

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `ACT-00001` | `activity_view` | Voir journal activité équipe | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Analytics (`analytics`) — Back-office / staff

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `ANA-00001` | `view_dashboard` | Tableau de bord business | `superadmin`, `owner`, `manager`, `submanager` |
| `ANA-00002` | `self_dashboard` | Tableau de bord personnel | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ANA-00003` | `export_pdf` | Export PDF analytics | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Audit (`audit`) — Back-office

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `AUD-00001` | `audit_view` | Voir journal audit système | `superadmin`, `owner` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Backup (`backup`) — Système

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `BAK-00001` | `backup_export` | Exporter sauvegarde | `superadmin` |
| `BAK-00002` | `backup_import` | Importer sauvegarde | `superadmin` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Catalogue POS (`catalog`) — Opérations

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `CTL-00001` | `catalog_view` | Voir catalogue (POS/KDS) | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `systempos` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Clients (`clients`) — Caisse / admin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `CLI-00001` | `client_view` | Voir clients | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CLI-00002` | `client_create` | Créer client | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CLI-00003` | `client_update` | Modifier client | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CLI-00004` | `client_softdelete` | Supprimer client | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CLI-00005` | `client_restore` | Restaurer client | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CLI-00006` | `client_view_deleted` | Voir clients supprimés | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CLI-00007` | `client_manage_savings` | Gérer épargne client | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CLI-00008` | `client_manage_debt` | Gérer dette client | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Établissement (`establishment`) — Admin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `EST-00001` | `establishment_view` | Voir établissement | `superadmin`, `owner`, `manager`, `submanager` |
| `EST-00002` | `establishment_update` | Modifier établissement | `superadmin`, `owner`, `manager`, `submanager` |
| `EST-00003` | `establishment_upload_image` | Logo établissement | `superadmin`, `owner`, `manager`, `submanager` |
| `EST-00004` | `establishment_legal_update` | Infos légales / fiscales | `superadmin`, `owner`, `manager`, `submanager` |
| `EST-00005` | `establishment_options_update` | Options métier (tables, KDS, shifts) | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Dépenses (`expenses`) — Admin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `EXP-00001` | `expense_view` | Voir dépenses | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXP-00002` | `expense_create` | Créer dépense | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXP-00003` | `expense_update` | Modifier dépense | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXP-00004` | `expense_softdelete` | Supprimer dépense | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXP-00005` | `expense_restore` | Restaurer dépense | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXP-00006` | `expense_view_deleted` | Voir dépenses supprimées | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Salles (floor) (`floor`) — Salle

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `FLR-00001` | `floor_create` | Créer salle | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `FLR-00002` | `floor_update` | Modifier salle | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `FLR-00003` | `floor_delete` | Supprimer salle | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `FLR-00004` | `floor_view` | Voir salles | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### KDS (`kds`) — Production

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `KDS-00001` | `kds_food` | Écran cuisine | `superadmin`, `owner`, `manager`, `submanager`, `cook`, `systempos` |
| `KDS-00002` | `kds_drink` | Écran bar | `superadmin`, `owner`, `manager`, `submanager`, `barman`, `systempos` |
| `KDS-00003` | `kds_both` | Écran cuisine + bar | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `systempos` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Licence (`license`) — Admin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `LIC-00001` | `license_view` | Voir licence | `superadmin`, `owner`, `manager`, `submanager` |
| `LIC-00002` | `license_activate` | Activer licence | `superadmin` |
| `LIC-00003` | `license_revoke` | Révoquer licence | `superadmin` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Menu (`menu`) — Back-office / frontoffice

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `CAT-00001` | `category_view` | Voir catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CAT-00002` | `category_create` | Créer catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CAT-00003` | `category_update` | Modifier catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CAT-00004` | `category_softdelete` | Supprimer catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CAT-00005` | `category_restore` | Restaurer catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CAT-00006` | `category_view_deleted` | Voir catégorie supprimés | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `CAT-00007` | `category_upload_image` | Image catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `SUB-00001` | `subcategory_view` | Voir sous-catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `SUB-00002` | `subcategory_create` | Créer sous-catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `SUB-00003` | `subcategory_update` | Modifier sous-catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `SUB-00004` | `subcategory_softdelete` | Supprimer sous-catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `SUB-00005` | `subcategory_restore` | Restaurer sous-catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `SUB-00006` | `subcategory_view_deleted` | Voir sous-catégorie supprimés | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `SUB-00007` | `subcategory_upload_image` | Image sous-catégorie | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXT-00001` | `extra_view` | Voir extra | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXT-00002` | `extra_create` | Créer extra | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXT-00003` | `extra_update` | Modifier extra | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXT-00004` | `extra_softdelete` | Supprimer extra | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXT-00005` | `extra_restore` | Restaurer extra | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXT-00006` | `extra_view_deleted` | Voir extra supprimés | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `EXT-00007` | `extra_upload_image` | Image extra | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ITM-00001` | `item_view` | Voir article | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ITM-00002` | `item_create` | Créer article | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ITM-00003` | `item_update` | Modifier article | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ITM-00004` | `item_softdelete` | Supprimer article | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ITM-00005` | `item_restore` | Restaurer article | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ITM-00006` | `item_view_deleted` | Voir article supprimés | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `ITM-00007` | `item_upload_image` | Image article | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Commandes (`orders`) — POS

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `ORD-00001` | `order_view` | Voir commandes | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00002` | `order_history` | Historique commandes | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00003` | `order_view_all` | Voir toutes les commandes | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00004` | `order_create` | Créer commande | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00005` | `order_update` | Modifier commande | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00006` | `order_cancel` | Annuler commande | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00007` | `order_send` | Envoyer cuisine / bar | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00008` | `order_mark_served` | Marquer servi | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00009` | `order_mark_cancelled` | Marquer annulé | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00010` | `order_item_void` | Annuler article servi / correction | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman`, `systempos` |
| `ORD-00011` | `order_update_all` | Modifier toute commande (tous serveurs) | `superadmin`, `owner`, `manager`, `submanager` |
| `ORD-00012` | `order_cancel_all` | Annuler toute commande (tous serveurs) | `superadmin`, `owner`, `manager`, `submanager` |
| `ORD-00013` | `order_send_all` | Envoyer cuisine — toute commande | `superadmin`, `owner`, `manager`, `submanager` |
| `ORD-00014` | `order_mark_served_all` | Service — toute commande | `superadmin`, `owner`, `manager`, `submanager` |
| `ORD-00015` | `order_print_all` | Imprimer — toute commande | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Paiements (`payments`) — Caisse

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `PAY-00001` | `payment_process` | Encaisser | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `systempos` |
| `PAY-00002` | `payment_history` | Historique paiements | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `systempos` |
| `PAY-00003` | `payment_day_close` | Clôture journalière | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `systempos` |
| `PAY-00004` | `payment_cancel` | Annuler paiement | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `systempos` |
| `PAY-00005` | `payment_code_lookup` | Recherche par code du jour | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `systempos` |
| `PAY-00006` | `payment_process_all` | Encaisser — toute commande | `superadmin`, `owner`, `manager`, `submanager` |
| `PAY-00007` | `payment_cancel_all` | Annuler paiement — toute commande | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Permissions (`permissions`) — Admin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `PRM-00001` | `permission_view` | Voir matrice permissions | `superadmin`, `owner`, `manager`, `submanager` |
| `PRM-00002` | `permission_assign` | Attribuer permissions | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Imprimantes & tickets (`printers`) — POS / admin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `PRT-00001` | `printer_create` | Créer imprimante | `superadmin`, `owner`, `manager`, `submanager` |
| `PRT-00002` | `printer_update` | Modifier imprimante | `superadmin`, `owner`, `manager`, `submanager` |
| `PRT-00003` | `printer_delete` | Supprimer imprimante | `superadmin`, `owner`, `manager`, `submanager` |
| `PRT-00004` | `printer_view` | Voir imprimantes | `superadmin`, `owner`, `manager`, `submanager` |
| `PRT-00005` | `printer_print_preview` | Aperçu impression | `superadmin`, `owner`, `manager`, `submanager` |
| `PRN-00001` | `print_receipt` | Imprimer ticket caisse | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00002` | `print_payment_receipt` | Imprimer ticket paiement | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00003` | `print_reprint` | Réimprimer | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00004` | `print_kitchen` | Imprimer bon cuisine | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00005` | `print_bar` | Imprimer bon bar | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00006` | `print_kitchen_bar` | Imprimer bon cuisine/bar | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00007` | `print_daily_code` | Imprimer code du jour | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00008` | `print_order` | Imprimer commande | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00009` | `print_close_report` | Imprimer rapport clôture | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00010` | `print_close_report_waiters` | Rapport clôture serveurs | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00011` | `print_close_report_barmans` | Rapport clôture bar | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `PRN-00012` | `print_close_report_cooks` | Rapport clôture cuisine | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Rapports (`reports`) — Admin / staff

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `RPT-00001` | `report_export_staff` | Export PDF personnel (équipe) | `superadmin`, `owner`, `manager`, `submanager` |
| `RPT-00002` | `report_self_export` | Export PDF personnel (soi) | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Rôles (`roles`) — Superadmin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `ROL-00001` | `role_create` | Créer rôle | `superadmin` |
| `ROL-00002` | `role_update` | Modifier rôle | `superadmin` |
| `ROL-00003` | `role_delete` | Supprimer rôle | `superadmin` |
| `ROL-00004` | `role_assign` | Attribuer rôle | `superadmin` |
| `ROL-00005` | `role_restore` | Restaurer rôle | `superadmin` |
| `ROL-00006` | `role_view_deleted` | Voir rôles supprimés | `superadmin` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Shifts (`shifts`) — Opérations

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `SHF-00001` | `shift_view_all` | Voir tous les shifts | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `SHF-00002` | `shift_view_own` | Voir son shift | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `SHF-00003` | `shift_history` | Historique shifts | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `SHF-00004` | `shift_plan_view` | Voir planning shifts | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `SHF-00005` | `shift_plan_create` | Créer planning | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `SHF-00006` | `shift_plan_update` | Modifier planning | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `SHF-00007` | `shift_plan_delete` | Supprimer planning | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Tables (`tables`) — Salle

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `TBL-00001` | `table_create` | Créer table | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `TBL-00002` | `table_update` | Modifier table | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `TBL-00003` | `table_delete` | Supprimer table | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `TBL-00004` | `table_merge` | Fusionner tables | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `TBL-00005` | `table_split` | Séparer tables | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `TBL-00006` | `table_assign` | Assigner table | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `TBL-00007` | `table_view` | Voir tables / plan | `superadmin`, `owner`, `manager`, `submanager`, `waiter` |
| `TBL-00008` | `table_manage_all` | Gérer tables occupées (tous serveurs) | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

### Utilisateurs (`users`) — Admin

| Code | Slug (runtime) | Nom | Suggested roles* |
|------|----------------|-----|------------------|
| `USR-00001` | `user_create` | Créer utilisateur | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `USR-00002` | `user_update` | Modifier utilisateur | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `USR-00003` | `user_softdelete` | Supprimer utilisateur | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `USR-00004` | `user_view_profile` | Voir son profil | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `USR-00005` | `user_view` | Voir utilisateurs | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `USR-00006` | `user_view_sessions` | Voir utilisateurs connectés | `superadmin`, `owner`, `manager`, `submanager` |
| `USR-00007` | `user_restore` | Restaurer utilisateur | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `USR-00008` | `user_view_deleted` | Voir utilisateurs supprimés | `superadmin`, `owner`, `manager`, `submanager`, `waiter`, `cook`, `barman` |
| `USR-00009` | `user_force_logout` | Forcer déconnexion | `superadmin`, `owner`, `manager`, `submanager` |

*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*

---

## Assignation par rôle (seed)

- **owner:** _aucune — à configurer par SA_
- **manager:** _aucune — à configurer par SA_
- **submanager:** _aucune — à configurer par SA_
- **waiter:** _aucune — à configurer par SA_
- **barman:** _aucune — à configurer par SA_
- **cook:** _aucune — à configurer par SA_
- **systempos:** _aucune — à configurer par SA_
- **superadmin:** toutes les permissions

---

## Notes

1. Utiliser les **slugs** dans le code (`requirePermission('order_create')`).
2. Les codes `XXX-00001` sont stables en base pour l’UI admin.
3. `floor_*` remplace l’ancien module `room_*`.
4. `client_*` remplace `customer_*`.
5. `item_*` remplace `menu_item_*`.
6. Soft-delete permissions utilisent `*_softdelete` au lieu de `*.delete`.
