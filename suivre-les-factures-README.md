# Agent — Suivre les factures (README)

But: fournir un assistant focalisé sur le suivi et la maintenance des factures
dans le projet ERP mobile.

Fichier principal de l'agent: `suivre-les-factures.agent.md` (à la racine).

Utilisation rapide
- Branche de travail créée: `agent/suivre-factures/init` (local).
- Pour récupérer la branche distante (si poussée):

```bash
git fetch origin
git checkout agent/suivre-factures/init
```

Exemples de prompts à donner à l'agent (en français)
- "Corrige la logique de création de facture dans `InvoicesScreen.js`."
- "Ajoute le champ `due_date` au modèle de facture et propose une migration."
- "Vérifie la synchronisation des factures entre la base locale et l'API."

Bonnes pratiques pour les modifications
- L'agent peut créer et committer des branches dédiées. Nom suggéré: `agent/suivre-factures/<action>`.
- Toujours écrire un message de commit clair: `agent: <verbe> <objet>`.
- Avant de pousser, vérifier que les tests liés aux factures passent.

Exemples de commandes (pousser la branche vers le remote):

```bash
git push -u origin agent/suivre-factures/init
```

Si tu veux que j'ajoute des exemples de tests automatisés, des migrations
exécutables, ou un petit guide pour valider les factures en local, dis-le
et je les ajoute dans la branche.
- PR ready: ajout initial de l'agent (2026-05-03T08:19:19+01:00)
