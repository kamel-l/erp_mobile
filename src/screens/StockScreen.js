// src/screens/StockScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import Papa from 'papaparse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, SectionTitle, Divider,
  ProgressBar, SearchBar,
} from '../components/UIComponents';

const STORAGE_KEYS = {
  PRODUCTS: '@erp_products',
};

const DEFAULT_STOCK = [
  { id: 1, name: 'Ordinateur HP ProBook', barcode: 'HP001', category: 'Informatique', price: 75000, stock_quantity: 2, min_stock: 2 },
  { id: 2, name: 'Souris Logitech MX', barcode: 'LOG001', category: 'Accessoires', price: 1500, stock_quantity: 8, min_stock: 10 },
  { id: 3, name: 'Écran Samsung 24"', barcode: 'SAM001', category: 'Informatique', price: 25000, stock_quantity: 3, min_stock: 3 },
  { id: 4, name: 'Clavier HP Slim', barcode: 'HP002', category: 'Accessoires', price: 2500, stock_quantity: 35, min_stock: 10 },
  { id: 5, name: 'Bureau Professionnel', barcode: 'BUR001', category: 'Mobilier', price: 35000, stock_quantity: 12, min_stock: 2 },
  { id: 6, name: 'Chaise Ergonomique', barcode: 'CHA001', category: 'Mobilier', price: 15000, stock_quantity: 8, min_stock: 5 },
  { id: 7, name: 'Imprimante Canon', barcode: 'CAN001', category: 'Informatique', price: 18000, stock_quantity: 5, min_stock: 2 },
];

