# 🚀 GUIDE DE MISE EN PLACE

Ce guide explique comment déployer les améliorations et migrer depuis l'ancienne version.

## Installation des dépendances

### Frontend

```bash
cd erp-mobile

# Installer les nouvelles dépendances
npm install yup

# Installer les dépendances de test
npm install --save-dev jest @testing-library/react-native jest-mock-axios
```

### Backend

```bash
cd backend

# Installer les nouvelles dépendances
pip install pyjwt flask-limiter python-dotenv

# Ou installer depuis requirements.txt
pip install -r requirements.txt
```

## Migration depuis l'ancienne version

### Étape 1: Sauvegarder votre ancien backend

```bash
# Garder une copie de l'ancien serveur
cp backend/api_server.py backend/api_server.backup.py
```

### Étape 2: Configurer le nouveau backend

```bash
cd backend

# Copier la config
cp .env.example .env

# Éditer .env avec votre configuration
# SECRET_KEY: Générer une clé secrète forte
# DB_PATH: Chemin vers votre base de données
# Rate limits: Ajuster selon vos besoins
```

### Étape 3: Générer une clé secrète

```python
import secrets
print(secrets.token_hex(32))
```

Copier cette clé dans `.env` en tant que `SECRET_KEY`.

### Étape 4: Tester le nouveau backend

```bash
# Lancer le serveur
python api_server_secure.py

# Tester la connexion
curl http://localhost:5000/api/health
```

Vous devriez voir:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-05-08T12:00:00.000000"
  }
}
```

### Étape 5: Configurer l'app frontend

#### Option A: Configuration .env (recommandé)

```bash
# Copier le fichier example
cp .env.example .env

# Éditer .env
# API_URL=http://192.168.1.YOUR_IP:5000/api
```

#### Option B: Configuration dans l'app

À la première connexion, l'app demandera l'IP du serveur.

### Étape 6: Tester la connexion

1. Lancer l'app
2. Aller à Settings (si disponible)
3. Entrer l'URL du serveur: `http://192.168.1.YOUR_IP:5000/api`
4. Essayer de se connecter

### Étape 7: Lancer les tests

```bash
# Tous les tests
npm test

# Tests avec coverage
npm test -- --coverage

# Mode watch
npm run test:watch
```

## Mise à jour du code existant

### Utiliser la nouvelle validation dans LoginScreen

**AVANT:**
```javascript
// Pas de validation
const handleLogin = async () => {
  try {
    const result = await authAPI.login(username, password);
    // ...
  } catch (err) {
    console.error('Erreur:', err);
  }
};
```

**APRÈS:**
```javascript
import { useFormValidation } from '../hooks/useFormValidation';
import { LoginSchema } from '../services/validation';
import { toast } from '../components/Toast';

const LoginScreen = () => {
  const { values, errors, handleChange, handleSubmit } = useFormValidation(
    { username: '', password: '' },
    LoginSchema,
    async (values) => {
      try {
        const result = await authAPI.login(values.username, values.password);
        toast.success('Connexion réussie');
      } catch (err) {
        toast.error(formatErrorMessage(err));
      }
    }
  );

  return (
    // Votre JSX
  );
};
```

### Utiliser le logger

**AVANT:**
```javascript
console.log('Debug:', data);
console.error('Erreur:', error);
```

**APRÈS:**
```javascript
import { logger } from '../services/logger';

logger.debug('Debug:', { data });
logger.error('Erreur:', error);
```

### Utiliser le toast

**AVANT:**
```javascript
Alert.alert('Succès', 'Opération réussie');
```

**APRÈS:**
```javascript
import { toast } from '../components/Toast';

toast.success('Opération réussie');
```

## Déploiement en production

### Checklist

- [ ] Générer une `SECRET_KEY` forte
- [ ] Configurer `DEBUG=false` dans `.env`
- [ ] Configurer les rate limits appropriés
- [ ] Tester tous les endpoints
- [ ] Vérifier les logs
- [ ] Activer HTTPS (certificat SSL/TLS)
- [ ] Configurer CORS correctement
- [ ] Tester la synchronisation offline/online

### Variables d'environnement de production

```bash
# Backend .env
SECRET_KEY=generated_strong_secret_key_here
DEBUG=false
LOG_LEVEL=warn
DB_PATH=/path/to/erp_database.db
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH=5/minute
RATE_LIMIT_API=50/minute
```

```bash
# Frontend .env
API_URL=https://erp.yourcompany.com/api
API_TIMEOUT=10000
DEBUG=false
LOG_LEVEL=warn
```

## Troubleshooting

### Problème: "Token manquant"

**Cause:** La config API_URL est incorrecte

**Solution:**
```javascript
import { setApiUrl } from './src/services/api';
await setApiUrl('http://192.168.1.CORRECT_IP:5000/api');
```

### Problème: "Trop de requêtes"

**Cause:** Rate limiting activé

**Solution:** Attendre quelques minutes ou augmenter les limites dans `.env`

### Problème: "Erreur validation"

**Cause:** Les données n'ont pas le bon format

**Solution:** Vérifier les schémas de validation dans `src/services/validation.js`

### Problème: Tests échouent

**Cause:** Dépendances manquantes ou mock incorrect

**Solution:**
```bash
npm install --save-dev jest @testing-library/react-native
npm test -- --clearCache
```

## Performance

### Optimisations activées

- ✅ Caching des réponses API
- ✅ Compression des images avant upload
- ✅ Retry automatique avec backoff
- ✅ Synchronisation périodique intelligente
- ✅ Logging optimisé (max 500 entrées)

### Monitoring

Vérifier les logs:
```javascript
import { logger } from './src/services/logger';
console.log(logger.exportLogs());
```

## Support et Aide

Si vous rencontrez des problèmes:

1. Vérifier les logs: `logger.getLogs()`
2. Consulter la documentation: `IMPROVEMENTS.md`
3. Vérifier la configuration: `src/config/config.js`
4. Tester avec Postman: API endpoints

## Rollback

Si vous devez revenir à l'ancienne version:

```bash
# Backend
cp backend/api_server.backup.py backend/api_server.py

# Frontend
git checkout src/services/api.js
npm install # Restaurer les dépendances
```

---

**Dernière mise à jour:** Mai 2026
**Durée d'installation:** ~15 minutes
