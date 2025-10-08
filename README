
Application de tableau de notes **collaborative** en **temps réel** (Socket.IO) avec **authentification JWT** et **règles d'autorisation** :
- Lecture publique
- Écriture réservée aux utilisateurs authentifiés
- Modification/Suppression uniquement par le **propriétaire** de la note

bash
npm install
npm run start
http://localhost:3000

🔐 Endpoints (REST)

POST /register { username, password } → crée un utilisateur (password haché)

POST /login { username, password } → renvoie { token, user }

GET /notes → liste publique des notes

POST /notes (Bearer token) → crée une note (authorId = userId du JWT)

PUT /notes/:id (Bearer token) → modifie sa note

DELETE /notes/:id (Bearer token) → supprime sa note

🌐 Temps réel

Le serveur émet notes_updated via Socket.IO à chaque modification (create/update/delete) pour rafraîchir tous les clients.

⚠️ Données

Stockées en mémoire pour le TP (non persistant)

Remplacer par une base (PostgreSQL/MongoDB) pour un vrai projet

🔧 Variables d’environnement

PORT (par défaut 3000)

JWT_SECRET (défaut dev, à changer)

✅ Scénarios de test

Non authentifié : lecture OK, écriture refusée (401)

Authentifié A : crée une note → peut la modifier/supprimer

Authentifié B : ne peut pas modifier/supprimer la note de A (403)

Plusieurs onglets : mises à jour en temps réel (notes_updated)
