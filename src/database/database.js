// src/database/database.js
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../services/logger';


// Ouvrir (ou créer) la base de données — instance unique partagée
export const db = SQLite.openDatabaseSync('erp.db');

// ── Mutex pour sérialiser les transactions SQLite ──────────────────────────
// SQLite n'accepte qu'une seule transaction à la fois sur la même connexion.
// Ce mutex garantit que les écritures concurrentes sont mises en file d'attente.
let _dbLock = Promise.resolve();
export const withDbTransaction = (fn) => {
  const result = _dbLock.then(() => fn());
  // La prochaine opération attend que celle-ci soit terminée (succès ou erreur)
  _dbLock = result.catch(() => {});
  return result;
};

// ========== INITIALISATION DES TABLES ==========
export const initDatabase = () => 
  withDbTransaction(async () => {
    try {
      // Table produits
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          barcode TEXT UNIQUE,
          category TEXT,
          price REAL NOT NULL,
          stock_quantity INTEGER DEFAULT 0,
          min_stock INTEGER DEFAULT 0,
          description TEXT,
          created_at TEXT
        );
      `);

      // Table clients
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          created_at TEXT
        );
      `);

      // Table ventes
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice TEXT UNIQUE,
          client_id INTEGER,
          client_name TEXT,
          total REAL,
          status TEXT DEFAULT 'pending',
          date TEXT,
          synced INTEGER DEFAULT 0,
          server_id INTEGER,
          created_at TEXT,
          FOREIGN KEY (client_id) REFERENCES clients(id)
        );
      `);
      // Migration : ajouter les colonnes manquantes à la table sales
      const tableInfo = await db.getAllAsync("PRAGMA table_info(sales)");
      const existingColumns = tableInfo.map(col => col.name);

      const columnsToAdd = {
        tva_applied: "INTEGER DEFAULT 1",
        payment_method: "TEXT",
        synced: "INTEGER DEFAULT 0",
        server_id: "INTEGER"
      };

      for (const [col, type] of Object.entries(columnsToAdd)) {
        if (!existingColumns.includes(col)) {
          await db.execAsync(`ALTER TABLE sales ADD COLUMN ${col} ${type}`);
          logger.info(`Column ${col} added to sales`);
        }
      }

      // Table items de vente
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          product_id INTEGER,
          barcode TEXT,
          name TEXT,
          quantity INTEGER,
          unit_price REAL,
          total REAL,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
      `);

      // Table employés
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          role TEXT,
          initials TEXT,
          status TEXT DEFAULT 'present',
          color TEXT,
          textColor TEXT,
          salary REAL,
          created_at TEXT
        );
      `);

      // Table statistiques dashboard (cachée, pour cache)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dashboard_stats (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          salesToday REAL,
          growth REAL,
          activeOrders INTEGER,
          lowStockCount INTEGER,
          totalProducts INTEGER,
          monthlyRevenue REAL,
          netProfit REAL,
          grossMargin REAL,
          updated_at TEXT
        );
      `);

      // Table ventes semaine (cache)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sales_week (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day TEXT,
          total REAL
        );
      `);

      // Table low stock (cache)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS low_stock (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER,
          name TEXT,
          current INTEGER,
          min INTEGER,
          category TEXT
        );
      `);

      // Table actions en attente (sync offline)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT,
          data TEXT,
          created_at TEXT
        );
      `);

      // Table sync info
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_info (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      
      // Initialiser les utilisateurs et les migrations
      await _initUsersTableInternal();
      await _migrateAddImageColumnInternal();

      logger.info('SQLite database initialized');
    } catch (error) {
      logger.error('DB initialization error', error);
    }
  });

// ========== PRODUITS ==========
export const saveProductsLocally = (products) =>
  withDbTransaction(async () => {
    await db.execAsync('BEGIN');
    try {
      await db.runAsync('DELETE FROM products');
      for (const p of products) {
        await db.runAsync(
          `INSERT INTO products (name, barcode, category, price, stock_quantity, min_stock, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          p.name, p.barcode || null, p.category || null, p.price || 0,
          p.stock_quantity || 0, p.min_stock || 0, p.description || null, p.created_at || new Date().toISOString()
        );
      }
      await db.execAsync('COMMIT');
      return true;
    } catch (innerError) {
      await db.execAsync('ROLLBACK');
      logger.error('Erreur saveProductsLocally', innerError);
      return false;
    }
  });

