import * as Network from 'expo-network';
import {
    getPendingSync,
    removeFromPendingSync,
    markSaleAsSynced,
    saveProductsLocally,
    saveClientsLocally,
    setLastSyncTime,
} from '../database/localStorage';
import { getProducts, getClients, createSale } from './api';

export const syncManager = {
    isSyncing: false,

    async sync() {
        if (this.isSyncing) {
            console.log('Sync déjà en cours');
            return;
        }

        // Vérifier connexion
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
            console.log('Pas de connexion internet');
            return;
        }

        this.isSyncing = true;
        console.log('🔄 Début synchronisation...');

        try {
            // 1. Télécharger les données du serveur
            await this.downloadData();

            // 2. Uploader les données locales
            await this.uploadData();

            await setLastSyncTime();
            console.log('✅ Synchronisation terminée');
        } catch (error) {
            console.error('❌ Erreur sync:', error);
        } finally {
            this.isSyncing = false;
        }
    },

    async downloadData() {
        try {
            console.log('📥 Téléchargement des données...');

            // Télécharger produits
            const products = await getProducts();
            if (products && products.length) {
                await saveProductsLocally(products);
                console.log(`  ✓ ${products.length} produits synchronisés`);
            }

            // Télécharger clients
            const clients = await getClients();
            if (clients && clients.length) {
                await saveClientsLocally(clients);
                console.log(`  ✓ ${clients.length} clients synchronisés`);
            }

        } catch (error) {
            console.error('Erreur download:', error);
            throw error;
        }
    },

    async uploadData() {
        try {
            const pendingItems = await getPendingSync();

            if (pendingItems.length === 0) {
                console.log('  ℹ️ Aucune donnée à uploader');
                return;
            }

            console.log(`📤 Upload de ${pendingItems.length} éléments...`);

            for (const item of pendingItems) {
                try {
                    if (item.type === 'sale') {
                        const data = JSON.parse(item.data);
                        const result = await createSale(data.sale, data.items);

                        if (result && result.id) {
                            await markSaleAsSynced(item.record_id, result.id);
                            await removeFromPendingSync(item.id);
                            console.log(`  ✓ Vente ${item.record_id} synchronisée (ID serveur: ${result.id})`);
                        }
                    }
                } catch (error) {
                    console.error(`  ✗ Erreur sync item ${item.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Erreur upload:', error);
            throw error;
        }
    }
};

// Synchronisation périodique
export const startPeriodicSync = () => {
    setInterval(() => {
        syncManager.sync();
    }, 5 * 60 * 1000); // Toutes les 5 minutes
};

// Synchronisation au démarrage
export const syncOnStartup = async () => {
    await syncManager.sync();
};