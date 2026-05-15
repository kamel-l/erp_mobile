# ðŸ“± DAR ELSSALEM ERP â€” Application Android

Application mobile React Native (Expo) pour votre systÃ¨me ERP.

## ðŸ—ï¸ Structure du projet

```
erp-mobile/
â”œâ”€â”€ App.js                          # Point d'entrÃ©e
â”œâ”€â”€ app.json                        # Config Expo
â”œâ”€â”€ eas.json                        # Config build APK
â”œâ”€â”€ package.json                    # DÃ©pendances npm
â”œâ”€â”€ backend/
â”‚   â””â”€â”€ api_server.py               # â† Serveur Python Flask (sur votre PC)
â””â”€â”€ src/
    â”œâ”€â”€ screens/
    â”‚   â”œâ”€â”€ LoginScreen.js          # Connexion
    â”‚   â”œâ”€â”€ DashboardScreen.js      # Tableau de bord
    â”‚   â”œâ”€â”€ SalesScreen.js          # Ventes & Factures
    â”‚   â”œâ”€â”€ StockScreen.js          # Stock & Inventaire
    â”‚   â”œâ”€â”€ ClientsScreen.js        # Clients
    â”‚   â””â”€â”€ ReportsScreen.js        # Rapports & Analyses
    â”œâ”€â”€ components/
    â”‚   â””â”€â”€ UIComponents.js         # Composants rÃ©utilisables
    â”œâ”€â”€ navigation/
    â”‚   â””â”€â”€ AppNavigator.js         # Navigation onglets
    â””â”€â”€ services/
        â”œâ”€â”€ api.js                  # Connexion API backend
        â””â”€â”€ theme.js                # Couleurs & styles
```

---

## âš¡ Installation rapide (3 Ã©tapes)

### Ã‰tape 1 â€” Installer les outils

```bash
# Installer Node.js (https://nodejs.org) puis :
npm install -g expo-cli eas-cli

# Installer les dÃ©pendances du projet
cd erp-mobile
npm install
```

### Ã‰tape 2 â€” Lancer le backend Python

```bash
# Dans un autre terminal, depuis le dossier erp-mobile
pip install flask flask-cors
python backend/api_server.py
```

Le terminal affiche votre IP locale, ex: `http://192.168.1.45:5000`

**âš ï¸ Important :** Ouvrez `src/services/api.js` et remplacez :
```js
const BASE_URL = 'http://192.168.1.100:5000/api';  // â† Remplacez par VOTRE IP
```

### Ã‰tape 3 â€” Lancer l'app

```bash
# Option A : Tester sur votre tÃ©lÃ©phone (app Expo Go)
npx expo start
# Scannez le QR code avec l'app "Expo Go" sur votre tÃ©lÃ©phone Android

# Option B : Ã‰mulateur Android Studio
npx expo start --android
```

---

## ðŸ“¦ GÃ©nÃ©rer un APK installable

### MÃ©thode 1 â€” EAS Build (recommandÃ©, cloud)

```bash
# CrÃ©er un compte sur https://expo.dev (gratuit)
eas login
eas build -p android --profile preview
# L'APK est tÃ©lÃ©chargeable depuis le dashboard Expo
```

### MÃ©thode 2 â€” Build local

```bash
# NÃ©cessite Android Studio + JDK 17
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# APK dans android/app/build/outputs/apk/release/
```

---

## ðŸ”— Connexion Ã  votre ERP existant

L'app se connecte Ã  votre base de donnÃ©es `erp_database.db` via le serveur Flask.

**Conditions requises :**
- Votre PC (qui fait tourner l'ERP Python) et votre tÃ©lÃ©phone sont sur le **mÃªme Wi-Fi**
- Le pare-feu Windows/Linux autorise le port 5000
- Python et Flask sont installÃ©s

**Test de connexion :**
```bash
# Dans votre navigateur sur le PC :
http://localhost:5000/api/health
# Sur le tÃ©lÃ©phone (remplacez l'IP) :
http://192.168.1.45:5000/api/health
# RÃ©ponse attendue : {"status": "ok", ...}
```

### Mode hors-ligne (sans backend)

L'app fonctionne aussi en mode dÃ©mo sans backend avec des donnÃ©es fictives.
En mode développement uniquement, vous pouvez utiliser : **admin / admin123**

---

## ðŸ” SÃ©curitÃ© en production

Pour dÃ©ployer en production :

1. **HTTPS** : Utilisez nginx + Let's Encrypt devant Flask
2. **JWT** : Le token est stockÃ© dans `expo-secure-store` (chiffrÃ© sur le device)
3. **Changez le SECRET_KEY** dans `api_server.py`
4. **Limitez les IPs** autorisÃ©es dans la config CORS

---

## ðŸ“± FonctionnalitÃ©s par Ã©cran

| Ã‰cran | FonctionnalitÃ©s |
|-------|----------------|
| **Dashboard** | KPIs temps rÃ©el, graphique 7 jours, alertes stock/factures |
| **Ventes** | Liste factures, recherche, statuts, export PDF, rÃ©sumÃ© mensuel |
| **Stock** | Inventaire complet, scan code-barres, alertes critiques, mouvements |
| **RH** | PrÃ©sences (cliquables), salaires, masse salariale |
| **Rapports** | CA mensuel, top produits/clients, export PDF/CSV/Excel |

---

## ðŸ› ï¸ Personnalisation

### Changer les couleurs
Ã‰ditez `src/services/theme.js` â†’ `COLORS.primary`

### Ajouter un nouvel Ã©cran
1. CrÃ©ez `src/screens/MonEcran.js`
2. Ajoutez-le dans `src/navigation/AppNavigator.js`
3. Ajoutez l'endpoint dans `backend/api_server.py`

### Ajouter des notifications push
```bash
npx expo install expo-notifications
# Suivez : https://docs.expo.dev/push-notifications/overview/
```

---

## ðŸ› RÃ©solution de problÃ¨mes

**"Network Error" dans l'app :**
- VÃ©rifiez que le backend tourne : `python backend/api_server.py`
- VÃ©rifiez l'IP dans `src/services/api.js`
- TÃ©lÃ©phone et PC sur le mÃªme Wi-Fi ?
- Port 5000 ouvert dans le pare-feu ?

**"Metro bundler error" :**
```bash
npx expo start --clear
```

**L'APK ne s'installe pas :**
- Activez "Sources inconnues" dans ParamÃ¨tres Android
- Ou utilisez EAS Build pour un APK signÃ©

---

## ðŸ“ž Support

Connexion backend : modifiez `src/services/api.js` â†’ `BASE_URL`
Questions ERP : consultez la documentation de votre ERP Python existant
# erp_mobile

