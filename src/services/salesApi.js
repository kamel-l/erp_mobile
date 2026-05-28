import { api, isConnected, generateOperationId } from './apiClient';
import { logger } from './logger';
import { MOCK_DATA } from './mockData';
import {
  getLocalProducts, saveProductsLocally, getLocalClients, saveClientsLocally,
  addPendingAction, getPendingActions, removePendingAction
} from '../database/database';
import { getLocalSales, saveSaleLocally, saveSalesOffline } from '../database/salesRepository';

export const salesAPI = {
  getAll: async (params = {}) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/sales', { params });
        const data = res.data.data || res.data;
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
        const res = await api.post('/sales', {
          operation_id: generateOperationId(),
          ...saleData,
          items: itemsData
        });
        return res.data.data || res.data;
      } else {
        const saleId = await saveSaleLocally(saleData, itemsData);
        return { offline: true, saleId, message: 'Vente sauvegardée localement' };
      }
    } catch (error) {
      logger.error('Error creating sale', error);
      throw error;
    }
  },

  updateStatus: async (id, status) => {
    try {
      if (await isConnected()) {
        const res = await api.put(`/sales/${id}/status`, { status });
        return res.data;
      } else {
        await addPendingAction({
          type: 'UPDATE_SALE_STATUS',
          data: { id, status },
        });
        return { offline: true, message: 'Statut mis à jour localement' };
      }
    } catch (error) {
      logger.error('Error updating sale status', error);
      throw error;
    }
  },

  deleteSale: async (id) => {
    try {
      if (await isConnected()) {
        const res = await api.delete(`/sales/${id}`);
        return res.data;
      } else {
        await addPendingAction({
          type: 'DELETE_SALE',
          data: { id },
        });
        return { offline: true, message: 'Facture supprimée localement' };
      }
    } catch (error) {
      logger.error('Error deleting sale', error);
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
