// src/screens/StockScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, Badge, SectionTitle, Divider,
  ProgressBar, SearchBar,
} from '../components/UIComponents';
import { getLocalProducts, saveProductsLocally, getProductByBarcode } from '../database/database';

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
  const [newProduct, setNewProduct] = useState({
    name: '',
    barcode: '',
    category: '',
    price: '',
    stock_quantity: '',
    min_stock: '',
  });
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const loadProducts = useCallback(async () => {
    try {
      const prods = await getLocalProducts();
      setProducts(prods || []);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
              await saveProductsLocally(DEFAULT_STOCK);
              await loadProducts();
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

  const addProduct = async () => {
    if (!newProduct.name.trim()) {
      Alert.alert('Erreur', 'Le nom du produit est obligatoire');
      return;
    }
    const price = parseFloat(newProduct.price);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Erreur', 'Le prix doit être un nombre positif');
      return;
    }
    const stockQty = parseInt(newProduct.stock_quantity) || 0;
    const minStock = parseInt(newProduct.min_stock) || 0;

    // Vérifier si le code-barres existe déjà
    if (newProduct.barcode.trim()) {
      const existing = await getProductByBarcode(newProduct.barcode.trim());
      if (existing) {
        Alert.alert('Erreur', 'Un produit avec ce code-barres existe déjà');
        return;
      }
    }

    const product = {
      id: Date.now() + Math.random(),
      name: newProduct.name.trim(),
      barcode: newProduct.barcode.trim() || '',
      category: newProduct.category.trim() || 'Non catégorisé',
      price: price,
      stock_quantity: stockQty,
      min_stock: minStock,
    };

    const updatedProducts = [...products, product];
    try {
      await saveProductsLocally(updatedProducts);
      await loadProducts();
      setModalVisible(false);
      setNewProduct({ name: '', barcode: '', category: '', price: '', stock_quantity: '', min_stock: '' });
      Alert.alert('Succès', 'Produit ajouté avec succès');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    setScannerVisible(false);
    setNewProduct(prev => ({ ...prev, barcode: data }));
    Alert.alert('Code-barres scanné', data);
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission refusée', 'Vous devez autoriser l\'accès à la caméra pour scanner');
        return;
      }
    }
    setScannerVisible(true);
  };

  const importFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });
      if (result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
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
        const updatedProducts = [...products, ...newProducts];
        await saveProductsLocally(updatedProducts);
        await loadProducts();
        Alert.alert('Succès', `${newProducts.length} produits importés depuis le fichier`);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de lire le fichier CSV');
    }
  };

  const filtered = products.filter(p => {
    const searchLower = search.toLowerCase();
    if (searchLower === '') return true;
    // Première lettre du nom
    const nameFirst = p.name.charAt(0).toLowerCase();
    if (nameFirst === searchLower) return true;
    // Première lettre du code-barres
    const barcodeFirst = p.barcode ? p.barcode.charAt(0).toLowerCase() : '';
    if (barcodeFirst === searchLower) return true;
    // Pour conserver la recherche par code-barres complet (scanner)
    if (p.barcode && p.barcode.toLowerCase().includes(searchLower)) return true;
    return false;
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
      >
        <View style={styles.kpiRow}>
          <KpiCard value={totalProducts} label="Total produits" color={COLORS.primary} style={{ marginRight: 6 }} />
          <KpiCard value={lowStockCount} label="Stock critique" color={COLORS.danger} style={{ marginLeft: 6 }} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard value={formatDA(totalValue)} label="Valeur stock" color={COLORS.success} style={{ marginRight: 6 }} />
        </View>

        {totalProducts === 0 && (
          <TouchableOpacity style={styles.initButton} onPress={initializeDefaultStock}>
            <Text style={styles.initButtonText}>📦 Initialiser le stock par défaut</Text>
          </TouchableOpacity>
        )}

        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher un produit..." />
          </View>
          <TouchableOpacity style={styles.importButton} onPress={importFromFile}>
            <Text style={styles.importButtonText}>📁 Fichier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.importButtonText}>➕ Ajouter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'all' && styles.tabActive]} onPress={() => setTab('all')}>
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'low' && styles.tabActive]} onPress={() => setTab('low')}>
            <Text style={[styles.tabText, tab === 'low' && styles.tabTextActive]}>Stock faible</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle>{tab === 'low' ? 'Produits en stock faible' : 'Inventaire complet'}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {filtered.map((p, i) => {
            const status = getStockStatus(p.stock_quantity, p.min_stock);
            const dotColor = status === 'critical' ? COLORS.danger : status === 'low' ? COLORS.warning : COLORS.success;
            return (
              <View key={p.id}>
                <View style={styles.stockRow}>
                  {/* Image produit */}
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.placeholderImage]}>
                      <Text style={styles.placeholderText}>📦</Text>
                    </View>
                  )}
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

      {/* Modal d'ajout de produit avec scan */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>➕ Ajouter un produit</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom du produit *"
              value={newProduct.name}
              onChangeText={text => setNewProduct({ ...newProduct, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Prix (DA) *"
              value={newProduct.price}
              onChangeText={text => setNewProduct({ ...newProduct, price: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Quantité en stock"
              value={newProduct.stock_quantity}
              onChangeText={text => setNewProduct({ ...newProduct, stock_quantity: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Stock minimum"
              value={newProduct.min_stock}
              onChangeText={text => setNewProduct({ ...newProduct, min_stock: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Catégorie (optionnel)"
              value={newProduct.category}
              onChangeText={text => setNewProduct({ ...newProduct, category: text })}
            />
            <View style={styles.barcodeRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Code-barres (optionnel)"
                value={newProduct.barcode}
                onChangeText={text => setNewProduct({ ...newProduct, barcode: text })}
              />
              <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
                <Text style={styles.scanBtnText}>📷</Text>
              </TouchableOpacity>

            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={addProduct}>
                <Text style={styles.modalConfirmText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal scanner */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scanner un code-barres</Text>
            <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.scannerClose}>
              <Text style={styles.scannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <CameraView
            style={styles.scanner}
            facing="back"
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'upc_a', 'upc_e'],
            }}
          />
          <Text style={styles.scannerHint}>Placez le code-barres devant la caméra</Text>
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
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: COLORS.primary },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanBtn: { backgroundColor: COLORS.success, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, justifyContent: 'center' },
  scanBtnText: { color: '#fff', fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#eee' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '500' },
  modalConfirm: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: COLORS.primary },
  modalConfirmText: { color: '#fff', fontWeight: '500' },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#111' },
  scannerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  scannerClose: { padding: 8 },
  scannerCloseText: { fontSize: 20, color: '#fff' },
  scanner: { flex: 1 },
  scannerHint: { textAlign: 'center', color: '#fff', padding: 16, backgroundColor: '#111' },
  productImage: { width: 50, height: 50, borderRadius: 8, marginRight: 10, backgroundColor: '#f0f0f0' },
  placeholderImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' },
  placeholderText: { fontSize: 24 },
});