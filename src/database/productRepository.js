import { db, withDbTransaction, dbReady } from './database';
import { logger } from '../services/logger';

export const saveProductsLocally = (products) =>
  withDbTransaction(async () => {
    await db.execAsync('BEGIN');
    try {
      await db.runAsync('DELETE FROM products');
      for (const p of products) {
        const price = p.price !== undefined ? p.price : (p.selling_price !== undefined ? p.selling_price : 0);
        const category = p.category || p.category_name || null;
        await db.runAsync(
          `INSERT INTO products (server_id, name, barcode, category, price, stock_quantity, min_stock, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          p.id || p.server_id || null,
          p.name, p.barcode || null, category, price,
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
  await dbReady;
  try {
    return await db.getAllAsync('SELECT * FROM products');
  } catch (error) {
    logger.error('Erreur getLocalProducts', error);
    return [];
  }
};

export const upsertProductsLocally = (products) =>
  withDbTransaction(async () => {
    await db.execAsync('BEGIN');
    try {
      for (const p of products || []) {
        const serverId = p.id || p.server_id || null;
        const existing = serverId
          ? await db.getFirstAsync('SELECT id FROM products WHERE server_id = ?', serverId)
          : null;
        const price = p.price !== undefined ? p.price : (p.selling_price !== undefined ? p.selling_price : 0);
        const category = p.category || p.category_name || null;
        const createdAt = p.created_at || new Date().toISOString();

        if (existing?.id) {
          await db.runAsync(
            `UPDATE products SET name = ?, barcode = ?, category = ?, price = ?, stock_quantity = ?, min_stock = ?, description = ?, created_at = ? WHERE id = ?`,
            p.name, p.barcode || null, category, price,
            p.stock_quantity || 0, p.min_stock || 0, p.description || null, createdAt, existing.id
          );
        } else {
          await db.runAsync(
            `INSERT INTO products (server_id, name, barcode, category, price, stock_quantity, min_stock, description, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            serverId, p.name, p.barcode || null, category, price,
            p.stock_quantity || 0, p.min_stock || 0, p.description || null, createdAt
          );
        }
      }
      await db.execAsync('COMMIT');
      return true;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      logger.error('Erreur upsertProductsLocally', error);
      return false;
    }
  });

export const getProductByBarcode = async (barcode) => {
  try {
    return await db.getFirstAsync('SELECT * FROM products WHERE barcode = ?', barcode);
  } catch (error) {
    logger.error('Erreur getProductByBarcode', error);
    return null;
  }
};

export const findProductByAny = async (query) => {
  try {
    let result = await db.getFirstAsync('SELECT * FROM products WHERE barcode = ?', query);
    if (result) return result;
    result = await db.getFirstAsync('SELECT * FROM products WHERE name = ?', query);
    if (result) return result;
    result = await db.getFirstAsync('SELECT * FROM products WHERE barcode LIKE ? OR name LIKE ? LIMIT 1', [`%${query}%`, `%${query}%`]);
    if (result) return result;
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 1) {
      const conditions = words.map(() => '(name LIKE ? OR barcode LIKE ?)').join(' AND ');
      const params = [];
      words.forEach(w => { params.push(`%${w}%`); params.push(`%${w}%`); });
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
        productData.name, productData.barcode || null, productData.category || null,
        productData.price, productData.stock_quantity || 0, productData.min_stock || 0,
        productData.description || null, productId
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

export const updateProductImage = (productId, imageBase64) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync("UPDATE products SET image = ? WHERE id = ?", [imageBase64, productId]);
      return true;
    } catch (error) {
      logger.error("Erreur updateProductImage", error);
      return false;
    }
  });

export const updateProductBarcode = (productId, barcode) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync("UPDATE products SET barcode = ? WHERE id = ?", [barcode, productId]);
      return true;
    } catch (error) {
      logger.error("Erreur updateProductBarcode", error);
      return false;
    }
  });

export const addProductWithImage = (productData) =>
  withDbTransaction(async () => {
    try {
      const result = await db.runAsync(
        `INSERT INTO products (name, barcode, category, price, stock_quantity, min_stock, description, image, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [productData.name, productData.barcode || null, productData.category || '',
         productData.price || 0, productData.stock_quantity || 0, productData.min_stock || 0,
         productData.description || '', productData.image || null, productData.created_at || new Date().toISOString()]
      );
      return result.lastInsertRowId;
    } catch (error) {
      logger.error("Erreur addProductWithImage", error);
      throw error;
    }
  });