export const getLocalProducts = async () => {
  try {
    const result = await db.getAllAsync('SELECT * FROM products');
    return result;
  } catch (error) {
    logger.error('Erreur getLocalProducts', error);
    return [];
  }
};

export const getProductByBarcode = async (barcode) => {
  try {
    const result = await db.getFirstAsync('SELECT * FROM products WHERE barcode = ?', barcode);
    return result;
  } catch (error) {
    logger.error('Erreur getProductByBarcode', error);
    return null;
  }
};

export const findProductByAny = async (query) => {
  try {
    // 1. Essayer par barcode exact
    let result = await db.getFirstAsync('SELECT * FROM products WHERE barcode = ?', query);
    if (result) return result;

    // 2. Essayer par nom exact
    result = await db.getFirstAsync('SELECT * FROM products WHERE name = ?', query);
    if (result) return result;

    // 3. Essayer par barcode partiel ou nom partiel (LIKE)
    result = await db.getFirstAsync('SELECT * FROM products WHERE barcode LIKE ? OR name LIKE ? LIMIT 1', [`%${query}%`, `%${query}%`]);
    if (result) return result;

    // 4. Si multi-mots, essayer de chercher chaque mot (recherche plus floue)
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 1) {
      // Chercher un produit qui contient TOUS les mots longs (AND)
      const conditions = words.map(() => '(name LIKE ? OR barcode LIKE ?)').join(' AND ');
      const params = [];
      words.forEach(w => {
        params.push(`%${w}%`);
        params.push(`%${w}%`);
      });
      result = await db.getFirstAsync(`SELECT * FROM products WHERE ${conditions} LIMIT 1`, params);
    }

    return result;
  } catch (error) {
    logger.error('Erreur findProductByAny', error);
    return null;
  }
};

export const updateProductStock = (productId, newStock) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('UPDATE products SET stock_quantity = ? WHERE id = ?', newStock, productId);
      return true;
    } catch (error) {
      logger.error('Erreur updateProductStock', error);
      return false;
    }
  });

export const updateProduct = (productId, productData) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync(
        `UPDATE products SET name = ?, barcode = ?, category = ?, price = ?, stock_quantity = ?, min_stock = ?, description = ? WHERE id = ?`,
        productData.name,
        productData.barcode || null,
        productData.category || null,
        productData.price,
        productData.stock_quantity || 0,
        productData.min_stock || 0,
        productData.description || null,
        productId
      );
      return true;
    } catch (error) {
      logger.error('Erreur updateProduct', error);
      return false;
    }
  });

export const deleteProduct = (productId) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('DELETE FROM products WHERE id = ?', productId);
      return true;
    } catch (error) {
      logger.error('Erreur deleteProduct', error);
      return false;
    }
  });


// ========== VENTES ==========
// Extrait de database.js - fonction saveSaleLocally corrigée

// ========== CLIENTS ==========
export const saveClientsLocally = (clients) =>
  withDbTransaction(async () => {
    await db.execAsync('BEGIN');
    try {
      await db.runAsync('DELETE FROM clients');
      for (const c of clients) {
        await db.runAsync(
          `INSERT INTO clients (name, email, phone, address, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          c.name, c.email || null, c.phone || null, c.address || null, c.created_at || new Date().toISOString()
        );
      }
      await db.execAsync('COMMIT');
      return true;
    } catch (innerError) {
      await db.execAsync('ROLLBACK');
      logger.error('Erreur saveClientsLocally', innerError);
      return false;
    }
  });

export const getLocalClients = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM clients');
  } catch (error) {
    logger.error('Erreur getLocalClients', error);
    return [];
  }
};

// ========== SYNC ==========
export const setLastSyncTime = () =>
  withDbTransaction(async () => {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_info (key, value) VALUES ('last_sync', ?)`,
        new Date().toISOString()
      );
    } catch (error) {
      logger.error('Erreur setLastSyncTime', error);
    }
  });

export const getLastSyncTime = async () => {
  try {
    const result = await db.getFirstAsync('SELECT value FROM sync_info WHERE key = "last_sync"');
    return result ? result.value : null;
  } catch (error) {
    logger.error('Erreur getLastSyncTime', error);
    return null;
  }
};

// ========== TABLEAU DE BORD (cache) ==========
export const saveDashboardStatsOffline = (stats) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO dashboard_stats (id, salesToday, growth, activeOrders, lowStockCount, totalProducts, monthlyRevenue, netProfit, grossMargin, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        stats.salesToday, stats.growth, stats.activeOrders, stats.lowStockCount,
        stats.totalProducts, stats.monthlyRevenue, stats.netProfit, stats.grossMargin,
        new Date().toISOString()
      );
    } catch (error) {
      logger.error('Erreur saveDashboardStatsOffline', error);
    }
  });