export default function StockScreen() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  // Charger les produits depuis AsyncStorage (SANS création automatique)
  const loadProducts = useCallback(async () => {
    try {
      const productsJSON = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (productsJSON) {
        setProducts(JSON.parse(productsJSON));
      } else {
        setProducts([]); // stock vide
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recharger à chaque fois que l'écran devient actif (après vidage depuis un autre écran)
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  // Initialiser le stock par défaut (manuellement)
  const initializeDefaultStock = async () => {
    Alert.alert(
      'Initialiser le stock',
      'Cela va remplacer le stock actuel par les produits par défaut. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Initialiser',
          onPress: async () => {
            setLoading(true);
            try {
              await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_STOCK));
              setProducts(DEFAULT_STOCK);
              Alert.alert('Succès', `Stock initialisé avec ${DEFAULT_STOCK.length} produits`);
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

  const getStockStatus = (current, min) => {
    if (current === 0) return 'critical';
    if (current <= min) return 'low';
    return 'ok';
  };

  const saveProducts = async (newProducts) => {
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(newProducts));
    setProducts(newProducts);
  };

  const mergeProducts = (existing, newItems) => {
    const existingMap = new Map();
    existing.forEach(p => existingMap.set(p.barcode || p.name, p));
    for (const item of newItems) {
      const key = item.barcode || item.name;
      if (!existingMap.has(key)) {
        existingMap.set(key, { ...item, id: Date.now() + Math.random() });
      }
    }
    return Array.from(existingMap.values());
  };

  // Import depuis fichier CSV
  const importFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });
      if (result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setImporting(true);
        const csvString = await FileSystem.readAsStringAsync(uri);
        const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
        const newProducts = parsed.data.map((row, idx) => ({
          id: Date.now() + idx,
          name: row.name || row.Name || row.nom || '',
          barcode: row.barcode || row.code || row.Barcode || '',
          category: row.category || row.Category || row.catégorie || '',
          price: parseFloat(row.price || row.Price || row.prix || 0),
          stock_quantity: parseInt(row.stock_quantity || row.quantity || row.qty || 0, 10),
          min_stock: parseInt(row.min_stock || row.minStock || row.minimum || 0, 10),
        })).filter(p => p.name && !isNaN(p.price));
        
        if (newProducts.length === 0) {
          Alert.alert('Erreur', 'Aucun produit valide trouvé dans le CSV');
          return;
        }
        const updatedProducts = mergeProducts(products, newProducts);
        await saveProducts(updatedProducts);
        Alert.alert('Succès', `${newProducts.length} produits importés depuis le fichier`);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de lire le fichier CSV');
    } finally {
      setImporting(false);
    }
  };

  // Import depuis presse-papiers
  const importFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || !text.includes(',')) {
        Alert.alert('Erreur', 'Le presse-papiers ne contient pas de données CSV valides');
        return;
      }
      setCsvText(text);
      setModalVisible(true);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'accéder au presse-papiers');
    }
  };

  const processCsvText = () => {
    if (!csvText.trim()) return;
    setImporting(true);
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const newProducts = parsed.data.map((row, idx) => ({
      id: Date.now() + idx,
      name: row.name || row.Name || row.nom || '',
      barcode: row.barcode || row.code || row.Barcode || '',
      category: row.category || row.Category || row.catégorie || '',
      price: parseFloat(row.price || row.Price || row.prix || 0),
      stock_quantity: parseInt(row.stock_quantity || row.quantity || row.qty || 0, 10),
      min_stock: parseInt(row.min_stock || row.minStock || row.minimum || 0, 10),
    })).filter(p => p.name && !isNaN(p.price));
    
    if (newProducts.length === 0) {
      Alert.alert('Erreur', 'Aucun produit valide trouvé dans le texte');
      setModalVisible(false);
      setImporting(false);
      return;
    }
    const updatedProducts = mergeProducts(products, newProducts);
    saveProducts(updatedProducts).then(() => {
      Alert.alert('Succès', `${newProducts.length} produits importés depuis le presse-papiers`);
      setModalVisible(false);
      setCsvText('');
    }).catch(() => {
      Alert.alert('Erreur', 'Échec de l\'enregistrement');
    }).finally(() => setImporting(false));
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  ).filter(p => tab !== 'low' || p.stock_quantity <= p.min_stock);

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
      >
        {/* KPIs */}
        <View style={styles.kpiRow}>
          <KpiCard value={totalProducts} label="Total produits" color={COLORS.primary} style={{ marginRight: 6 }} />
          <KpiCard value={lowStockCount} label="Stock critique" color={COLORS.danger} style={{ marginLeft: 6 }} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard value={formatDA(totalValue)} label="Valeur stock" color={COLORS.success} style={{ marginRight: 6 }} />
        </View>

        {/* Bouton d'initialisation si stock vide */}
        {totalProducts === 0 && (
          <TouchableOpacity style={styles.initButton} onPress={initializeDefaultStock}>
            <Text style={styles.initButtonText}>📦 Initialiser le stock par défaut</Text>
          </TouchableOpacity>
        )}

        {/* Barre de recherche + boutons import */}
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher un produit..." />
          </View>
          <TouchableOpacity style={styles.importButton} onPress={importFromFile} disabled={importing}>
            <Text style={styles.importButtonText}>📁 Fichier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importButton} onPress={importFromClipboard} disabled={importing}>
            <Text style={styles.importButtonText}>📋 Presse-papiers</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'all' && styles.tabActive]} onPress={() => setTab('all')}>
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'low' && styles.tabActive]} onPress={() => setTab('low')}>
            <Text style={[styles.tabText, tab === 'low' && styles.tabTextActive]}>Stock faible</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des produits */}
        <SectionTitle>{tab === 'low' ? 'Produits en stock faible' : 'Inventaire complet'}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {filtered.map((p, i) => {
            const status = getStockStatus(p.stock_quantity, p.min_stock);
            const dotColor = status === 'critical' ? COLORS.danger : status === 'low' ? COLORS.warning : COLORS.success;
            return (
              <View key={p.id}>
                <View style={styles.stockRow}>
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
          {filtered.length === 0 && <Text style={styles.emptyText}>Aucun produit trouvé</Text>}
        </Card>
      </ScrollView>

      {/* Modal pour coller du CSV */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Coller le texte CSV</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={8}
              placeholder="Collez ici les données CSV (avec en-têtes: name, price, stock_quantity, min_stock, category, barcode...)"
              value={csvText}
              onChangeText={setCsvText}
              editable={!importing}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)} disabled={importing}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={processCsvText} disabled={importing}>
                <Text style={styles.modalConfirmText}>Importer</Text>
              </TouchableOpacity>
            </View>
            {importing && <ActivityIndicator style={{ marginTop: 12 }} color={COLORS.primary} />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 20, fontSize: 16, fontWeight: '500', color: COLORS.primary },
  kpiRow: { flexDirection: 'row', marginBottom: 12, gap: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  importButton: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, justifyContent: 'center' },
  importButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  initButton: { backgroundColor: COLORS.warning, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12 },
  initButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%', maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: COLORS.primary },
  textArea: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, textAlignVertical: 'top', fontSize: 12, fontFamily: 'monospace', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#eee' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '500' },
  modalConfirm: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: COLORS.primary },
  modalConfirmText: { color: '#fff', fontWeight: '500' },
});