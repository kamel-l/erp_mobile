// src/config/config.js
// Note: N'importe PAS logger au niveau module (logger importe config → dépendance circulaire)
// Logger est utilisé via require() dynamique dans loadConfig uniquement
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONFIG = {
  API_URL: 'http://192.168.1.65:5000/api',
  API_TIMEOUT: 10000,
  DEBUG: __DEV__ || false,
  LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
  SYNC_INTERVAL: 5 * 60 * 1000,       // 5 min
  TOKEN_REFRESH_INTERVAL: 24 * 60 * 60 * 1000, // 24h
};

/**
 * Récupère une clé de config
 */
export const getConfig = (key) => {
  const val = CONFIG[key];
  return val !== undefined ? val : null;
};

/**
 * Définit une clé de config (en mémoire + AsyncStorage)
 */
export const setConfig = (key, value) => {
  CONFIG[key] = value;
  return AsyncStorage.setItem(`config_${key}`, JSON.stringify(value));
};

/**
 * Charge la config persistée depuis AsyncStorage.
 * Synchronise aussi le niveau de log du logger.
 */
export const loadConfig = async () => {
  try {
    const keys = Object.keys(CONFIG);
    const stored = await AsyncStorage.multiGet(keys.map(k => `config_${k}`));

    stored.forEach(([key, value]) => {
      if (value !== null) {
        const configKey = key.replace('config_', '');
        try {
          CONFIG[configKey] = JSON.parse(value);
        } catch {
          // valeur corrompue → on garde la valeur par défaut
        }
      }
    });

    // Synchroniser le niveau de log avec le logger (import dynamique pour éviter le cycle)
    try {
      const { logger } = require('../services/logger');
      logger.setLevel(CONFIG.LOG_LEVEL);
      logger.setDebug(CONFIG.DEBUG);
    } catch {
      // logger non disponible — pas bloquant
    }
  } catch (err) {
    // Utiliser console.warn ici car logger n'est pas disponible sans risque de cycle
    console.warn('[config] Erreur chargement config:', err);
  }
};

/**
 * Réinitialise la config aux valeurs par défaut
 */
export const resetConfig = () => {
  Object.keys(CONFIG).forEach(key => {
    AsyncStorage.removeItem(`config_${key}`);
  });
};

export default CONFIG;
