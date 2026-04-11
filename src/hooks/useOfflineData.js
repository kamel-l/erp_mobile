import { useEffect, useState, useCallback } from 'react';
import * as Network from 'expo-network';
import {
    getLocalProducts,
    getLocalSales,
    getLocalClients,
    saveProductsLocally,
    saveClientsLocally,
} from '../database/localStorage';
import { syncManager } from '../services/syncService';
import { getProducts, getClients } from '../services/api';

export const useOfflineData = () => {
    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const checkConnectivity = useCallback(async () => {
        const networkState = await Network.getNetworkStateAsync();
        const online = networkState.isConnected && networkState.isInternetReachable;
        setIsOnline(online);
        return online;
    }, []);

    const loadLocalData = useCallback(async () => {
        try {
            const [localProducts, localSales, localClients] = await Promise.all([
                getLocalProducts(),
                getLocalSales(),
                getLocalClients(),
            ]);

            setProducts(localProducts);
            setSales(localSales);
            setClients(localClients);
        } catch (error) {
            console.error('Erreur chargement données locales:', error);
        }
    }, []);

    const syncData = useCallback(async () => {
        if (syncing) return;

        setSyncing(true);
        try {
            await syncManager.sync();
            await loadLocalData(); // Recharger après sync
        } catch (error) {
            console.error('Erreur sync:', error);
        } finally {
            setSyncing(false);
        }
    }, [syncing, loadLocalData]);

    const refresh = useCallback(async () => {
        setLoading(true);
        await loadLocalData();

        const online = await checkConnectivity();
        if (online) {
            await syncData();
        }

        setLoading(false);
    }, [loadLocalData, checkConnectivity, syncData]);

    useEffect(() => {
        const init = async () => {
            await loadLocalData();

            // Vérifier connexion et synchroniser
            const online = await checkConnectivity();
            if (online) {
                await syncData();
            }

            setLoading(false);
        };

        init();

        // Vérifier connexion périodiquement
        const interval = setInterval(async () => {
            const wasOnline = isOnline;
            const nowOnline = await checkConnectivity();

            // Si on revient en ligne, synchroniser
            if (!wasOnline && nowOnline) {
                await syncData();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    return {
        products,
        sales,
        clients,
        loading,
        isOnline,
        syncing,
        refresh,
        syncData,
    };
};