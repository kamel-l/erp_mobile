// src/services/api.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import {
  saveProductsOffline,
  getProductsOffline,
  saveDashboardStatsOffline,
  getDashboardStatsOffline,
  saveSalesWeekOffline,
  getSalesWeekOffline,
  saveLowStockOffline,
  getLowStockOffline,
  saveEmployeesOffline,
  getEmployeesOffline,
  saveClientsOffline,
  getClientsOffline,
  addPendingAction,
  getPendingActions,
  removePendingAction,
  setLastSyncTime,
  getLastSyncTime,
} from '../database/database'; // ← nouveau chemin
import { MOCK_DATA } from './mockData';

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
// Remplacez par l'IP de votre machine sur le réseau local
const BASE_URL = 'http://192.168.1.65:5000';  // ← CHANGEZ CETTE IP

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject token automatiquement
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Vérification de connexion
export const isConnected = async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable;
  } catch (error) {
    return false;
  }
};

// ─── AUTHENTIFICATION ─────────────────────────────────────────────────────────
export const authAPI = {
  login: async (username, password) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      await SecureStore.setItemAsync('auth_token', res.data.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(res.data.user));

      // Synchroniser les données après login
      await syncManager.syncAllData();

      return res.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
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

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getStats: async () => {
    try {
      if (await isConnected()) {
        const response = await api.get('/dashboard/stats');
        await saveDashboardStatsOffline(response.data);
        return response.data;
      }
    } catch (error) {
      console.log('Offline: using cached stats');
    }

    // Fallback offline
    const cached = await getDashboardStatsOffline();
    return cached || MOCK_DATA.stats;
  },

  getSalesWeek: async () => {
    try {
      if (await isConnected()) {
        const response = await api.get('/dashboard/sales-week');
        await saveSalesWeekOffline(response.data);
        return response.data;
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
        const response = await api.get('/dashboard/alerts');
        return response.data;
      }
    } catch (error) {
      console.log('Offline: using mock alerts');
    }
    return MOCK_DATA.alerts || [];
  },
};

// ─── VENTES ───────────────────────────────────────────────────────────────────
export const salesAPI = {
  getAll: async (params = {}) => {
    try {
      if (await isConnected()) {
        const response = await api.get('/sales', { params });
        await saveSalesOffline(response.data);
        return response.data;
      }
    } catch (error) {
      console.log('Offline: using cached sales');
    }

    const cached = await getSalesOffline();
    return cached;
  },

  getById: async (id) => {
    try {
      if (await isConnected()) {
        const response = await api.get(`/sales/${id}`);
        return response.data;
      }
    } catch (error) {
      console.log('Offline: sale details not available');
    }
    return null;
  },

  create: async (data) => {
    try {
      if (await isConnected()) {
        const response = await api.post('/sales', data);
        return response.data;
      } else {
        // Stocker pour synchronisation ultérieure
        await addPendingAction({
          type: 'CREATE_SALE',
          data: data,
        });
        return { offline: true, message: 'Vente sauvegardée localement, sera synchronisée plus tard' };
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  },

  getStats: async () => {
    try {
      if (await isConnected()) {
        const response = await api.get('/sales/stats');
        return response.data;
      }
    } catch (error) {
      console.log('Offline: using mock stats');
    }
    return MOCK_DATA.salesStats;
  },

  getClients: async () => {
    try {
      if (await isConnected()) {
        const response = await api.get('/clients');
        await saveClientsOffline(response.data);
        return response.data;
      }
    } catch (error) {
      console.log('Offline: using cached clients');
    }
    return await getClientsOffline();
  },
};

// ─── STOCK ────────────────────────────────────────────────────────────────────
export const stockAPI = {
  getProducts: async (params = {}) => {
    try {
      if (await isConnected()) {
        const response = await api.get('/products', { params });
        await saveProductsOffline(response.data);
        return response.data;
      }
    } catch (error) {
      console.log('Offline: using cached products');
    }

    const cached = await getProductsOffline();
    return cached;
  },

  getProductByBarcode: async (barcode) => {
    try {
      if (await isConnected()) {
        const response = await api.get(`/products/barcode/${barcode}`);
        return response.data;
      }
    } catch (error) {
      console.log('Offline: searching in cache');
    }

    const products = await getProductsOffline();
    return products.find(p => p.barcode === barcode) || null;
  },

  getLowStock: async () => {
    try {
      if (await isConnected()) {
        const response = await api.get('/products/low-stock');
        await saveLowStockOffline(response.data);
        return response.data;
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
        const response = await api.get('/stock/movements');
        return response.data;
      }
    } catch (error) {
      console.log('Offline: movements not available');
    }
    return [];
  },

  updateStock: async (productId, qty, type) => {
    try {
      if (await isConnected()) {
        const response = await api.post('/stock/update', { product_id: productId, quantity: qty, type });
        return response.data;
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

// ─── RH ───────────────────────────────────────────────────────────────────────
export const hrAPI = {
  getEmployees: async () => {
    try {
      if (await isConnected()) {
        const response = await api.get('/employees');
        await saveEmployeesOffline(response.data);
        return response.data;
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
        const response = await api.get('/attendance', { params: { date } });
        return response.data;
      }
    } catch (error) {
      console.log('Offline: attendance not available');
    }
    return [];
  },

  markAttendance: async (employeeId, status) => {
    try {
      if (await isConnected()) {
        const response = await api.post('/attendance', { employee_id: employeeId, status });
        return response.data;
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
        const response = await api.get('/payroll/current');
        return response.data;
      }
    } catch (error) {
      console.log('Offline: payroll not available');
    }
    return null;
  },
};

// ─── RAPPORTS ─────────────────────────────────────────────────────────────────
export const reportsAPI = {
  getMonthly: async (year, month) => {
    try {
      if (await isConnected()) {
        const response = await api.get('/reports/monthly', { params: { year, month } });
        return response.data;
      }
    } catch (error) {
      console.log('Offline: monthly report not available');
    }
    return null;
  },

  getTopProducts: async () => {
    try {
      if (await isConnected()) {
        const response = await api.get('/reports/top-products');
        return response.data;
      }
    } catch (error) {
      console.log('Offline: top products not available');
    }
    return [];
  },

  exportPDF: async (type) => {
    try {
      if (await isConnected()) {
        const response = await api.get(`/reports/export/${type}`, { responseType: 'blob' });
        return response.data;
      }
    } catch (error) {
      console.log('Offline: PDF export not available');
    }
    return null;
  },
};

// ─── GESTIONNAIRE DE SYNCHRONISATION ──────────────────────────────────────────
export const syncManager = {
  isSyncing: false,

  syncAllData: async () => {
    if (this.isSyncing) return;

    if (!await isConnected()) {
      console.log('No internet connection');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting sync...');

    try {
      // Sync pending actions
      const pendingActions = await getPendingActions();
      for (const action of pendingActions) {
        try {
          switch (action.type) {
            case 'CREATE_SALE':
              await api.post('/sales', action.data);
              break;
            case 'UPDATE_STOCK':
              await api.post('/stock/update', action.data);
              break;
            case 'MARK_ATTENDANCE':
              await api.post('/attendance', action.data);
              break;
          }
          await removePendingAction(action.id);
          console.log(`✓ Synced action: ${action.type}`);
        } catch (error) {
          console.error(`✗ Failed to sync action ${action.type}:`, error);
        }
      }

      // Refresh all data
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
};

// Export MOCK_DATA séparé
export { MOCK_DATA };