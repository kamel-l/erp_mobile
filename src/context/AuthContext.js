// src/context/AuthContext.js
// Gestion globale de la session utilisateur

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier si un token existe au démarrage
    (async () => {
      try {
        const userData = await SecureStore.getItemAsync('user_data');
        const token = await SecureStore.getItemAsync('auth_token');
        if (userData && token) {
          setUser(JSON.parse(userData));
        }
      } catch {
        // Pas de session sauvegardée
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      // Mode offline : admin/admin123
      if (username === 'admin' && password === 'admin123') {
        const offlineUser = { id: 1, username: 'admin', role: 'admin', displayName: 'Administrateur' };
        await SecureStore.setItemAsync('user_data', JSON.stringify(offlineUser));
        setUser(offlineUser);
        return { success: true };
      }
      return { success: false, error: 'Identifiants incorrects' };
    }
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
