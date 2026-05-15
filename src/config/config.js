// src/config/config.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONFIG = {
  // Par défaut
  API_URL: 'http://192.168.1.65:5000/api',
  API_TIMEOUT: 10000,
  DEBUG: false,
  LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 min
  TOKEN_REFRESH_INTERVAL: 24 * 60 * 60 * 1000, // 24h
};

/**
 * Récupère une clé de config
 */
export const getConfig = (key) => CONFIG[key] || null;

/**
 * Définit une clé de config
 */
export const setConfig = (key, value) => {
  CONFIG[key] = value;
  return AsyncStorage.setItem(`config_${key}`, JSON.stringify(value));
};

/**
 * Récupère la config depuis AsyncStorage (persiste entre sessions)
 */
export const loadConfig = async () => {
  try {
    const keys = Object.keys(CONFIG);
    const stored = await AsyncStorage.multiGet(keys.map(k => `config_${k}`));
    
    stored.forEach(([key, value]) => {
      if (value) {
        const configKey = key.replace('config_', '');
        CONFIG[configKey] = JSON.parse(value);
      }
    });
  } catch (err) {
    console.warn('Erreur chargement config', err);
  }
};

/**
 * Réinitialise la config aux défauts
 */
export const resetConfig = () => {
  Object.keys(CONFIG).forEach(key => {
    AsyncStorage.removeItem(`config_${key}`);
  });
};

export default CONFIG;
