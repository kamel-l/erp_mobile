import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Alert, ActivityIndicator,
} from 'react-native';
import { COLORS, formatDA } from '../services/theme';
import { Card, RowBetween } from '../components/UIComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    PRODUCTS: '@erp_products',
};

// Stock par défaut - sera créé automatiquement
const DEFAULT_STOCK = [
    { id: 1, name: 'Ordinateur HP ProBook', barcode: 'HP001', category: 'Informatique', price: 75000, stock_quantity: 2, min_stock: 2, description: 'Ordinateur portable 16Go RAM', created_at: new Date().toISOString() },
    { id: 2, name: 'Souris Logitech MX', barcode: 'LOG001', category: 'Accessoires', price: 1500, stock_quantity: 8, min_stock: 10, description: 'Souris sans fil', created_at: new Date().toISOString() },
    { id: 3, name: 'Écran Samsung 24"', barcode: 'SAM001', category: 'Informatique', price: 25000, stock_quantity: 3, min_stock: 3, description: 'Écran LED Full HD', created_at: new Date().toISOString() },
    { id: 4, name: 'Clavier HP Slim', barcode: 'HP002', category: 'Accessoires', price: 2500, stock_quantity: 35, min_stock: 10, description: 'Clavier compact USB', created_at: new Date().toISOString() },
    { id: 5, name: 'Bureau Professionnel', barcode: 'BUR001', category: 'Mobilier', price: 35000, stock_quantity: 12, min_stock: 2, description: 'Bureau 140x70cm', created_at: new Date().toISOString() },
    { id: 6, name: 'Chaise Ergonomique', barcode: 'CHA001', category: 'Mobilier', price: 15000, stock_quantity: 8, min_stock: 5, description: 'Chaise de bureau réglable', created_at: new Date().toISOString() },
    { id: 7, name: 'Imprimante Canon', barcode: 'CAN001', category: 'Informatique', price: 18000, stock_quantity: 5, min_stock: 2, description: 'Imprimante laser multifonction', created_at: new Date().toISOString() },
    { id: 8, name: 'Tablette Graphique', barcode: 'TAB001', category: 'Accessoires', price: 12000, stock_quantity: 15, min_stock: 5, description: 'Pour dessin numérique', created_at: new Date().toISOString() },
    { id: 9, name: 'Disque SSD 1To', barcode: 'SSD001', category: 'Informatique', price: 8500, stock_quantity: 20, min_stock: 10, description: 'Stockage rapide', created_at: new Date().toISOString() },
    { id: 10, name: 'Câble HDMI 2m', barcode: 'HDM001', category: 'Accessoires', price: 500, stock_quantity: 50, min_stock: 20, description: 'Câble haute qualité', created_at: new Date().toISOString() },
];

