# 📖 GUIDE DES AMÉLIORATIONS

Ce document explique toutes les améliorations apportées au projet ERP Mobile.

## ✅ Amélioration 1: Configuration API Centralisée

### Problème résolu
❌ L'URL API était hardcodée en dur (`http://192.168.1.65:5000/api`)
✅ Solution: Configuration centralisée et rechargeable

### Comment utiliser

**Configuration par défaut** (`src/config/config.js`):
```javascript
// Récupérer une config
import { getConfig } from './src/config/config';
const apiUrl = getConfig('API_URL');

// Modifier une config
import { setConfig } from './src/config/config';
await setConfig('API_URL', 'http://192.168.1.100:5000/api');

// Recharger la config depuis storage
import { loadConfig } from './src/config/config';
await loadConfig();
```

**Variables d'environnement** (`.env`):
```bash
API_URL=http://YOUR_IP:5000/api
API_TIMEOUT=10000
DEBUG=false
LOG_LEVEL=info
```

**Depuis l'API** (`src/services/api.js`):
```javascript
import { getApiUrl, setApiUrl } from './src/services/api';

// Obtenir l'URL actuelle
const url = getApiUrl();

// Mettre à jour l'URL
await setApiUrl('http://192.168.1.100:5000/api');
```

---

## ✅ Amélioration 2: Validation des Formulaires

### Problème résolu
❌ Aucune validation de formulaire, données invalides en base
✅ Validation avec Yup, schémas réutilisables

### Schémas disponibles

```javascript
import {
  LoginSchema,
  ClientSchema,
  ProductSchema,
  SaleSchema,
  APIConfigSchema,
} from './src/services/validation';
```

### Utiliser la validation

**Approche basique:**
```javascript
import { validateForm, LoginSchema } from './src/services/validation';

const values = { username: 'admin', password: 'pass123' };
const { isValid, errors } = await validateForm(LoginSchema, values);

if (!isValid) {
  console.log('Erreurs:', errors);
  // { username: "Minimum 3 caractères", ... }
}
```

**Avec le hook** (recommandé pour les formulaires):
```javascript
import { useFormValidation } from './src/hooks/useFormValidation';
import { LoginSchema } from './src/services/validation';

const MyForm = () => {
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
  } = useFormValidation(
    { username: '', password: '' },
    LoginSchema,
    async (values) => {
      console.log('Form valid, submitting:', values);
      // Votre logique de soumission
    }
  );

  return (
    <View>
      <TextInput
        value={values.username}
        onChangeText={(text) => handleChange('username', text)}
        onBlur={() => handleBlur('username')}
        placeholder="Nom d'utilisateur"
      />
      {touched.username && errors.username && (
        <Text style={styles.error}>{errors.username}</Text>
      )}
      
      <Button
        title="Connexion"
        onPress={handleSubmit}
        disabled={isSubmitting}
      />
    </View>
  );
};
```

---

## ✅ Amélioration 3: Gestion Globale des Erreurs

### Problème résolu
❌ Pas de gestion d'erreurs, crashes silencieux
✅ ErrorBoundary + Logger + Toast centralisés

### Composants

**ErrorBoundary** (automatique):
```javascript
// App.js - Déjà intégré
import ErrorBoundary from './src/components/ErrorBoundary';

<ErrorBoundary>
  <MyApp />
</ErrorBoundary>
```

**Logger** pour tracer les événements:
```javascript
import { logger } from './src/services/logger';

logger.debug('Debug message', { data: 'value' });
logger.info('Connexion réussie', { username: 'admin' });
logger.warn('Avertissement', { reason: 'something' });
logger.error('Erreur', new Error('Something went wrong'));

// Récupérer les logs
const logs = logger.getLogs();
const errorLogs = logger.getLogs('error');

// Exporter les logs (pour debugging)
const exported = logger.exportLogs();
```

**Toast pour les notifications**:
```javascript
import { toast, showToast } from './src/components/Toast';

// Méthodes raccourcies
toast.success('Opération réussie');
toast.error('Une erreur est survenue');
toast.warning('Attention!');
toast.info('Information');

// Ou avec contrôle
showToast('Mon message', 'success', 3000);
```

**Error Handler**:
```javascript
import {
  AppError,
  handleNetworkError,
  handleValidationError,
  formatErrorMessage,
  retryWithBackoff,
} from './src/services/errorHandler';

// Lancer une erreur applicative
throw new AppError('Message d\'erreur', 'ERROR_CODE', 400);

// Gérer les erreurs réseau
try {
  await api.get('/some-endpoint');
} catch (error) {
  const appError = handleNetworkError(error);
  toast.error(formatErrorMessage(appError));
}

// Réessayer avec backoff exponentiel
const result = await retryWithBackoff(
  () => api.get('/endpoint'),
  3,  // max retries
  1000 // base delay (ms)
);
```

---

## ✅ Amélioration 4: Sécurité du Backend

### Problème résolu
❌ Token hardcodé, pas de rate limiting, validation minimale
✅ JWT dynamique, rate limiting, validation robuste

### Backend sécurisé

**Démarrer le nouveau serveur:**
```bash
cd backend

# Installer les dépendances
pip install -r requirements.txt

# Copier .env.example en .env et le configurer
cp .env.example .env

# Lancer le serveur
python api_server_secure.py
```

