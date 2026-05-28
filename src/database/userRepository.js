import { db, withDbTransaction, dbReady } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../services/logger';

export const _initUsersTableInternal = async () => {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        fullname TEXT,
        created_at TEXT
      )
    `);
    const existingAdmin = await db.getFirstAsync('SELECT id FROM users WHERE username = ?', 'admin');
    if (!existingAdmin) {
      await db.runAsync(
        `INSERT INTO users (username, password, role, fullname, created_at) VALUES (?, ?, ?, ?, ?)`,
        'admin', 'admin123', 'admin', 'Administrateur', new Date().toISOString()
      );
    }
  } catch (error) {
    logger.error('Erreur init users table', error);
  }
};

export const initUsersTable = () => withDbTransaction(_initUsersTableInternal);

export const getUsers = async () => {
  await dbReady;
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
      logger.error('Erreur updateUserPassword', error);
      return false;
    }
  });

export const deleteUser = (userId) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('DELETE FROM users WHERE id = ?', userId);
      return true;
    } catch (error) {
      logger.error('Erreur deleteUser', error);
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

export const _migrateAddImageColumnInternal = async () => {
  try {
    const tableInfo = await db.getAllAsync("PRAGMA table_info(products)");
    const hasImageColumn = tableInfo.some(col => col.name === 'image');
    if (!hasImageColumn) {
      await db.execAsync("ALTER TABLE products ADD COLUMN image TEXT");
      logger.info("Colonne image ajoutée à products");
    }
  } catch (error) {
    logger.error("Erreur migration image column", error);
  }
};

export const migrateAddImageColumn = () => withDbTransaction(_migrateAddImageColumnInternal);
