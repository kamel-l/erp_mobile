# 📱 DAR ELSSALEM ERP — Application Android

Application mobile React Native (Expo) pour votre système ERP.

## 🏗️ Structure du projet

```
erp-mobile/
├── App.js                          # Point d'entrée
├── app.json                        # Config Expo
├── eas.json                        # Config build APK
├── package.json                    # Dépendances npm
├── backend/
│   └── api_server.py               # ← Serveur Python Flask (sur votre PC)
└── src/
    ├── screens/
    │   ├── LoginScreen.js          # Connexion
    │   ├── DashboardScreen.js      # Tableau de bord
    │   ├── SalesScreen.js          # Ventes & Factures
    │   ├── StockScreen.js          # Stock & Inventaire
    │   ├── HRScreen.js             # RH & Employés
    │   └── ReportsScreen.js        # Rapports & Analyses
    ├── components/
    │   └── UIComponents.js         # Composants réutilisables
    ├── navigation/
    │   └── AppNavigator.js         # Navigation onglets
    └── services/
        ├── api.js                  # Connexion API backend
        └── theme.js                # Couleurs & styles
```

---

## ⚡ Installation rapide (3 étapes)

### Étape 1 — Installer les outils

```bash
# Installer Node.js (https://nodejs.org) puis :
npm install -g expo-cli eas-cli

# Installer les dépendances du projet
cd erp-mobile
npm install
```

### Étape 2 — Lancer le backend Python

```bash
# Dans un autre terminal, depuis le dossier erp-mobile
pip install flask flask-cors
python backend/api_server.py
```

Le terminal affiche votre IP locale, ex: `http://192.168.1.45:5000`

**⚠️ Important :** Ouvrez `src/services/api.js` et remplacez :
```js
const BASE_URL = 'http://192.168.1.100:5000/api';  // ← Remplacez par VOTRE IP
```

### Étape 3 — Lancer l'app

```bash
# Option A : Tester sur votre téléphone (app Expo Go)
npx expo start
# Scannez le QR code avec l'app "Expo Go" sur votre téléphone Android

# Option B : Émulateur Android Studio
npx expo start --android
```

---

## 📦 Générer un APK installable

### Méthode 1 — EAS Build (recommandé, cloud)

```bash
# Créer un compte sur https://expo.dev (gratuit)
eas login
eas build -p android --profile preview
# L'APK est téléchargeable depuis le dashboard Expo
```

### Méthode 2 — Build local

```bash
# Nécessite Android Studio + JDK 17
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# APK dans android/app/build/outputs/apk/release/
```

---

## 🔗 Connexion à votre ERP existant

L'app se connecte à votre base de données `erp_database.db` via le serveur Flask.

**Conditions requises :**
- Votre PC (qui fait tourner l'ERP Python) et votre téléphone sont sur le **même Wi-Fi**
- Le pare-feu Windows/Linux autorise le port 5000
- Python et Flask sont installés

**Test de connexion :**
```bash
# Dans votre navigateur sur le PC :
http://localhost:5000/api/health
# Sur le téléphone (remplacez l'IP) :
http://192.168.1.45:5000/api/health
# Réponse attendue : {"status": "ok", ...}
```

### Mode hors-ligne (sans backend)

L'app fonctionne aussi en mode démo sans backend avec des données fictives.
Pour se connecter : **admin / admin123**

---

## 🔐 Sécurité en production

Pour déployer en production :

1. **HTTPS** : Utilisez nginx + Let's Encrypt devant Flask
2. **JWT** : Le token est stocké dans `expo-secure-store` (chiffré sur le device)
3. **Changez le SECRET_KEY** dans `api_server.py`
4. **Limitez les IPs** autorisées dans la config CORS

---

## 📱 Fonctionnalités par écran

| Écran | Fonctionnalités |
|-------|----------------|
| **Dashboard** | KPIs temps réel, graphique 7 jours, alertes stock/factures |
| **Ventes** | Liste factures, recherche, statuts, export PDF, résumé mensuel |
| **Stock** | Inventaire complet, scan code-barres, alertes critiques, mouvements |
| **RH** | Présences (cliquables), salaires, masse salariale |
| **Rapports** | CA mensuel, top produits/clients, export PDF/CSV/Excel |

---

## 🛠️ Personnalisation

### Changer les couleurs
Éditez `src/services/theme.js` → `COLORS.primary`

### Ajouter un nouvel écran
1. Créez `src/screens/MonEcran.js`
2. Ajoutez-le dans `src/navigation/AppNavigator.js`
3. Ajoutez l'endpoint dans `backend/api_server.py`

### Ajouter des notifications push
```bash
npx expo install expo-notifications
# Suivez : https://docs.expo.dev/push-notifications/overview/
```

---

## 🐛 Résolution de problèmes

**"Network Error" dans l'app :**
- Vérifiez que le backend tourne : `python backend/api_server.py`
- Vérifiez l'IP dans `src/services/api.js`
- Téléphone et PC sur le même Wi-Fi ?
- Port 5000 ouvert dans le pare-feu ?

**"Metro bundler error" :**
```bash
npx expo start --clear
```

**L'APK ne s'installe pas :**
- Activez "Sources inconnues" dans Paramètres Android
- Ou utilisez EAS Build pour un APK signé

---

## 📞 Support

Connexion backend : modifiez `src/services/api.js` → `BASE_URL`
Questions ERP : consultez la documentation de votre ERP Python existant
# erp_mobile