export default function StockImportScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [hasStock, setHasStock] = useState(false);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        initializeStock();
    }, []);

    const initializeStock = async () => {
        try {
            setLoading(true);

            // Vérifier si le stock existe déjà
            const existingStock = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);

            if (!existingStock) {
                // Créer le stock par défaut
                await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_STOCK));
                setProducts(DEFAULT_STOCK);
                setHasStock(true);
                console.log('Stock par défaut créé avec succès');
            } else {
                const parsedStock = JSON.parse(existingStock);
                setProducts(parsedStock);
                setHasStock(parsedStock.length > 0);
                console.log(`${parsedStock.length} produits chargés`);
            }
        } catch (error) {
            console.error('Erreur initialisation:', error);
            Alert.alert('Erreur', `Impossible d'initialiser le stock: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const resetToDefaultStock = async () => {
        Alert.alert(
            'Réinitialiser le stock',
            '⚠️ Cette action remplacera tout votre stock par les produits par défaut. Continuer ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Réinitialiser',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_STOCK));
                            setProducts(DEFAULT_STOCK);
                            setHasStock(true);
                            Alert.alert('Succès', `${DEFAULT_STOCK.length} produits par défaut chargés`);
                        } catch (error) {
                            Alert.alert('Erreur', error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const clearStock = async () => {
        Alert.alert(
            'Vider le stock',
            '⚠️ Cette action supprimera TOUS les produits. Continuer ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Vider',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await AsyncStorage.removeItem(STORAGE_KEYS.PRODUCTS);
                            setProducts([]);
                            setHasStock(false);
                            Alert.alert('Succès', 'Stock vidé avec succès');
                        } catch (error) {
                            Alert.alert('Erreur', error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const goToApp = () => {
        if (hasStock && products.length > 0) {
            navigation.replace('Main');
        } else {
            Alert.alert('Stock vide', 'Veuillez d\'abord initialiser le stock');
        }
    };

    const totalValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);
    const lowStockCount = products.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)).length;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Chargement du stock...</Text>
            </View>
        );
    }

    // Ajoutez cette fonction dans StockImportScreen
    const importFromTextFile = async () => {
        Alert.prompt(
            'Coller le CSV',
            'Collez votre contenu CSV ici (format: name,price,stock_quantity,min_stock,category,barcode)',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Importer',
                    onPress: async (csvText) => {
                        if (!csvText) return;
                        setLoading(true);
                        try {
                            // Parser le CSV
                            const lines = csvText.split('\n').filter(l => l.trim());
                            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                            const productsList = [];

                            for (let i = 1; i < lines.length; i++) {
                                const values = lines[i].split(',');
                                const product = {};
                                headers.forEach((h, idx) => {
                                    let val = values[idx]?.trim() || '';
                                    if (h === 'price') product[h] = parseFloat(val) || 0;
                                    else if (h === 'stock_quantity') product[h] = parseInt(val) || 0;
                                    else if (h === 'min_stock') product[h] = parseInt(val) || 0;
                                    else product[h] = val;
                                });
                                if (product.name && product.price) {
                                    product.id = Date.now() + i;
                                    productsList.push(product);
                                }
                            }

                            if (productsList.length > 0) {
                                await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(productsList));
                                setProducts(productsList);
                                setHasStock(true);
                                Alert.alert('Succès', `${productsList.length} produits importés`);
                            } else {
                                Alert.alert('Erreur', 'Aucun produit valide');
                            }
                        } catch (error) {
                            Alert.alert('Erreur', error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ],
            'plain-text'
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>ERP</Text>
                </View>
                <Text style={styles.appName}>DAR ELSSALEM</Text>
                <Text style={styles.appSubtitle}>Gestion de Stock</Text>
            </View>

            <Card style={styles.statsCard}>
                <Text style={styles.statsTitle}>📊 État du stock</Text>
                <RowBetween style={styles.statRow}>
                    <Text style={styles.statLabel}>Produits en stock</Text>
                    <Text style={[styles.statValue, { color: COLORS.primary }]}>{products.length}</Text>
                </RowBetween>
                <RowBetween style={styles.statRow}>
                    <Text style={styles.statLabel}>Valeur totale</Text>
                    <Text style={[styles.statValue, { color: COLORS.success }]}>{formatDA(totalValue)}</Text>
                </RowBetween>
                <RowBetween style={styles.statRow}>
                    <Text style={styles.statLabel}>Stock critique</Text>
                    <Text style={[styles.statValue, { color: COLORS.danger }]}>{lowStockCount}</Text>
                </RowBetween>
            </Card>

            {!hasStock ? (
                <TouchableOpacity style={styles.initBtn} onPress={initializeStock}>
                    <Text style={styles.initIcon}>🚀</Text>
                    <Text style={styles.initTitle}>Initialiser le stock</Text>
                    <Text style={styles.initSubtitle}>Créer un stock par défaut</Text>
                </TouchableOpacity>
            ) : (
                <>
                    <TouchableOpacity style={styles.goToAppBtn} onPress={goToApp}>
                        <Text style={styles.goToAppText}>Accéder à l'application →</Text>
                    </TouchableOpacity>

                    <Text style={styles.sectionTitle}>Gestion du stock</Text>

                    <TouchableOpacity style={styles.resetBtn} onPress={resetToDefaultStock}>
                        <Text style={styles.btnIcon}>🔄</Text>
                        <Text style={styles.btnTitle}>Réinitialiser le stock</Text>
                        <Text style={styles.btnSubtitle}>Restaurer les produits par défaut</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.clearBtn} onPress={clearStock}>
                        <Text style={styles.btnIcon}>🗑️</Text>
                        <Text style={[styles.btnTitle, { color: COLORS.danger }]}>Vider le stock</Text>
                        <Text style={styles.btnSubtitle}>Supprimer tous les produits</Text>
                    </TouchableOpacity>
                </>
            )}

            <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>📦 Aperçu des produits</Text>
                {products.slice(0, 5).map((product, index) => (
                    <View key={product.id} style={styles.previewItem}>
                        <Text style={styles.previewName}>{product.name}</Text>
                        <Text style={styles.previewPrice}>{formatDA(product.price)}</Text>
                    </View>
                ))}
                {products.length > 5 && (
                    <Text style={styles.previewMore}>... et {products.length - 5} autres produits</Text>
                )}
                {products.length === 0 && (
                    <Text style={styles.previewEmpty}>Aucun produit en stock</Text>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    content: { padding: 20, paddingBottom: 40 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.primary,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 20,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    logoText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
    },
    appName: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: 1,
    },
    appSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    statsCard: {
        marginBottom: 20,
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    statRow: {
        marginBottom: 10,
    },
    statLabel: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
        marginTop: 20,
    },
    initBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
    },
    initIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    initTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    initSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
    },
    goToAppBtn: {
        backgroundColor: COLORS.success,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    goToAppText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    resetBtn: {
        backgroundColor: '#FF9800',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    clearBtn: {
        backgroundColor: '#FFEBEE',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    btnIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    btnTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    btnSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
    },
    previewCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        borderWidth: 0.5,
        borderColor: '#E0E0E0',
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    previewItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F0F0F0',
    },
    previewName: {
        fontSize: 13,
        color: COLORS.text,
        flex: 1,
    },
    previewPrice: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.primary,
    },
    previewMore: {
        textAlign: 'center',
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 8,
    },
    previewEmpty: {
        textAlign: 'center',
        fontSize: 13,
        color: COLORS.textSecondary,
        paddingVertical: 20,
    },
});