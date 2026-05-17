// src/services/api.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import { MOCK_DATA } from './mockData';
import { getConfig, setConfig } from '../config/config';
import { logger } from './logger';
import { handleNetworkError, retryWithBackoff, AppError } from './errorHandler';
import { toast } from '../components/Toast';
import { cache } from '../utils/performanceOptimizations';
import {
  getLocalProducts,
  saveProductsLocally,
  getLocalClients,
  saveClientsLocally,
  getDashboardStatsOffline,
  saveDashboardStatsOffline,
  getSalesWeekOffline,
  saveSalesWeekOffline,
  getLowStockOffline,
  saveLowStockOffline,
  getEmployeesOffline,
  saveEmployeesOffline,
  addPendingAction,
  getPendingActions,
  removePendingAction,
  setLastSyncTime,
  getLastSyncTime,
} from '../database/database';
import { getLocalSales, saveSaleLocally, saveSalesOffline } from '../database/salesRepository';

const ALLOW_INSECURE_DEFAULT_ADMIN =
  typeof __DEV__ !== 'undefined' ? __DEV__ : false;

// ========== CONFIGURATION ==========
// Utiliser la config centralisée (par défaut ou personnalisée)
const getApiClient = () => {
  const apiUrl = getConfig('API_URL');
  const timeout = getConfig('API_TIMEOUT');
  
  const api = axios.create({
    baseURL: apiUrl,
    timeout: timeout || 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Intercepteur pour ajouter le token
  api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token && token !== 'offline-token') {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  });

  // Intercepteur pour les erreurs
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const appError = handleNetworkError(error);
      logger.error('API Error', appError);
      return Promise.reject(appError);
    }
  );

  return api;
};

let api = getApiClient();

// ========== VÉRIFICATION DE CONNEXION ==========
export const isConnected = async () => {
  try {
    const netInfo = await Network.getNetworkStateAsync();
    return Boolean(netInfo.isConnected);
  } catch {
    return false;
  }
};

/**
 * Recréer le client API après changement de configuration
 */
export const reinitializeApi = () => {
  api = getApiClient();
  logger.info('API client réinitialisé avec nouvelle config');
};

/**
 * Obtenir l'URL API actuelle
 */
export const getApiUrl = () => getConfig('API_URL');

/**
 * Définir une nouvelle URL API
 */
export const setApiUrl = async (newUrl) => {
  try {
    // Valider l'URL
    new URL(newUrl);
    await setConfig('API_URL', newUrl);
    reinitializeApi();
    logger.info('URL API mise à jour', { url: newUrl });
    return true;
  } catch (err) {
    logger.error('URL API invalide', err);
    return false;
  }
};

// ========== AUTHENTIFICATION ==========
export const authAPI = {
  login: async (username, password) => {
    try {
      logger.info('Tentative de connexion', { username });
      
      if (await isConnected()) {
        // Retry avec backoff
        const res = await retryWithBackoff(() =>
          api.post('/auth/login', { username, password })
        );
        
        const loginData = res.data.data;

        // Le serveur retourne 'access_token', on accepte aussi 'token' pour compatibilité
        const jwtToken = loginData?.access_token || loginData?.token;

        if (loginData && jwtToken) {
          await SecureStore.setItemAsync('auth_token', String(jwtToken));
          await SecureStore.setItemAsync('user_data', JSON.stringify(loginData.user));
          logger.info('Connexion réussie', { user: username });
          
          // Lancer la synchronisation en arrière-plan (token déjà stocké)
          syncManager.syncAllData().catch((err) => {
            logger.warn('Erreur sync au login', err);
          });
          
          return { ...loginData, token: jwtToken }; // normaliser pour le reste du code
        } else {
          throw new AppError('Token manquant de la réponse', 'NO_TOKEN');
        }
      } else {
        // Mode hors ligne (dev seulement) : accepter admin/admin123
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

// ========== DASHBOARD ==========
export const dashboardAPI = {
  getStats: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/stats');
        const data = res.data.data || res.data; // Fallback si pas de wrapper
        await saveDashboardStatsOffline(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached stats', error);
    }
    const cached = await getDashboardStatsOffline();
    return cached || MOCK_DATA.stats;
  },

  getSalesWeek: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/sales-week');
        const data = res.data.data || res.data;
        await saveSalesWeekOffline(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached sales week', error);
    }
    const cached = await getSalesWeekOffline();
    return cached.length ? cached : MOCK_DATA.salesWeek;
  },

  getAlerts: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/alerts');
        return res.data.data || res.data;
      }
    } catch (error) {
      logger.debug('Offline: using mock alerts', error);
    }
    return MOCK_DATA.alerts || [];
  },
};

