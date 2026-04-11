import AsyncStorage from '@react-native-async-storage/async-storage';

// Clés de stockage
const STORAGE_KEYS = {
    PRODUCTS: '@erp_products',
    SALES: '@erp_sales',
    CLIENTS: '@erp_clients',
    EMPLOYEES: '@erp_employees',
    DASHBOARD_STATS: '@erp_dashboard_stats',
    SALES_WEEK: '@erp_sales_week',
    LOW_STOCK: '@erp_low_stock',
    PENDING_ACTIONS: '@erp_pending_actions',
    LAST_SYNC: '@erp_last_sync',
};

// ========== PRODUITS ==========
export const saveProductsOffline = async (products) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde produits:', error);
        return false;
    }
};

export const getProductsOffline = async () => {
    try {
        const products = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
        return products ? JSON.parse(products) : [];
    } catch (error) {
        console.error('Erreur chargement produits:', error);
        return [];
    }
};

// ========== VENTES ==========
export const saveSalesOffline = async (sales) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde ventes:', error);
        return false;
    }
};

export const getSalesOffline = async () => {
    try {
        const sales = await AsyncStorage.getItem(STORAGE_KEYS.SALES);
        return sales ? JSON.parse(sales) : [];
    } catch (error) {
        console.error('Erreur chargement ventes:', error);
        return [];
    }
};

// ========== TABLEAU DE BORD ==========
export const saveDashboardStatsOffline = async (stats) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.DASHBOARD_STATS, JSON.stringify(stats));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde stats:', error);
        return false;
    }
};

export const getDashboardStatsOffline = async () => {
    try {
        const stats = await AsyncStorage.getItem(STORAGE_KEYS.DASHBOARD_STATS);
        return stats ? JSON.parse(stats) : null;
    } catch (error) {
        console.error('Erreur chargement stats:', error);
        return null;
    }
};

export const saveSalesWeekOffline = async (salesWeek) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.SALES_WEEK, JSON.stringify(salesWeek));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde sales week:', error);
        return false;
    }
};

export const getSalesWeekOffline = async () => {
    try {
        const salesWeek = await AsyncStorage.getItem(STORAGE_KEYS.SALES_WEEK);
        return salesWeek ? JSON.parse(salesWeek) : [];
    } catch (error) {
        console.error('Erreur chargement sales week:', error);
        return [];
    }
};

// ========== STOCK ==========
export const saveLowStockOffline = async (lowStock) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.LOW_STOCK, JSON.stringify(lowStock));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde low stock:', error);
        return false;
    }
};

export const getLowStockOffline = async () => {
    try {
        const lowStock = await AsyncStorage.getItem(STORAGE_KEYS.LOW_STOCK);
        return lowStock ? JSON.parse(lowStock) : [];
    } catch (error) {
        console.error('Erreur chargement low stock:', error);
        return [];
    }
};

// ========== EMPLOYÉS ==========
export const saveEmployeesOffline = async (employees) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde employés:', error);
        return false;
    }
};

export const getEmployeesOffline = async () => {
    try {
        const employees = await AsyncStorage.getItem(STORAGE_KEYS.EMPLOYEES);
        return employees ? JSON.parse(employees) : [];
    } catch (error) {
        console.error('Erreur chargement employés:', error);
        return [];
    }
};

// ========== CLIENTS ==========
export const saveClientsOffline = async (clients) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde clients:', error);
        return false;
    }
};

export const getClientsOffline = async () => {
    try {
        const clients = await AsyncStorage.getItem(STORAGE_KEYS.CLIENTS);
        return clients ? JSON.parse(clients) : [];
    } catch (error) {
        console.error('Erreur chargement clients:', error);
        return [];
    }
};

// ========== ACTIONS EN ATTENTE ==========
export const addPendingAction = async (action) => {
    try {
        const pending = await getPendingActions();
        pending.push({
            id: Date.now(),
            ...action,
            created_at: new Date().toISOString(),
        });
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(pending));
    } catch (error) {
        console.error('Erreur ajout action:', error);
    }
};

export const getPendingActions = async () => {
    try {
        const pending = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_ACTIONS);
        return pending ? JSON.parse(pending) : [];
    } catch (error) {
        console.error('Erreur chargement actions:', error);
        return [];
    }
};

export const removePendingAction = async (actionId) => {
    try {
        const pending = await getPendingActions();
        const filtered = pending.filter(a => a.id !== actionId);
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_ACTIONS, JSON.stringify(filtered));
    } catch (error) {
        console.error('Erreur suppression action:', error);
    }
};

// ========== SYNC ==========
export const setLastSyncTime = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
};

export const getLastSyncTime = async () => {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
};

// ========== NETTOYAGE ==========
export const clearAllOfflineData = async () => {
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
};