export const getDashboardStatsOffline = async () => {
  try {
    const stats = await db.getFirstAsync('SELECT * FROM dashboard_stats WHERE id = 1');
    if (stats) {
      // Supprimer les colonnes internes
      delete stats.id;
      delete stats.updated_at;
    }
    return stats;
  } catch (error) {
    logger.error('Erreur getDashboardStatsOffline', error);
    return null;
  }
};

export const saveSalesWeekOffline = (salesWeek) =>
  withDbTransaction(async () => {
    try {
      await db.execAsync('DELETE FROM sales_week');
      for (const day of salesWeek) {
        await db.runAsync('INSERT INTO sales_week (day, total) VALUES (?, ?)', day.day, day.total);
      }
    } catch (error) {
      logger.error('Erreur saveSalesWeekOffline', error);
    }
  });

export const getSalesWeekOffline = async () => {
  try {
    return await db.getAllAsync('SELECT day, total FROM sales_week ORDER BY id');
  } catch (error) {
    logger.error('Erreur getSalesWeekOffline', error);
    return [];
  }
};

export const saveLowStockOffline = (lowStock) =>
  withDbTransaction(async () => {
    try {
      await db.execAsync('DELETE FROM low_stock');
      for (const item of lowStock) {
        await db.runAsync(
          `INSERT INTO low_stock (product_id, name, current, min, category)
           VALUES (?, ?, ?, ?, ?)`,
          item.product_id || null, item.name, item.current, item.min, item.category || null
        );
      }
    } catch (error) {
      logger.error('Erreur saveLowStockOffline', error);
    }
  });

export const getLowStockOffline = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM low_stock');
  } catch (error) {
    logger.error('Erreur getLowStockOffline', error);
    return [];
  }
};

