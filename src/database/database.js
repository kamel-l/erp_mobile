// src/database/database.js
import * as SQLite from 'expo-sqlite';
import { logger } from '../services/logger';

export const db = SQLite.openDatabaseSync('erp.db');

let _dbLock = Promise.resolve();
export const withDbTransaction = (fn) => {
  const result = _dbLock.then(() => fn());
  _dbLock = result.catch(() => { });
  return result;
};

let _dbReadyResolve;
export const dbReady = new Promise(resolve => { _dbReadyResolve = resolve; });

export const initDatabase = () =>
  withDbTransaction(async () => {
    try {
      await db.execAsync(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER, name TEXT NOT NULL, barcode TEXT UNIQUE, category TEXT, price REAL NOT NULL, stock_quantity INTEGER DEFAULT 0, min_stock INTEGER DEFAULT 0, description TEXT, created_at TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, created_at TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice TEXT UNIQUE, client_id INTEGER, client_name TEXT, total REAL, status TEXT DEFAULT 'pending', date TEXT, synced INTEGER DEFAULT 0, server_id INTEGER, created_at TEXT, FOREIGN KEY (client_id) REFERENCES clients(id));`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, product_id INTEGER, barcode TEXT, name TEXT, quantity INTEGER, unit_price REAL, total REAL, synced INTEGER DEFAULT 0, FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id));`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT, initials TEXT, status TEXT DEFAULT 'present', color TEXT, textColor TEXT, salary REAL, created_at TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS dashboard_stats (id INTEGER PRIMARY KEY CHECK (id = 1), salesToday REAL, growth REAL, activeOrders INTEGER, lowStockCount INTEGER, totalProducts INTEGER, monthlyRevenue REAL, netProfit REAL, grossMargin REAL, updated_at TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS sales_week (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, total REAL);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS low_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, name TEXT, current INTEGER, min INTEGER, category TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS pending_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, data TEXT, created_at TEXT, retry_count INTEGER DEFAULT 0, last_error TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS sync_info (key TEXT PRIMARY KEY, value TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT UNIQUE, supplier_name TEXT, total REAL DEFAULT 0, status TEXT DEFAULT 'pending', date TEXT, notes TEXT, synced INTEGER DEFAULT 0, created_at TEXT);`);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS purchase_items (id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER NOT NULL, product_id INTEGER, barcode TEXT, name TEXT, quantity INTEGER DEFAULT 0, unit_price REAL DEFAULT 0, total REAL DEFAULT 0, FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products(id));`);

      const hasCol = async (table, col) => {
        const info = await db.getAllAsync(`PRAGMA table_info(${table})`);
        return info.some(c => c.name === col);
      };

      for (const [col, type] of Object.entries({ reference: 'TEXT', supplier_name: 'TEXT', total: 'REAL DEFAULT 0', status: "TEXT DEFAULT 'pending'", date: 'TEXT', notes: 'TEXT', synced: 'INTEGER DEFAULT 0', created_at: 'TEXT' })) {
        if (!(await hasCol('purchases', col))) await db.execAsync(`ALTER TABLE purchases ADD COLUMN ${col} ${type}`);
      }

      if (!(await hasCol('products', 'server_id'))) await db.execAsync('ALTER TABLE products ADD COLUMN server_id INTEGER');
      if (!(await hasCol('clients', 'server_id'))) await db.execAsync('ALTER TABLE clients ADD COLUMN server_id INTEGER');

      for (const [col, type] of Object.entries({ invoice: 'TEXT', client_id: 'INTEGER', client_name: 'TEXT', total: 'REAL DEFAULT 0', status: "TEXT DEFAULT 'pending'", date: 'TEXT', tva_applied: 'INTEGER DEFAULT 1', payment_method: 'TEXT', synced: 'INTEGER DEFAULT 0', server_id: 'INTEGER', created_at: 'TEXT' })) {
        if (!(await hasCol('sales', col))) await db.execAsync(`ALTER TABLE sales ADD COLUMN ${col} ${type}`);
      }

      for (const [col, type] of Object.entries({ sale_id: 'INTEGER', product_id: 'INTEGER', barcode: 'TEXT', name: 'TEXT', quantity: 'INTEGER DEFAULT 0', unit_price: 'REAL DEFAULT 0', total: 'REAL DEFAULT 0', synced: 'INTEGER DEFAULT 0' })) {
        if (!(await hasCol('sale_items', col))) await db.execAsync(`ALTER TABLE sale_items ADD COLUMN ${col} ${type}`);
      }

      if (!(await hasCol('pending_actions', 'retry_count'))) await db.execAsync("ALTER TABLE pending_actions ADD COLUMN retry_count INTEGER DEFAULT 0");
      if (!(await hasCol('pending_actions', 'last_error'))) await db.execAsync("ALTER TABLE pending_actions ADD COLUMN last_error TEXT");

      const { _initUsersTableInternal, _migrateAddImageColumnInternal } = await import('./userRepository');
      await _initUsersTableInternal();
      await _migrateAddImageColumnInternal();

      logger.info('SQLite database initialized');
      _dbReadyResolve();
    } catch (error) {
      logger.error('DB initialization error', error);
    }
  });

