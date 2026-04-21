// src/services/api.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import { MOCK_DATA } from './mockData';
import {
  getLocalProducts,
  saveProductsLocally,
  getLocalSales,
  saveSaleLocally,
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

// ========== CONFIGURATION ==========
const BASE_URL = 'http://192.168.1.65:5000'; // À adapter à votre serveur

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ========== VÉRIFICATION DE CONNEXION ==========
export const isConnected = async () => {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected && state.isInternetReachable;
  } catch {
    return false;
  }
};

// ========== AUTHENTIFICATION ==========
export const authAPI = {
  login: async (username, password) => {
    try {
      if (await isConnected()) {
        const res = await api.post('/auth/login', { username, password });
        await SecureStore.setItemAsync('auth_token', res.data.token);
        await SecureStore.setItemAsync('user_data', JSON.stringify(res.data.user));
        // Lancer la synchronisation en arrière-plan (sans attendre)
        syncManager.syncAllData().catch(console.warn);
        return res.data;
      } else {
        // Mode hors ligne : accepter admin/admin123
        if (username === 'admin' && password === 'admin123') {
          const offlineUser = { username: 'admin', role: 'Administrateur' };
          await SecureStore.setItemAsync('user_data', JSON.stringify(offlineUser));
          return { user: offlineUser, token: 'offline-token' };
        } else {
          throw new Error('Identifiants incorrects');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      if (await isConnected()) await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
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
        await saveDashboardStatsOffline(res.data);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using cached stats');
    }
    const cached = await getDashboardStatsOffline();
    return cached || MOCK_DATA.stats;
  },

  getSalesWeek: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/sales-week');
        await saveSalesWeekOffline(res.data);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using cached sales week');
    }
    const cached = await getSalesWeekOffline();
    return cached.length ? cached : MOCK_DATA.salesWeek;
  },

  getAlerts: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/dashboard/alerts');
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using mock alerts');
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
        // Sauvegarder les ventes localement (à implémenter si besoin)
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using cached sales');
    }
    return await getLocalSales();
  },

  getById: async (id) => {
    try {
      if (await isConnected()) {
        const res = await api.get(`/sales/${id}`);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: sale details not available');
    }
    const sales = await getLocalSales();
    return sales.find(s => s.id === id) || null;
  },

  create: async (saleData, itemsData) => {
    try {
      if (await isConnected()) {
        const res = await api.post('/sales', { sale: saleData, items: itemsData });
        return res.data;
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
      console.error('Error creating sale:', error);
      throw error;
    }
  },

  getStats: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/sales/stats');
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using mock stats');
    }
    return MOCK_DATA.salesStats;
  },

  getClients: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/clients');
        await saveClientsLocally(res.data);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using cached clients');
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
        await saveProductsLocally(res.data);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using cached products');
    }
    return await getLocalProducts();
  },

  getProductByBarcode: async (barcode) => {
    try {
      if (await isConnected()) {
        const res = await api.get(`/products/barcode/${barcode}`);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: searching in cache');
    }
    const products = await getLocalProducts();
    return products.find(p => p.barcode === barcode) || null;
  },

  getLowStock: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/products/low-stock');
        await saveLowStockOffline(res.data);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using cached low stock');
    }
    const cached = await getLowStockOffline();
    return cached.length ? cached : MOCK_DATA.lowStock;
  },

  getMovements: async () => {
    try {
      if (await isConnected()) {
        const res = await api.get('/stock/movements');
        return res.data;
      }
    } catch (error) {
      console.log('Offline: movements not available');
    }
    return [];
  },

  updateStock: async (productId, qty, type) => {
    try {
      if (await isConnected()) {
        const res = await api.post('/stock/update', { product_id: productId, quantity: qty, type });
        return res.data;
      } else {
        await addPendingAction({
          type: 'UPDATE_STOCK',
          data: { productId, qty, type },
        });
        return { offline: true, message: 'Stock mis à jour localement' };
      }
    } catch (error) {
      console.error('Error updating stock:', error);
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
        await saveEmployeesOffline(res.data);
        return res.data;
      }
    } catch (error) {
      console.log('Offline: using cached employees');
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
      console.log('Offline: attendance not available');
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
      console.error('Error marking attendance:', error);
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
      console.log('Offline: payroll not available');
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
      console.log('Offline: monthly report not available');
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
      console.log('Offline: top products not available');
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
      console.log('Offline: PDF export not available');
    }
    return null;
  },
};

// ========== GESTIONNAIRE DE SYNCHRONISATION ==========
export const syncManager = {
  isSyncing: false,

  async syncAllData() {
    if (this.isSyncing) return;
    if (!(await isConnected())) {
      console.log('No internet connection');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting sync...');

    try {
      const pendingActions = await getPendingActions();
      for (const action of pendingActions) {
        try {
          switch (action.type) {
            case 'CREATE_SALE': {
              const { saleData, itemsData } = JSON.parse(action.data);
              await api.post('/sales', { sale: saleData, items: itemsData });
              break;
            }
            case 'UPDATE_STOCK': {
              const { productId, qty, type } = JSON.parse(action.data);
              await api.post('/stock/update', { product_id: productId, quantity: qty, type });
              break;
            }
            case 'MARK_ATTENDANCE': {
              const { employeeId, status } = JSON.parse(action.data);
              await api.post('/attendance', { employee_id: employeeId, status });
              break;
            }
            default:
              console.warn(`Unknown action type: ${action.type}`);
              continue;
          }
          await removePendingAction(action.id);
          console.log(`✓ Synced action: ${action.type}`);
        } catch (error) {
          console.error(`✗ Failed to sync action ${action.type}:`, error);
        }
      }

      // Rafraîchir les données locales
      await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getSalesWeek(),
        stockAPI.getProducts(),
        stockAPI.getLowStock(),
        salesAPI.getClients(),
        hrAPI.getEmployees(),
      ]);

      await setLastSyncTime();
      console.log('✅ Sync completed');
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  },

  sync: async () => {
    await this.syncAllData();
  },
};

// Export des données mockées pour fallback
export { MOCK_DATA };