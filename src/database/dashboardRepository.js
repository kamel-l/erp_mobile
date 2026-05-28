import { db, withDbTransaction, dbReady } from './database';
import { logger } from '../services/logger';

export const saveDashboardStatsOffline = async (stats) => {
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO dashboard_stats (id, total_revenue, total_orders, total_products, total_clients, low_stock_count, net_profit, gross_margin, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      stats.total_revenue || 0, stats.total_orders || 0, stats.total_products || 0,
      stats.total_clients || 0, stats.low_stock_count || 0, stats.net_profit || 0,
      stats.gross_margin || 0, new Date().toISOString()
    );
  } catch (error) {
    logger.error('Erreur saveDashboardStatsOffline', error);
  }
};

export const getDashboardStatsOffline = async () => {
  try {
    const row = await db.getFirstAsync('SELECT * FROM dashboard_stats WHERE id = 1');
    if (!row) return null;
    const { id, updated_at, ...stats } = row;
    return stats;
  } catch (error) {
    logger.error('Erreur getDashboardStatsOffline', error);
    return null;
  }
};

export const saveSalesWeekOffline = async (salesWeek) => {
  try {
    await db.runAsync('DELETE FROM sales_week');
    for (const sw of salesWeek || []) {
      await db.runAsync(
        `INSERT INTO sales_week (day_name, total) VALUES (?, ?)`,
        sw.day_name || sw.day, sw.total || 0
      );
    }
  } catch (error) {
    logger.error('Erreur saveSalesWeekOffline', error);
  }
};

export const getSalesWeekOffline = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM sales_week ORDER BY id');
  } catch (error) {
    logger.error('Erreur getSalesWeekOffline', error);
    return [];
  }
};

export const saveLowStockOffline = async (lowStock) => {
  try {
    await db.runAsync('DELETE FROM low_stock');
    for (const ls of lowStock || []) {
      await db.runAsync(
        `INSERT INTO low_stock (product_id, name, stock_quantity) VALUES (?, ?, ?)`,
        ls.product_id || ls.id, ls.name, ls.stock_quantity || 0
      );
    }
  } catch (error) {
    logger.error('Erreur saveLowStockOffline', error);
  }
};

export const getLowStockOffline = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM low_stock');
  } catch (error) {
    logger.error('Erreur getLowStockOffline', error);
    return [];
  }
};