// ========== EMPLOYÉS ==========
export const saveEmployeesOffline = (employees) =>
  withDbTransaction(async () => {
    try {
      await db.execAsync('DELETE FROM employees');
      for (const emp of employees) {
        await db.runAsync(
          `INSERT INTO employees (name, role, initials, status, color, textColor, salary, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          emp.name, emp.role, emp.initials, emp.status || 'present',
          emp.color || '#E3F2FD', emp.textColor || '#0D47A1', emp.salary || 0,
          emp.created_at || new Date().toISOString()
        );
      }
    } catch (error) {
      logger.error('Erreur saveEmployeesOffline', error);
    }
  });

export const getEmployeesOffline = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM employees');
  } catch (error) {
    logger.error('Erreur getEmployeesOffline', error);
    return [];
  }
};

// ========== ACTIONS EN ATTENTE ==========
export const addPendingAction = (action) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync(
        `INSERT INTO pending_actions (type, data, created_at)
         VALUES (?, ?, ?)`,
        action.type, JSON.stringify(action.data), new Date().toISOString()
      );
    } catch (error) {
      logger.error('Erreur addPendingAction', error);
    }
  });

export const getPendingActions = async () => {
  try {
    return await db.getAllAsync('SELECT * FROM pending_actions ORDER BY id');
  } catch (error) {
    logger.error('Erreur getPendingActions', error);
    return [];
  }
};

export const removePendingAction = (actionId) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('DELETE FROM pending_actions WHERE id = ?', actionId);
    } catch (error) {
      logger.error('Erreur removePendingAction', error);
    }
  });

// ========== NETTOYAGE ==========
export const clearAllData = () =>
  withDbTransaction(async () => {
    try {
      // Supprimer le contenu de toutes les tables
      const tables = [
        'products', 'sales', 'sale_items', 'clients', 'employees',
        'dashboard_stats', 'sales_week', 'low_stock', 'pending_actions', 'sync_info', 'users'
      ];
      for (const table of tables) {
        await db.execAsync(`DELETE FROM ${table}`);
        if (table !== 'sync_info' && table !== 'dashboard_stats') {
          await db.execAsync(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
        }
      }
    await db.runAsync('DELETE FROM invoice_counter');
    // Recréer le compteur de facture (valeur initiale 999)
    await db.execAsync(`CREATE TABLE IF NOT EXISTS invoice_counter (id INTEGER PRIMARY KEY CHECK (id = 1), last_number INTEGER DEFAULT 999)`);
    await db.runAsync('INSERT OR IGNORE INTO invoice_counter (id, last_number) VALUES (1, 999)');
    // Recréer l'utilisateur admin par défaut
    await db.runAsync(
      `INSERT INTO users (username, password, role, fullname, created_at) VALUES (?, ?, ?, ?, ?)`,
      'admin', 'admin123', 'admin', 'Administrateur', new Date().toISOString()
    );
    logger.info('All SQLite data cleared, admin recreated');
    } catch (error) {
      logger.error('Erreur clearAllData', error);
    }
  });

// ========== GESTION DES UTILISATEURS ==========
const _initUsersTableInternal = async () => {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        fullname TEXT,
        created_at TEXT
      );
    `);
    // Créer l'admin par défaut si aucun utilisateur
    const admin = await db.getFirstAsync('SELECT * FROM users WHERE username = ?', 'admin');
    if (!admin) {
      await db.runAsync(
        `INSERT INTO users (username, password, role, fullname, created_at) VALUES (?, ?, ?, ?, ?)`,
        'admin', 'admin123', 'admin', 'Administrateur', new Date().toISOString()
      );
    }
  } catch (error) {
    logger.error('Erreur _initUsersTableInternal', error);
  }
};

export const initUsersTable = () => withDbTransaction(_initUsersTableInternal);

export const getUsers = async () => {
  try {
    return await db.getAllAsync('SELECT id, username, role, fullname, created_at FROM users');
  } catch (error) {
    logger.error('Erreur getUsers', error);
    return [];
  }
};

export const getUserByUsername = async (username) => {
  try {
    return await db.getFirstAsync('SELECT * FROM users WHERE username = ?', username);
  } catch (error) {
    logger.error('Erreur getUserByUsername', error);
    return null;
  }
};

export const addUser = (username, password, role, fullname) =>
  withDbTransaction(async () => {
    try {
      const existing = await getUserByUsername(username);
      if (existing) throw new Error('Nom d\'utilisateur déjà existant');
      await db.runAsync(
        `INSERT INTO users (username, password, role, fullname, created_at) VALUES (?, ?, ?, ?, ?)`,
        username, password, role, fullname, new Date().toISOString()
      );
      return true;
    } catch (error) {
      throw error;
    }
  });

export const updateUserPassword = (userId, newPassword) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('UPDATE users SET password = ? WHERE id = ?', newPassword, userId);
      return true;
    } catch (error) {
      console.error('Erreur updateUserPassword:', error);
      return false;
    }
  });

export const deleteUser = (userId) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('DELETE FROM users WHERE id = ?', userId);
      return true;
    } catch (error) {
      console.error('Erreur deleteUser:', error);
      return false;
    }
  });

export const getCurrentUser = async () => {
  const userJson = await AsyncStorage.getItem('@erp_current_user');
  return userJson ? JSON.parse(userJson) : null;
};

export const setCurrentUser = async (user) => {
  await AsyncStorage.setItem('@erp_current_user', JSON.stringify(user));
};

export const clearCurrentUser = async () => {
  await AsyncStorage.removeItem('@erp_current_user');
};

