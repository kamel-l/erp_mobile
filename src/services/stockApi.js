import { api, isConnected } from './apiClient';
import { logger } from './logger';
import { MOCK_DATA } from './mockData';
import {
  getLocalProducts, upsertProductsLocally, getLowStockOffline, saveLowStockOffline,
  addPendingAction
} from '../database/database';

export const stockAPI = {
  getProducts: async (params = {}) => {
    try {
      if (await isConnected()) {
        const res = await api.get('/products', { params });
        const data = res.data.data || res.data;
        if (Array.isArray(data) && data.length > 0 && typeof upsertProductsLocally === 'function') {
          await upsertProductsLocally(data);
        }
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

  deleteProduct: async (productId) => {
    try {
      if (await isConnected()) {
        const res = await api.delete(`/products/${productId}`);
        return res.data.data || res.data;
      }
      await addPendingAction({
        type: 'DELETE_PRODUCT',
        data: { productId },
      });
      return { offline: true, message: 'Produit supprimé localement' };
    } catch (error) {
      logger.error('Error deleting product', error);
      throw error;
    }
  },
};
