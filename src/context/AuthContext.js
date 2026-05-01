// src/context/AuthContext.js
// Gestion globale de la session utilisateur

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';
import { setCurrentUser, clearCurrentUser } from '../database/database';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Désactiver le chargement automatique de la session pour forcer la page de login
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
      if (data?.token) {
        await SecureStore.setItemAsync('auth_token', data.token);
      }
      setUser(data.user);
      await setCurrentUser(data.user);
      return { success: true };
    } catch (err) {
      // Mode offline : admin/admin123
      if (username === 'admin' && password === 'admin123') {
        const offlineUser = { id: 1, username: 'admin', role: 'admin', displayName: 'Administrateur' };
        await SecureStore.setItemAsync('auth_token', 'offline-token');
        await SecureStore.setItemAsync('user_data', JSON.stringify(offlineUser));
        setUser(offlineUser);
        await setCurrentUser(offlineUser);
        return { success: true };
      }
      return { success: false, error: 'Identifiants incorrects' };
    }
  };

  const logout = async () => {
    await authAPI.logout();
    await clearCurrentUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