// src/database/database.js (ajouter à la fin du fichier)

/**
 * Importe une vente depuis un fichier .DAT (format paramètres URL)
 * - Crée ou récupère le client
 * - Pour chaque article : recherche ou crée le produit, incrémente le stock
 * - Enregistre la vente avec les items (sans décrémenter le stock)
 * - Ne passe pas par la file d'attente de synchronisation
 */
export const importSaleFromDAT = (saleData, itemsData) =>
  withDbTransaction(async () => {
    let saleId;
    await db.execAsync('BEGIN');
    try {
      // 1. Générer un numéro de facture unique
      const invoiceNumber = saleData.invoice_number || `IMP-${Date.now()}`;

      // 2. Insérer la vente (synced = 1 pour ne pas la synchroniser)
      const result = await db.runAsync(
        `INSERT INTO sales (invoice, client_id, client_name, total, status, date, tva_applied, payment_method, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        invoiceNumber,
        saleData.client_id || null,
        saleData.client_name,
        saleData.total,
        saleData.status || 'paid',
        saleData.date || new Date().toISOString().split('T')[0],
        saleData.tva_applied ? 1 : 0,
        saleData.payment_method || 'cash',
        1, // synced = 1 (ne pas mettre en file d'attente)
        new Date().toISOString()
      );
      saleId = result.lastInsertRowId;

      // 3. Insérer les items et mettre à jour le stock (incrémentation)
      for (const item of itemsData) {
        await db.runAsync(
          `INSERT INTO sale_items (sale_id, product_id, barcode, name, quantity, unit_price, total, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          saleId,
          item.product_id || null,
          item.barcode,
          item.name,
          item.quantity,
          item.unit_price,
          item.total,
          1
        );

        // Incrémenter le stock du produit (car import = ajout au stock)
        if (item.product_id) {
          await db.runAsync(
            `UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?`,
            item.quantity, item.product_id
          );
        } else if (item.barcode) {
          await db.runAsync(
            `UPDATE products SET stock_quantity = stock_quantity + ? WHERE barcode = ?`,
            item.quantity, item.barcode
          );
        }
      }
      await db.execAsync('COMMIT');
      return saleId;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  });

// src/database/database.js
// Ajouter après les fonctions existantes

// Migration : ajouter colonne image à la table products
const _migrateAddImageColumnInternal = async () => {
  try {
    const tableInfo = await db.getAllAsync("PRAGMA table_info(products)");
    const hasImageColumn = tableInfo.some(col => col.name === 'image');
    if (!hasImageColumn) {
      await db.execAsync("ALTER TABLE products ADD COLUMN image TEXT");
      console.log("✅ Colonne image ajoutée à products");
    }
  } catch (error) {
    console.error("Erreur migration image column:", error);
  }
};

export const migrateAddImageColumn = () => withDbTransaction(_migrateAddImageColumnInternal);

// Mettre à jour l'image d'un produit
export const updateProductImage = (productId, imageBase64) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync("UPDATE products SET image = ? WHERE id = ?", [imageBase64, productId]);
      return true;
    } catch (error) {
      console.error("Erreur updateProductImage:", error);
      return false;
    }
  });

// Mettre à jour le barcode d'un produit
export const updateProductBarcode = (productId, barcode) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync("UPDATE products SET barcode = ? WHERE id = ?", [barcode, productId]);
      return true;
    } catch (error) {
      console.error("Erreur updateProductBarcode:", error);
      return false;
    }
  });

// Créer un produit avec image et barcode
export const addProductWithImage = (productData) =>
  withDbTransaction(async () => {
    try {
      const result = await db.runAsync(
        `INSERT INTO products (name, barcode, category, price, stock_quantity, min_stock, description, image, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productData.name,
          productData.barcode || null,
          productData.category || '',
          productData.price || 0,
          productData.stock_quantity || 0,
          productData.min_stock || 0,
          productData.description || '',
          productData.image || null,
          productData.created_at || new Date().toISOString()
        ]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error("Erreur addProductWithImage:", error);
      throw error;
    }
  });


// Initialiser la base au démarrage de l'app est maintenant géré par App.js explicitement
