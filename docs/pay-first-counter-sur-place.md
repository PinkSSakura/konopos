# Sur place — paiement au comptoir (Option 1)

> Spécification produit — **non implémentée**. Référence pour un futur mode « commande → paiement → ticket → attente → consommation → départ ».

## Contexte

Certains restaurants fonctionnent en **paiement d’abord** :

1. Le client commande au comptoir  
2. Paie immédiatement  
3. Reçoit un ticket (code du jour)  
4. Attend (écran client / CDS)  
5. Consomme sur place et repart **sans second paiement**

Ce mode diffère du **sur place classique** KonoPOS actuel : commande → cuisine → service → **paiement après repas**.

## Écart avec le produit actuel

| Étape | Comportement actuel |
|--------|---------------------|
| Commande `open` | Encaissement **impossible** tant que la commande n’est pas envoyée |
| `dine_in` | Paiement autorisé **après** statut `served` |
| `takeaway` | Paiement à `ready` / `served` — libellé et logique « à emporter » |
| Code du jour | Attribué à l’**envoi cuisine** |
| CDS | Adapté à l’attente ; pas de message payer pour sur place déjà payé |

## Option retenue : réglage établissement

**Nom proposé :** « Sur place — paiement au comptoir (avant attente) »  
**Clé technique suggérée :** `dine_in_pay_at_counter`

Réservé au **manager / owner / superadmin** (comme les autres réglages ops).

### Quand activé

1. Le staff compose la commande sur le POS (`dine_in`).  
2. **Encaissement autorisé avant envoi cuisine** (commande encore `open`).  
3. Après paiement : **envoi cuisine automatique** ou action explicite **« Payer et envoyer »**.  
4. Impression **ticket client** + **code du jour** (à l’encaissement ou à l’envoi — à trancher).  
5. La commande apparaît sur le **CDS** (En attente → En préparation → Prêt à servir).  
6. Le **service** marque **servi** quand le plateau est remis au client.  
7. Le CDS retire la commande quand tout est servi — client déjà payé, il part.

### Quand désactivé

Comportement actuel inchangé : sur place = paiement après service.

## Flux cible (UX)

```
POS : articles → [Payer et envoyer]
        ↓
Caisse : paiement OK → commande payée
        ↓
Cuisine : envoi → code du jour sur ticket
        ↓
CDS : carte (couleur = statut)
        ↓
Service : marquer servi à la remise du plateau
        ↓
CDS : disparition — client repart
```

## Réglages associés (existants ou à prévoir)

| Réglage | Rôle |
|---------|------|
| **Paiement comptoir avant envoi** (`dine_in_pay_at_counter`) | Autorise l’encaissement sur commande `open` en sur place |
| **Envoi auto après paiement** | Une seule action staff |
| **Imprimer code du jour à l’encaissement** | Ticket au moment du paiement (sinon conserver l’impression à l’envoi) |
| **Service : prêt à l’envoi** (`service_ready_on_send`) | Optionnel — cuisines simples |
| **CDS** | Déjà en place — attente par code du jour |

## Changements techniques prévus (implémentation future)

### API / métier

- Assouplir `canCheckoutOrder` / règles paiement pour `dine_in` si `dine_in_pay_at_counter`.  
- Permettre paiement sur commande `open` (aujourd’hui exclue du flux caisse).  
- Endpoint ou flag POS : **pay + send** atomique (paiement puis `sendToKitchen`).  
- `assignDailyCodeIfNeeded` : conserver à l’envoi ou déclencher à l’encaissement selon réglage ticket.  
- CDS : aucun message « payer au comptoir » si `payment_status === 'paid'`.

### Web

- Réglage dans **Paramètres établissement**.  
- POS / caisse : bouton **« Payer et envoyer »** visible si mode actif.  
- Conserver le flux classique pour les restaurants table + addition.

### Ce qui ne change pas

- KDS, colonnes cuisine / bar  
- Comptabilité shift / encaissement (paiement normal)  
- Structure CDS (sections, couleurs, temps réel)

## Alternative non retenue (Option 2)

Type de commande dédié **« Comptoir »** (`counter`) — même flux, mais séparé en données et rapports. Utile si cohabitation stricte sur place table vs comptoir.

## Alternative déconseillée (Option 3)

Utiliser **à emporter** pour manger sur place — contournement only ; mauvais libellés, mauvaises règles CDS / paiement.

---

*Document créé le 27 juin 2026 — KonoPOS 3.3.x*