export const clearAllData = () =>
  withDbTransaction(async () => {
    try {
      for (const table of ['products', 'sales', 'sale_items', 'clients', 'employees', 'dashboard_stats', 'sales_week', 'low_stock', 'pending_actions', 'sync_info', 'users']) {
        await db.execAsync(`DELETE FROM ${table}`);
        if (table !== 'sync_info' && table !== 'dashboard_stats') await db.execAsync(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
      }
      await db.runAsync('DELETE FROM invoice_counter');
      await db.execAsync('CREATE TABLE IF NOT EXISTS invoice_counter (id INTEGER PRIMARY KEY CHECK (id = 1), last_number INTEGER DEFAULT 999)');
      await db.runAsync('INSERT OR IGNORE INTO invoice_counter (id, last_number) VALUES (1, 999)');
      await db.runAsync('INSERT INTO users (username, password, role, fullname, created_at) VALUES (?, ?, ?, ?, ?)', 'admin', 'admin123', 'admin', 'Administrateur', new Date().toISOString());
      logger.info('All SQLite data cleared, admin recreated');
    } catch (error) {
      logger.error('Erreur clearAllData', error);
    }
  });

export const importSaleFromDAT = (saleData, itemsData) =>
  withDbTransaction(async () => {
    let saleId;
    await db.execAsync('BEGIN');
    try {
      const invoiceNumber = saleData.invoice_number || `IMP-${Date.now()}`;
      const result = await db.runAsync(
        `INSERT INTO sales (invoice, client_id, client_name, total, status, date, tva_applied, payment_method, synced, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        invoiceNumber, saleData.client_id || null, saleData.client_name, saleData.total, saleData.status || 'paid',
        saleData.date || new Date().toISOString().split('T')[0], saleData.tva_applied ? 1 : 0, saleData.payment_method || 'cash', 1, new Date().toISOString()
      );
      saleId = result.lastInsertRowId;
      for (const item of itemsData) {
        await db.runAsync(`INSERT INTO sale_items (sale_id, product_id, barcode, name, quantity, unit_price, total, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          saleId, item.product_id || null, item.barcode, item.name, item.quantity, item.unit_price, item.total, 1);
        if (item.product_id) {
          await db.runAsync('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', item.quantity, item.product_id);
        } else if (item.barcode) {
          await db.runAsync('UPDATE products SET stock_quantity = stock_quantity + ? WHERE barcode = ?', item.quantity, item.barcode);
        }
      }
      await db.execAsync('COMMIT');
      return saleId;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  });

export const migrateAddImageColumn = async () => {
  const { migrateAddImageColumn: mig } = await import('./userRepository');
  return mig();
};

// Re-exports des repositories spécialisés
export {
  saveProductsLocally, getLocalProducts, upsertProductsLocally,
  getProductByBarcode, findProductByAny, updateProductStock,
  updateProduct, deleteProduct, updateProductImage,
  updateProductBarcode, addProductWithImage
} from './productRepository';

export {
  saveClientsLocally, getLocalClients, upsertClientsLocally, applyDeletedEntities
} from './clientRepository';

export {
  savePurchaseLocally, getLocalPurchases, getPurchaseItems,
  updatePurchaseStatus, deletePurchase
} from './purchaseRepository';

export {
  initUsersTable, getUsers, getUserByUsername, addUser,
  updateUserPassword, deleteUser, getCurrentUser,
  setCurrentUser, clearCurrentUser
} from './userRepository';

export {
  saveDashboardStatsOffline, getDashboardStatsOffline,
  saveSalesWeekOffline, getSalesWeekOffline,
  saveLowStockOffline, getLowStockOffline
} from './dashboardRepository';

export {
  saveEmployeesOffline, getEmployeesOffline
} from './employeeRepository';

export {
  addPendingAction, getPendingActions, removePendingAction,
  markPendingActionError, setLastSyncTime, getLastSyncTime
} from './syncRepository';