// ========== VENTES ==========
export const salesAPI = {
  getAll: async (params = {}) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/sales', { params });
        const data = res.data.data || res.data;
        // Sauvegarder les ventes localement pour le mode hors ligne
        if (data && Array.isArray(data) && data.length > 0) {
          await saveSalesOffline(data);
        }
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached sales', error);
    }
    return await getLocalSales();
  },

  getById: async (id) => {
    try {
      if (await isConnected()) {
        const res = await api.get(`/sales/${id}`);
        return res.data.data || res.data;
      }
    } catch (error) {
      logger.debug('Offline: sale details not available', error);
    }
    const sales = await getLocalSales();
    return sales.find(s => s.id === id) || null;
  },

  create: async (saleData, itemsData) => {
    try {
      if (await isConnected()) {
        const res = await api.post('/sales', { sale: saleData, items: itemsData });
        return res.data.data || res.data;
      } else {
        // Sauvegarde locale + file d'attente
        const saleId = await saveSaleLocally(saleData, itemsData);
        await addPendingAction({
          type: 'CREATE_SALE',
          data: { saleData, itemsData, saleId },
        });
        return { offline: true, saleId, message: 'Vente sauvegardée localement' };
      }
    } catch (error) {
      logger.error('Error creating sale', error);
      throw error;
    }
  },

  getStats: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/sales/stats');
        return res.data.data || res.data;
      }
    } catch (error) {
      logger.debug('Offline: using mock stats', error);
    }
    return MOCK_DATA.salesStats;
  },

  getClients: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/clients');
        const data = res.data.data || res.data;
        await saveClientsLocally(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached clients', error);
    }
    return await getLocalClients();
  },
};

// ========== STOCK ==========
export const stockAPI = {
  getProducts: async (params = {}) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/products', { params });
        const data = res.data.data || res.data;
        await saveProductsLocally(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached products', error);
    }
    return await getLocalProducts();
  },

  getProductByBarcode: async (barcode) => {
    try {
      if (await isConnected()) {
        const res = await api.get(`/products/barcode/${barcode}`);
        return res.data.data || res.data;
      }
    } catch (error) {
      logger.debug('Offline: searching in cache', error);
    }
    const products = await getLocalProducts();
    return products.find(p => p.barcode === barcode) || null;
  },

  getLowStock: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/products/low-stock');
        const data = res.data.data || res.data;
        await saveLowStockOffline(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached low stock', error);
    }
    const cached = await getLowStockOffline();
    return cached.length ? cached : MOCK_DATA.lowStock;
  },

  getMovements: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/stock/movements');
        return res.data.data || res.data;
      }
    } catch (error) {
      logger.debug('Offline: movements not available', error);
    }
    return [];
  },

  updateStock: async (productId, qty, type) => {
    try {
      if (await isConnected()) {
        const res = await api.post('/stock/update', { product_id: productId, quantity: qty, type });
        return res.data.data || res.data;
      } else {
        await addPendingAction({
          type: 'UPDATE_STOCK',
          data: { productId, qty, type },
        });
        return { offline: true, message: 'Stock mis à jour localement' };
      }
    } catch (error) {
      logger.error('Error updating stock', error);
      throw error;
    }
  },
};

