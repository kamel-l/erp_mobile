#!/bin/bash
# install.sh — Script d'installation rapide
# Usage: bash install.sh

echo ""
echo "=================================================="
echo "  DAR ELSSALEM ERP Mobile — Installation"
echo "=================================================="
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    echo "   Téléchargez-le sur : https://nodejs.org"
    exit 1
fi
echo "✅ Node.js $(node -v) détecté"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé."
    exit 1
fi
echo "✅ npm $(npm -v) détecté"

# Installer expo-cli si absent
if ! command -v expo &> /dev/null; then
    echo "📦 Installation d'Expo CLI..."
    npm install -g expo-cli
fi
echo "✅ Expo CLI installé"

# Installer les dépendances du projet
echo ""
echo "📦 Installation des dépendances React Native..."
npm install

echo ""
echo "📦 Installation du backend Python (Flask)..."
pip install flask flask-cors 2>/dev/null || pip3 install flask flask-cors

echo ""
echo "=================================================="
echo "  Installation terminée !"
echo "=================================================="
echo ""
echo "  Pour démarrer :"
echo ""
echo "  1. Terminal 1 — Backend Python :"
echo "     python backend/api_server.py"
echo ""
echo "  2. Terminal 2 — App React Native :"
echo "     npx expo start"
echo ""
echo "  3. Scannez le QR code avec l'app Expo Go"
echo "     (disponible sur le Play Store)"
echo ""
echo "  Connexion démo : admin / admin123"
echo "=================================================="
