import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, // ← Ajouter ActivityIndicator
} from 'react-native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, SectionTitle, Divider,
  AlertDot, RowBetween, ProgressBar, SearchBar, Avatar,
} from '../components/UIComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  PRODUCTS: '@erp_products',
};

export default function StockScreen() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger les produits depuis AsyncStorage
  const loadProducts = useCallback(async () => {
    try {
      const productsJSON = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (productsJSON) {
        const parsedProducts = JSON.parse(productsJSON);
        setProducts(parsedProducts);
        console.log(`${parsedProducts.length} produits chargés`);
      } else {
        // Stock par défaut si vide
        const defaultStock = [
          { id: 1, name: 'Ordinateur HP ProBook', barcode: 'HP001', category: 'Informatique', price: 75000, stock_quantity: 2, min_stock: 2 },
          { id: 2, name: 'Souris Logitech MX', barcode: 'LOG001', category: 'Accessoires', price: 1500, stock_quantity: 8, min_stock: 10 },
          { id: 3, name: 'Écran Samsung 24"', barcode: 'SAM001', category: 'Informatique', price: 25000, stock_quantity: 3, min_stock: 3 },
          { id: 4, name: 'Clavier HP Slim', barcode: 'HP002', category: 'Accessoires', price: 2500, stock_quantity: 35, min_stock: 10 },
          { id: 5, name: 'Bureau Professionnel', barcode: 'BUR001', category: 'Mobilier', price: 35000, stock_quantity: 12, min_stock: 2 },
          { id: 6, name: 'Chaise Ergonomique', barcode: 'CHA001', category: 'Mobilier', price: 15000, stock_quantity: 8, min_stock: 5 },
          { id: 7, name: 'Imprimante Canon', barcode: 'CAN001', category: 'Informatique', price: 18000, stock_quantity: 5, min_stock: 2 },
        ];
        setProducts(defaultStock);
        await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(defaultStock));
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const getStockStatus = (current, min) => {
    if (current === 0) return 'critical';
    if (current <= min) return 'low';
    return 'ok';
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  ).filter(p => {
    if (tab === 'low') return p.stock_quantity <= p.min_stock;
    return true;
  });

  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock).length;
  const totalValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPIs */}
        <View style={styles.kpiRow}>
          <KpiCard value={totalProducts} label="Total produits" color={COLORS.primary} style={{ marginRight: 6 }} />
          <KpiCard value={lowStockCount} label="Stock critique" color={COLORS.danger} style={{ marginLeft: 6 }} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard value={formatDA(totalValue)} label="Valeur stock" color={COLORS.success} style={{ marginRight: 6 }} />
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher un produit..." />
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {[{ key: 'all', label: 'Tous' }, { key: 'low', label: 'Stock faible' }].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Products List */}
        <SectionTitle>{tab === 'low' ? 'Produits en stock faible' : 'Inventaire complet'}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {filtered.map((p, i) => {
            const status = getStockStatus(p.stock_quantity, p.min_stock);
            const dotColor = status === 'critical' ? COLORS.danger : status === 'low' ? COLORS.warning : COLORS.success;
            return (
              <View key={p.id}>
                <View style={styles.stockRow}>
                  <AlertDot color={dotColor} />
                  <View style={styles.stockInfo}>
                    <Text style={styles.stockName}>{p.name}</Text>
                    <Text style={styles.stockDetail}>
                      {p.category || 'Non catégorisé'} • Prix: {formatDA(p.price)}
                      {p.barcode ? ` • Code: ${p.barcode}` : ''}
                    </Text>
                    <ProgressBar
                      value={p.stock_quantity}
                      max={Math.max(p.min_stock * 3, p.stock_quantity)}
                      color={dotColor}
                      height={4}
                    />
                  </View>
                  <View style={styles.stockQty}>
                    <Text style={[styles.qtyNum, { color: dotColor }]}>{p.stock_quantity}</Text>
                    <Text style={styles.qtyLabel}>/ min {p.min_stock}</Text>
                    <Badge status={status} style={{ marginTop: 4 }} />
                  </View>
                </View>
                {i < filtered.length - 1 && <Divider />}
              </View>
            );
          })}
          {filtered.length === 0 && (
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 20, fontSize: 16, fontWeight: '500', color: COLORS.primary },
  kpiRow: { flexDirection: 'row', marginBottom: 12, gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E0E0E0' },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  stockInfo: { flex: 1 },
  stockName: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  stockDetail: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  stockQty: { alignItems: 'flex-end', minWidth: 64 },
  qtyNum: { fontSize: 18, fontWeight: '500' },
  qtyLabel: { fontSize: 10, color: COLORS.textSecondary },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, padding: 20, fontSize: 14 },
});