// ========== RH ==========
export const hrAPI = {
  getEmployees: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/employees');
        const data = res.data.data || res.data;
        await saveEmployeesOffline(data);
        return data;
      }
    } catch (error) {
      logger.debug('Offline: using cached employees', error);
    }
    const cached = await getEmployeesOffline();
    return cached.length ? cached : MOCK_DATA.employees;
  },

  getAttendance: async (date) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/attendance', { params: { date } });
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: attendance not available', error);
    }
    return [];
  },

  markAttendance: async (employeeId, status) => {
    try {
      if (await isConnected()) {
        const res = await api.post('/attendance', { employee_id: employeeId, status });
        return res.data;
      } else {
        await addPendingAction({
          type: 'MARK_ATTENDANCE',
          data: { employeeId, status },
        });
        return { offline: true, message: 'Présence enregistrée localement' };
      }
    } catch (error) {
      logger.error('Error marking attendance', error);
      throw error;
    }
  },

  getPayroll: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/payroll/current');
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: payroll not available', error);
    }
    return null;
  },
};

// ========== RAPPORTS ==========
export const reportsAPI = {
  getMonthly: async (year, month) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/reports/monthly', { params: { year, month } });
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: monthly report not available', error);
    }
    return null;
  },

  getTopProducts: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/reports/top-products');
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: top products not available', error);
    }
    return [];
  },

  exportPDF: async (type) => {
    try {
      if (await isConnected()) {
        const res = await api.get(`/reports/export/${type}`, { responseType: 'blob' });
        return res.data;
      }
    } catch (error) {
      logger.debug('Offline: PDF export not available', error);
    }
    return null;
  },
};

// Removed expo-notifications as it is not supported in Expo Go SDK 53

// ========== GESTIONNAIRE DE SYNCHRONISATION ==========
export const syncManager = {
  isSyncing: false,

  async syncAllData() {
    if (this.isSyncing) return;
    if (!(await isConnected())) {
      logger.warn('No internet connection');
      return;
    }

    this.isSyncing = true;
    logger.info('Starting sync');

    try {
      const pendingActions = await getPendingActions();
      for (const action of pendingActions) {
        try {
          switch (action.type) {
            case 'sale':
            case 'CREATE_SALE': {
              const parsed = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              // Gérer les deux structures possibles
              const saleData = parsed.saleData || parsed.data?.sale || parsed.sale;
              const itemsData = parsed.itemsData || parsed.data?.items || parsed.items;

              if (saleData && itemsData) {
                await api.post('/sales', { sale: saleData, items: itemsData });
              } else {
                logger.warn('Incomplete sale data in pending action', parsed);
              }
              break;
            }
            case 'UPDATE_STOCK': {
              const data = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              const { productId, qty, type } = data;
              await api.post('/stock/update', { product_id: productId, quantity: qty, type });
              break;
            }
            case 'MARK_ATTENDANCE': {
              const data = typeof action.data === 'string' ? JSON.parse(action.data) : action.data;
              const { employeeId, status } = data;
              await api.post('/attendance', { employee_id: employeeId, status });
              break;
            }
            default:
              logger.warn('Unknown action type', { type: action.type });
              continue;
          }
          await removePendingAction(action.id);
          logger.info('Synced action', { type: action.type });
        } catch (error) {
          logger.error('Failed to sync action', { type: action.type, error });
          // Si on a une erreur 401, on arrête la sync car le token est probablement invalide
          if (error.response && error.response.status === 401) {
            logger.error('Stopping sync due to authentication error (401)');
            break;
          }
        }
      }

      // Rafraîchir les données locales (séquentiellement pour éviter les conflits SQLite)
      await dashboardAPI.getStats();
      await dashboardAPI.getSalesWeek();
      await stockAPI.getProducts();
      await stockAPI.getLowStock();
      await salesAPI.getClients();
      await salesAPI.getAll();
      await hrAPI.getEmployees();

      // IMPORTANT: Vider le cache pour forcer le rafraîchissement des écrans
      cache.clear();

      await setLastSyncTime();
      logger.info('Sync completed');
    } catch (error) {
      logger.error('Sync error', error);
    } finally {
      this.isSyncing = false;
    }
  },

  async sync() {
    await this.syncAllData();
  },
};

// Export des données mockées pour fallback
export { MOCK_DATA };
