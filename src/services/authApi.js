import * as SecureStore from 'expo-secure-store';
import { api, isConnected, generateOperationId } from './apiClient';
import { getConfig } from '../config/config';
import { logger } from './logger';
import { retryWithBackoff, AppError } from './errorHandler';
import { syncManager } from './syncManager';

const ALLOW_INSECURE_DEFAULT_ADMIN =
  typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const authAPI = {
  login: async (username, password) => {
    try {
      logger.info('Tentative de connexion', { username });
      if (await isConnected()) {
        const res = await retryWithBackoff(() =>
          api.post('/auth/login', { username, password })
        );
        const loginData = res.data.data;
        const jwtToken = loginData?.access_token || loginData?.token;
        if (loginData && jwtToken) {
          await SecureStore.setItemAsync('auth_token', String(jwtToken));
          await SecureStore.setItemAsync('user_data', JSON.stringify(loginData.user));
          logger.info('Connexion réussie', { user: username });
          syncManager.syncAllData().catch((err) => {
            logger.warn('Erreur sync au login', err);
          });
          return { ...loginData, token: jwtToken };
        } else {
          throw new AppError('Token manquant de la réponse', 'NO_TOKEN');
        }
      } else {
        if (ALLOW_INSECURE_DEFAULT_ADMIN && username === 'admin' && password === 'admin123') {
          const offlineUser = { id: 1, username: 'admin', role: 'Administrateur' };
          await SecureStore.setItemAsync('user_data', JSON.stringify(offlineUser));
          logger.info('Connexion offline', { user: username });
          return { user: offlineUser, token: 'offline-token' };
        } else {
          throw new AppError('Identifiants incorrects', 'INVALID_CREDENTIALS', 401);
        }
      }
    } catch (error) {
      logger.error('Erreur login', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      if (await isConnected()) {
        await api.post('/auth/logout');
      }
      logger.info('Déconnexion réussie');
    } catch (error) {
      logger.warn('Erreur logout (ignorée)', error);
    } finally {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_data');
    }
  },

  getUser: async () => {
    const data = await SecureStore.getItemAsync('user_data');
    return data ? JSON.parse(data) : null;
  },
};
