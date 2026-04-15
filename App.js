// App.js — Point d'entrée avec AuthProvider et sync

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { syncManager } from './src/services/api';
import { initDatabase } from './src/database/database';

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);
  useEffect(() => {
    // Synchronisation périodique toutes les 5 minutes
    const interval = setInterval(() => {
      syncManager.syncAllData();
    }, 5 * 60 * 1000);

    // Sync au démarrage
    syncManager.syncAllData();

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#1976D2" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}