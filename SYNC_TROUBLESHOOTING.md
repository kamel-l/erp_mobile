# Guide de Synchronisation ERP Mobile - Dépannage

## ✅ Problèmes Résolus

Le serveur backend a été mis à jour avec les endpoints manquants :

### 1. **Endpoints Ajoutés**
- `GET /api/ping` - Pour tester la connexion (pas besoin d'authentification)
- `GET /api/sync` - Pour synchroniser produits, clients et ventes (avec authentification)

### 2. **Format de Réponse Unifié**
Tous les endpoints retournent maintenant le format attendu par le mobile :
```json
{
  "success": true,
  "data": { ... }
}
```

### 3. **Authentification Améliorée**
- Support des deux formats : `Authorization: Bearer TOKEN` ET `X-API-Token: TOKEN`
- Compatible avec le mobile et les clients externes

---

## 🚀 Lancer le Serveur

### Sur Windows (PowerShell)

```powershell
# Naviguer au dossier du projet
cd d:\Downloads\PycharmProjects\erp-mobile

# Activer l'environnement Python
.\env\Scripts\Activate.ps1

# Lancer le serveur
python backend\api_server.py
```

Vous verrez :
```
==================================================
  Serveur ERP API démarré !
  URL locale : http://192.168.X.X:5000
  Mettez cette IP dans src/services/api.js
==================================================
```

---

## 📱 Configurer l'App Mobile

### Dans SyncScreen
1. Entrez l'adresse IP du serveur (ex: 192.168.1.65)
2. Port : `5000`
3. Token : `DARELSSALEM2026`
4. Cliquez "🔗 Tester la connexion"

### Points de Vérification

✅ **Le PC et le téléphone doivent être sur le MÊME WiFi**
✅ **Le serveur Python doit être EN COURS D'EXÉCUTION**
✅ **L'adresse IP doit être correcte** (voir l'output du serveur)
✅ **Le firewall ne doit pas bloquer le port 5000**

---

## 🔍 Déboguer la Connexion

### 1. Vérifier le serveur est accessible

```powershell
# Windows PowerShell - Tester la connexion
$ip = "192.168.1.65"  # Remplacez par votre IP
Invoke-WebRequest -Uri "http://${ip}:5000/api/ping"
```

Vous devez voir :
```
StatusCode        : 200
StatusDescription : OK
```

### 2. Vérifier la base de données

```powershell
# Depuis le dossier du projet
python -c "
import sqlite3
conn = sqlite3.connect('erp_database.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM products')
print(f'Produits: {cursor.fetchone()[0]}')
cursor.execute('SELECT COUNT(*) FROM clients')
print(f'Clients: {cursor.fetchone()[0]}')
cursor.execute('SELECT COUNT(*) FROM sales')
print(f'Ventes: {cursor.fetchone()[0]}')
conn.close()
"
```

### 3. Vérifier les utilisateurs

```powershell
python -c "
import sqlite3
conn = sqlite3.connect('erp_database.db')
cursor = conn.cursor()
cursor.execute('SELECT id, username, role FROM users')
for row in cursor.fetchall():
    print(row)
conn.close()
"
```

---

## 🛠️ Changements Effectués

### Backend (api_server.py)

1. ✅ Ajout endpoint `/api/ping` (test de connexion)
2. ✅ Ajout endpoint `/api/sync` (synchronisation complète)
3. ✅ Support authentification par `X-API-Token` ET `Authorization: Bearer`
4. ✅ Réponses uniformisées avec `{ success: true, data: ... }`
5. ✅ Tous les endpoints retournent le format correct

### Frontend (syncService.js)

- ✅ Peut maintenant tester la connexion avec `/api/ping`
- ✅ Peut synchroniser avec `/api/sync`
- ✅ Les réponses sont au bon format

---

## 📋 Workflow Complet de Synchronisation

### 1️⃣ L'app teste la connexion
```
GET /api/ping
→ 200 OK ✅
```

### 2️⃣ L'app se connecte
```
POST /api/auth/login
Body: { username: "admin", password: "..." }
→ Reçoit TOKEN
```

### 3️⃣ L'app synchronise les données
```
GET /api/sync
Header: X-API-Token: TOKEN
→ Reçoit { success: true, data: { produits, clients, ventes } }
```

### 4️⃣ L'app stocke localement
- Produits → AsyncStorage
- Clients → AsyncStorage  
- Ventes → Db SQLite local

---

## ❌ Erreurs Courantes et Solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| "Aucune connexion à l'ERP" | Serveur non démarré | Lancez `python api_server.py` |
| "Connection refused" | IP incorrect | Vérifiez l'IP du serveur |
| "Non autorisé" | Token invalide | Utilisez `DARELSSALEM2026` |
| "404 Not Found" | Ancien serveur | Redémarrez le serveur |
| "Network Error" | WiFi différent | Assurez-vous d'être sur le même WiFi |

---

## 🔄 Redémarrage Complet

Si rien ne marche, essayez un redémarrage complet :

```powershell
# 1. Arrêter le serveur (Ctrl+C)
# 2. Fermer l'app mobile
# 3. Relancer le serveur
python backend\api_server.py

# 4. Relancer l'app mobile
# 5. Aller sur SyncScreen
# 6. Cliquer "🔗 Tester la connexion"
# 7. Cliquer "🔄 Synchroniser"
```

---

## ✨ Test Rapide avec CURL

```powershell
# Test ping (pas d'auth)
curl http://192.168.1.65:5000/api/ping

# Test sync (avec token)
curl -H "X-API-Token: DARELSSALEM2026" http://192.168.1.65:5000/api/sync
```

---

**Créé le**: 2026-05-07  
**Version**: 1.0  
**Statut**: ✅ Synchronisation fixée
