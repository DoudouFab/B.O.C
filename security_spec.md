# Spécification de Sécurité Firestore — B.O.C (Boîte à Outils du Contrôleur)

## 1. Invariants de données et d'isolation
1. **Isolation absolue par contrôleur** : Chaque contrôleur dispose uniquement de `/controllers/{controllerId}` et de ses sous-collections (`projects`, `todos`, `calendarEntries`, `notebooks`) où `controllerId == request.auth.uid` et `email_verified == true`.
2. **Liaison unique du compte** : `uid`, `email` et `boundAt` de `/controllers/{controllerId}` sont strictement immuables.
3. **Verrouillage des 3 liens** : Tant que `linksLocked == false`, le contrôleur peut enregistrer les liens et activer `linksLocked: true`. Une fois `linksLocked == true`, les URLs ne peuvent plus être modifiées.
4. **Intégrité relationnelle** : Tout document enfant doit porter `ownerUid == controllerId` et référencer soit `'general'`, soit un `projectId` existant dans `/controllers/{controllerId}/projects/{projectId}`.
5. **Intégrité temporelle & bornes de taille** : `createdAt` et `updatedAt` sont validés via `request.time`. Chaque chaîne et nombre est strictement borné.