**Fichiers de sécurité:**
- `backend/api_server_secure.py` - Nouveau serveur sécurisé
- `backend/auth_utils.py` - Gestion JWT et hashing
- `backend/validation.py` - Validation des inputs
- `backend/requirements.txt` - Dépendances Python

### Fonctionnalités de sécurité

**JWT (JSON Web Tokens):**
```python
# Automatique via auth_utils.py
tokens = generate_tokens(user_id, username, role)
# Retourne: { access_token, refresh_token, expires_in }
```

**Rate Limiting:**
```python
# Configuré par endpoint
@app.route('/api/auth/login', methods=['POST'])
@limiter.limit('10/minute')  # Max 10 requêtes par minute
def login():
    ...
```

**Validation des inputs:**
```python
# validation.py
from validation import validate_product_data, validate_client_data

is_valid, errors = validate_product_data(data)
if not is_valid:
    return {'error': errors}, 400
```

---

## ✅ Amélioration 5: Tests Automatisés

### Configuration

**Installation:**
```bash
npm install --save-dev jest @testing-library/react-native
```

**Fichiers:**
- `jest.config.js` - Configuration Jest
- `jest.setup.js` - Setup global
- `src/__tests__/` - Dossier des tests

### Exécuter les tests

```bash
# Tous les tests
npm test

# Mode watch (réexécution automatique)
npm run test:watch

# Avec couverture
npm test -- --coverage
```

### Structure des tests

```
src/__tests__/
├── services/
│   ├── validation.test.js      # Tests validation
│   └── errorHandler.test.js    # Tests error handling
├── hooks/
│   └── useFormValidation.test.js # Tests du hook
└── config/
    └── config.test.js           # Tests config
```

### Écrire un test

```javascript
// src/__tests__/myFeature.test.js
import { myFunction } from '../../services/myService';

describe('My Feature', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle error', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

### Tests actuels

✅ **validation.test.js** - 10+ tests
- LoginSchema validation
- ClientSchema validation
- ProductSchema validation

✅ **errorHandler.test.js** - 6+ tests
- AppError creation
- Error formatting
- Retry with backoff

✅ **useFormValidation.test.js** - 7+ tests
- Hook initialization
- Value changes
- Form validation
- Submit handling

✅ **config.test.js** - 4+ tests
- Config retrieval
- Config updates
- Config persistence

---

## 📚 Fichiers Importants

### Frontend
| Fichier | Description |
|---------|-------------|
| `src/config/config.js` | Gestion centralisée de la config |
| `src/services/validation.js` | Schémas Yup pour validation |
| `src/services/logger.js` | Service de logging |
| `src/services/errorHandler.js` | Gestion des erreurs |
| `src/components/ErrorBoundary.js` | Récupération des erreurs React |
| `src/components/Toast.js` | Notifications utilisateur |
| `src/hooks/useFormValidation.js` | Hook de validation de formulaire |

### Backend
| Fichier | Description |
|---------|-------------|
| `backend/api_server_secure.py` | Serveur Flask sécurisé (NOUVEAU) |
| `backend/auth_utils.py` | Utilitaires JWT et authentification |
| `backend/validation.py` | Validation des données |
| `backend/requirements.txt` | Dépendances Python |

### Tests
| Fichier | Description |
|---------|-------------|
| `jest.config.js` | Configuration Jest |
| `src/__tests__/` | Suite de tests |

---

## 🚀 Prochaines Étapes

### Phase 1 (Court terme)
- ✅ Configuration API dynamique
- ✅ Validation formulaires
- ✅ Gestion erreurs globale
- ✅ Sécurité backend
- ✅ Tests de base

### Phase 2 (Moyen terme)
- 📋 Intégrer validation dans tous les formulaires
- 📋 Ajouter plus de tests (couverture 60%+)
- 📋 Dashboard de monitoring

### Phase 3 (Long terme)
- 📋 Notifications push
- 📋 Export PDF
- 📋 Biométrie (fingerprint/face)
- 📋 Intégration paiement

---

## ❓ FAQ

**Q: Comment changer l'URL API?**
```javascript
import { setApiUrl } from './src/services/api';
await setApiUrl('http://192.168.1.100:5000/api');
```

**Q: Comment déboguer les erreurs?**
```javascript
import { logger } from './src/services/logger';
const logs = logger.getLogs();
console.log(logger.exportLogs());
```

**Q: Comment ajouter une nouvelle validation?**
```javascript
// src/services/validation.js
export const MySchema = Yup.object().shape({
  field1: Yup.string().required(),
  field2: Yup.number().positive(),
});
```

**Q: Comment tester mon code?**
```bash
npm test -- --testNamePattern="mon test"
npm run test:watch
```

---

## 📞 Support

Pour toute question, consultez:
- 📖 Documentation Yup: https://github.com/jquense/yup
- 📖 Documentation Jest: https://jestjs.io/
- 📖 Documentation JWT: https://jwt.io/
- 📖 Documentation Flask-Limiter: https://flask-limiter.readthedocs.io/

---

**Dernière mise à jour:** Mai 2026
**Version:** 1.1.0
