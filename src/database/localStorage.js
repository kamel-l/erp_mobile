import AsyncStorage from '@react-native-async-storage/async-storage';

// Clés de stockage
const STORAGE_KEYS = {
    PRODUCTS: '@erp_products',
    SALES: '@erp_sales',
    SALE_ITEMS: '@erp_sale_items',
    CLIENTS: '@erp_clients',
    EMPLOYEES: '@erp_employees',
    PENDING_SYNC: '@erp_pending_sync',
    LAST_SYNC: '@erp_last_sync',
    USER: '@erp_user',
    TOKEN: '@erp_token',
};

// ========== PRODUITS ==========
export const saveProductsLocally = async (products) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde produits:', error);
        return false;
    }
};

export const getLocalProducts = async () => {
    try {
        const products = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
        return products ? JSON.parse(products) : [];
    } catch (error) {
        console.error('Erreur chargement produits:', error);
        return [];
    }
};

export const getProductByBarcode = async (barcode) => {
    const products = await getLocalProducts();
    return products.find(p => p.barcode === barcode);
};

export const updateProductStock = async (productId, newStock) => {
    const products = await getLocalProducts();
    const updatedProducts = products.map(p =>
        p.id === productId ? { ...p, stock_quantity: newStock } : p
    );
    await saveProductsLocally(updatedProducts);
};

// ========== VENTES ==========
export const saveSaleLocally = async (sale, items) => {
    try {
        // Sauvegarder la vente
        const sales = await getLocalSales();
        const newSale = {
            id: Date.now(),
            ...sale,
            synced: false,
            created_at: new Date().toISOString(),
        };
        sales.push(newSale);
        await AsyncStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));

        // Sauvegarder les items
        const saleItems = await getLocalSaleItems();
        const newItems = items.map(item => ({
            id: Date.now() + Math.random(),
            sale_id: newSale.id,
            ...item,
            synced: false,
        }));
        saleItems.push(...newItems);
        await AsyncStorage.setItem(STORAGE_KEYS.SALE_ITEMS, JSON.stringify(saleItems));

        // Ajouter à la file d'attente de synchronisation
        await addToPendingSync('sale', newSale.id, { sale, items });

        // Mettre à jour les stocks locaux
        for (const item of items) {
            const product = await getProductByBarcode(item.barcode);
            if (product) {
                await updateProductStock(product.id, product.stock_quantity - item.quantity);
            }
        }

        return newSale.id;
    } catch (error) {
        console.error('Erreur sauvegarde vente:', error);
        return null;
    }
};

export const getLocalSales = async () => {
    try {
        const sales = await AsyncStorage.getItem(STORAGE_KEYS.SALES);
        return sales ? JSON.parse(sales) : [];
    } catch (error) {
        return [];
    }
};

export const getLocalSaleItems = async () => {
    try {
        const items = await AsyncStorage.getItem(STORAGE_KEYS.SALE_ITEMS);
        return items ? JSON.parse(items) : [];
    } catch (error) {
        return [];
    }
};

export const getSaleWithItems = async (saleId) => {
    const sales = await getLocalSales();
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return null;

    const items = await getLocalSaleItems();
    sale.items = items.filter(i => i.sale_id === saleId);
    return sale;
};

// ========== CLIENTS ==========
export const saveClientsLocally = async (clients) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde clients:', error);
        return false;
    }
};

export const getLocalClients = async () => {
    try {
        const clients = await AsyncStorage.getItem(STORAGE_KEYS.CLIENTS);
        return clients ? JSON.parse(clients) : [];
    } catch (error) {
        return [];
    }
};

// ========== SYNC ==========
export const addToPendingSync = async (type, recordId, data) => {
    try {
        const pending = await getPendingSync();
        pending.push({
            id: Date.now(),
            type, // 'sale', 'product', 'client'
            record_id: recordId,
            data: JSON.stringify(data),
            created_at: new Date().toISOString(),
        });
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
    } catch (error) {
        console.error('Erreur ajout file sync:', error);
    }
};

export const getPendingSync = async () => {
    try {
        const pending = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
        return pending ? JSON.parse(pending) : [];
    } catch (error) {
        return [];
    }
};

export const removeFromPendingSync = async (syncId) => {
    try {
        const pending = await getPendingSync();
        const filtered = pending.filter(item => item.id !== syncId);
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(filtered));
    } catch (error) {
        console.error('Erreur suppression sync:', error);
    }
};

export const markSaleAsSynced = async (saleId, serverId) => {
    try {
        const sales = await getLocalSales();
        const updatedSales = sales.map(sale =>
            sale.id === saleId ? { ...sale, synced: true, server_id: serverId } : sale
        );
        await AsyncStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(updatedSales));

        const items = await getLocalSaleItems();
        const updatedItems = items.map(item =>
            item.sale_id === saleId ? { ...item, synced: true } : item
        );
        await AsyncStorage.setItem(STORAGE_KEYS.SALE_ITEMS, JSON.stringify(updatedItems));
    } catch (error) {
        console.error('Erreur mark synced:', error);
    }
};

export const setLastSyncTime = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
};

export const getLastSyncTime = async () => {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
};

// ========== AUTH ==========
export const saveUser = async (user, token) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } catch (error) {
        console.error('Erreur sauvegarde user:', error);
    }
};

export const getUser = async () => {
    try {
        const user = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        return { user: user ? JSON.parse(user) : null, token };
    } catch (error) {
        return { user: null, token: null };
    }
};

export const clearUser = async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN]);
};

// ========== NETTOYAGE ==========
export const clearAllData = async () => {
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
};