import { db, withDbTransaction, dbReady } from './database';
import { logger } from '../services/logger';

const generatePurchaseReference = async () => {
  try {
    const result = await db.getFirstAsync('SELECT COUNT(*) as cnt FROM purchases');
    const num = (result?.cnt || 0) + 1;
    return `ACH-${String(num).padStart(5, '0')}`;
  } catch {
    return `ACH-${Date.now()}`;
  }
};

export const savePurchaseLocally = (purchaseData, items) =>
  withDbTransaction(async () => {
    await db.execAsync('BEGIN');
    try {
      const reference = purchaseData.reference || (await generatePurchaseReference());
      const result = await db.runAsync(
        `INSERT INTO purchases (reference, supplier_name, total, status, date, notes, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        reference, purchaseData.supplier_name || 'Fournisseur inconnu',
        purchaseData.total || 0, purchaseData.status || 'pending',
        purchaseData.date || new Date().toISOString().split('T')[0],
        purchaseData.notes || null, 0, new Date().toISOString()
      );
      const purchaseId = result.lastInsertRowId;

      for (const item of items) {
        let resolvedProductId = item.product_id || null;

        if (purchaseData.status === 'received') {
          if (item.product_id) {
            await db.runAsync('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', item.quantity, item.product_id);
          } else if (item.barcode) {
            const byBarcode = await db.getFirstAsync('SELECT id FROM products WHERE barcode = ?', item.barcode);
            if (byBarcode) {
              resolvedProductId = byBarcode.id;
              await db.runAsync('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', item.quantity, byBarcode.id);
            } else {
              const ins = await db.runAsync(
                `INSERT INTO products (name, barcode, category, price, stock_quantity, min_stock, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                item.name, item.barcode, 'Import Achat', item.unit_price || 0, item.quantity, 0, new Date().toISOString()
              );
              resolvedProductId = ins.lastInsertRowId;
            }
          } else {
            const ins = await db.runAsync(
              `INSERT INTO products (name, barcode, category, price, stock_quantity, min_stock, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              item.name, null, 'Import Achat', item.unit_price || 0, item.quantity, 0, new Date().toISOString()
            );
            resolvedProductId = ins.lastInsertRowId;
          }
        }

        await db.runAsync(
          `INSERT INTO purchase_items (purchase_id, product_id, barcode, name, quantity, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          purchaseId, resolvedProductId, item.barcode || null, item.name, item.quantity, item.unit_price, item.total
        );
      }

      await db.execAsync('COMMIT');
      return purchaseId;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      logger.error('Erreur savePurchaseLocally', error);
      throw error;
    }
  });

export const getLocalPurchases = async () => {
  await dbReady;
  try {
    return await db.getAllAsync('SELECT * FROM purchases ORDER BY created_at DESC');
  } catch (error) {
    logger.error('Erreur getLocalPurchases', error);
    return [];
  }
};

export const getPurchaseItems = async (purchaseId) => {
  try {
    return await db.getAllAsync('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id', purchaseId);
  } catch (error) {
    logger.error('Erreur getPurchaseItems', error);
    return [];
  }
};

export const updatePurchaseStatus = (purchaseId, newStatus) =>
  withDbTransaction(async () => {
    try {
      const purchase = await db.getFirstAsync('SELECT status FROM purchases WHERE id = ?', purchaseId);
      await db.runAsync('UPDATE purchases SET status = ? WHERE id = ?', newStatus, purchaseId);

      if (newStatus === 'received' && purchase?.status !== 'received') {
        const items = await getPurchaseItems(purchaseId);
        for (const item of items) {
          if (item.product_id) {
            await db.runAsync('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', item.quantity, item.product_id);
          } else if (item.barcode) {
            const byBarcode = await db.getFirstAsync('SELECT id FROM products WHERE barcode = ?', item.barcode);
            if (byBarcode) {
              await db.runAsync('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', item.quantity, byBarcode.id);
              await db.runAsync('UPDATE purchase_items SET product_id = ? WHERE id = ?', byBarcode.id, item.id);
            } else {
              const ins = await db.runAsync(
                `INSERT INTO products (name, barcode, category, price, stock_quantity, min_stock, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                item.name, item.barcode, 'Import Achat', item.unit_price || 0, item.quantity, 0, new Date().toISOString()
              );
              await db.runAsync('UPDATE purchase_items SET product_id = ? WHERE id = ?', ins.lastInsertRowId, item.id);
            }
          } else {
            const ins = await db.runAsync(
              `INSERT INTO products (name, barcode, category, price, stock_quantity, min_stock, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              item.name, null, 'Import Achat', item.unit_price || 0, item.quantity, 0, new Date().toISOString()
            );
            await db.runAsync('UPDATE purchase_items SET product_id = ? WHERE id = ?', ins.lastInsertRowId, item.id);
          }
        }
      }
      return true;
    } catch (error) {
      logger.error('Erreur updatePurchaseStatus', error);
      return false;
    }
  });

export const deletePurchase = (purchaseId) =>
  withDbTransaction(async () => {
    try {
      await db.runAsync('DELETE FROM purchases WHERE id = ?', purchaseId);
      return true;
    } catch (error) {
      logger.error('Erreur deletePurchase', error);
      return false;
    }
  });
