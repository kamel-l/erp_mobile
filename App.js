// App.js — Point d'entrée avec ErrorBoundary, Toast et gestion config

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { syncManager } from './src/services/api';
import { initDatabase } from './src/database/database';
import { loadConfig } from './src/config/config';
import { logger } from './src/services/logger';
import ErrorBoundary from './src/components/ErrorBoundary';
import ToastContainer from './src/components/ToastContainer';
import * as SecureStore from 'expo-secure-store';

export default function App() {
  useEffect(() => {
    async function startApp() {
      try {
        logger.info('Démarrage de l\'application');
        
        // 1. Charger la configuration
        await loadConfig();
        logger.debug('Configuration chargée');
        
        // 2. Initialiser la base de données
        await initDatabase();
        logger.debug('Base de données initialisée');
        
        // 3. Vérifier si un token JWT valide existe avant de synchroniser
        const token = await SecureStore.getItemAsync('auth_token');
        const hasValidToken = token && token !== 'offline-token' && token.length > 20;
        
        if (hasValidToken) {
          // 4. Lancer la sync initiale uniquement si authentifié
          await syncManager.syncAllData();
          logger.info('Synchronisation initiale réussie');
        } else {
          logger.info('Pas de token valide — sync ignorée, attente du login');
        }
      } catch (err) {
        logger.error('Erreur au démarrage de l\'app', err);
        // L'ErrorBoundary affichera le message à l'utilisateur
      }
    }

    startApp();

    // Synchronisation périodique (seulement si token valide)
    const interval = setInterval(async () => {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token && token !== 'offline-token' && token.length > 20) {
        syncManager.syncAllData().catch((err) => {
          logger.warn('Erreur sync périodique', err);
        });
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" backgroundColor="#1976D2" />
          <AppNavigator />
          <ToastContainer />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}