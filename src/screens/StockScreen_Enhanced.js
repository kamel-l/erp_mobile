// src/screens/StockScreen_Enhanced.js
/**
 * StockScreen amélioré avec:
 * - Validation Yup pour produits
 * - Logger pour tous les événements
 * - Toast pour feedback utilisateur
 * - Gestion d'erreurs robuste
 */

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
import { getLocalProducts, saveProductsLocally, getProductByBarcode, updateProduct, deleteProduct, addProductWithImage } from '../database/database';
import { useFormValidation } from '../hooks/useFormValidation';
import { ProductSchema } from '../services/validation';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

const DEFAULT_STOCK = [
  { id: 1, name: 'Ordinateur HP ProBook', barcode: 'HP001', category: 'Informatique', price: 75000, stock_quantity: 2, min_stock: 2 },
  { id: 2, name: 'Souris Logitech MX', barcode: 'LOG001', category: 'Accessoires', price: 1500, stock_quantity: 8, min_stock: 10 },
  { id: 3, name: 'Écran Samsung 24"', barcode: 'SAM001', category: 'Informatique', price: 25000, stock_quantity: 3, min_stock: 3 },
  { id: 4, name: 'Clavier HP Slim', barcode: 'HP002', category: 'Accessoires', price: 2500, stock_quantity: 35, min_stock: 10 },
  { id: 5, name: 'Bureau Professionnel', barcode: 'BUR001', category: 'Mobilier', price: 35000, stock_quantity: 12, min_stock: 2 },
  { id: 6, name: 'Chaise Ergonomique', barcode: 'CHA001', category: 'Mobilier', price: 15000, stock_quantity: 8, min_stock: 5 },
  { id: 7, name: 'Imprimante Canon', barcode: 'CAN001', category: 'Informatique', price: 18000, stock_quantity: 5, min_stock: 2 },
];

export default function StockScreenEnhanced() {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Form validation hook
  const { values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, reset } = useFormValidation(
    { name: '', barcode: '', category: '', price: '', stock_quantity: '', min_stock: '' },
    ProductSchema,
    async (formValues) => {
      try {
        logger.debug('Enregistrement produit', { mode: editingProductId ? 'edit' : 'add', name: formValues.name });

        const productData = {
          name: formValues.name.trim(),
          barcode: formValues.barcode.trim() || '',
          category: formValues.category.trim() || 'Non catégorisé',
          price: parseFloat(formValues.price),
          stock_quantity: parseInt(formValues.stock_quantity) || 0,
          min_stock: parseInt(formValues.min_stock) || 0,
        };

        if (editingProductId) {
          // Vérifier les doublons de code-barres
          if (productData.barcode) {
            const existing = await getProductByBarcode(productData.barcode);
            if (existing && existing.id !== editingProductId) {
              logger.warn('Code-barres déjà utilisé', { barcode: productData.barcode });
              Toast.error('Ce code-barres existe déjà');
              return;
            }
          }
          
          await updateProduct(editingProductId, productData);
          logger.info('Produit modifié', { id: editingProductId, name: productData.name });
          Toast.success('Produit modifié ✓');
        } else {
          // Vérifier les doublons de code-barres
          if (productData.barcode) {
            const existing = await getProductByBarcode(productData.barcode);
            if (existing) {
              logger.warn('Code-barres déjà utilisé', { barcode: productData.barcode });
              Toast.error('Ce code-barres existe déjà');
              return;
            }
          }
          
          await addProductWithImage(productData);
          logger.info('Produit créé', { name: productData.name });
          Toast.success('Produit ajouté ✓');
        }

        await loadProducts();
        setModalVisible(false);
        reset();
        setEditingProductId(null);
      } catch (error) {
        logger.error('Erreur lors de l\'enregistrement du produit', error);
        Toast.error('Erreur lors de l\'enregistrement');
      }
    }
  );

  const loadProducts = useCallback(async () => {
    try {
      logger.debug('Chargement des produits');
      const prods = await getLocalProducts();
      setProducts(prods || []);
      logger.info('Produits chargés', { count: prods?.length || 0 });
    } catch (error) {
      logger.error('Erreur lors du chargement des produits', error);
      Toast.error('Impossible de charger les produits');
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
    logger.debug('Rafraîchissement du stock');
    await loadProducts();
    setRefreshing(false);
  };

  const initializeDefaultStock = async () => {
    logger.debug('Tentative initialisation stock par défaut');
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
              logger.info('Stock par défaut initialisé', { count: DEFAULT_STOCK.length });
              Toast.success(`${DEFAULT_STOCK.length} produits ajoutés`);
            } catch (error) {
              logger.error('Erreur initialisation stock', error);
              Toast.error('Erreur lors de l\'initialisation');
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

  const openEditModal = (p) => {
    logger.debug('Ouverture modal édition produit', { id: p.id, name: p.name });
    setEditingProductId(p.id);
    reset({
      name: p.name,
      barcode: p.barcode || '',
      category: p.category || '',
      price: p.price ? p.price.toString() : '0',
      stock_quantity: p.stock_quantity ? p.stock_quantity.toString() : '0',
      min_stock: p.min_stock ? p.min_stock.toString() : '0',
    });
    setModalVisible(true);
  };

  const handleDelete = (id, name) => {
    logger.debug('Tentative suppression produit', { id, name });
    Alert.alert('Confirmer', `Supprimer "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await deleteProduct(id);
            await loadProducts();
            logger.info('Produit supprimé', { id, name });
            Toast.success('Produit supprimé');
          } catch (error) {
            logger.error('Erreur suppression produit', error);
            Toast.error('Erreur lors de la suppression');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const handleBarCodeScanned = ({ data }) => {
    logger.debug('Code-barres scanné', { barcode: data });
    setScannerVisible(false);
    handleChange('barcode', data);
    Toast.success(`Code-barres: ${data}`);
  };

  const openScanner = async () => {
    logger.debug('Tentative ouverture scanner');
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        logger.warn('Permission caméra refusée');
        Toast.error('Autoriser l\'accès caméra');
        return;
      }
    }
    setScannerVisible(true);
  };

  const importFromFile = async () => {
    try {
      logger.debug('Tentative import fichier CSV');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (!result.assets?.[0]) {
        logger.debug('Import annulé par utilisateur');
        return;
      }

      const uri = result.assets[0].uri;
      const csvString = await FileSystem.readAsStringAsync(uri);
      const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });

      const newProducts = parsed.data
        .map((row, idx) => ({
          id: Date.now() + idx,
          name: row.name || row.Name || row.nom || '',
          barcode: row.barcode || row.code || row.Barcode || '',
          category: row.category || row.Category || row.catégorie || '',
          price: parseFloat(row.price || row.Price || row.prix || 0),
          stock_quantity: parseInt(row.stock_quantity || row.quantity || row.qty || 0, 10),
          min_stock: parseInt(row.min_stock || row.minStock || row.minimum || 0, 10),
        }))
        .filter(p => p.name && !isNaN(p.price));

      if (newProducts.length === 0) {
        logger.warn('Aucun produit valide dans le CSV');
        Toast.error('Aucun produit valide trouvé');
        return;
      }

      const updatedProducts = [...products, ...newProducts];
      await saveProductsLocally(updatedProducts);
      await loadProducts();

      logger.info('Produits importés', { count: newProducts.length });
      Toast.success(`${newProducts.length} produits importés ✓`);
    } catch (error) {
      logger.error('Erreur import fichier', error);
      Toast.error('Erreur lors de l\'import');
    }
  };

  const filtered = products.filter(p => {
    const searchLower = search.toLowerCase();
    if (searchLower === '') return true;
    const nameFirst = p.name.charAt(0).toLowerCase();
    if (nameFirst === searchLower) return true;
    const barcodeFirst = p.barcode ? p.barcode.charAt(0).toLowerCase() : '';
    if (barcodeFirst === searchLower) return true;
    if (p.barcode && p.barcode.toLowerCase().includes(searchLower)) return true;
    return false;
  });

  const filteredByTab = tab === 'low'
    ? filtered.filter(p => p.stock_quantity <= p.min_stock)
    : filtered;

  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock).length;
  const totalValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du stock...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <View style={styles.kpiRow}>
          <KpiCard value={totalProducts} label="Total produits" color={COLORS.primary} style={{ marginRight: 6 }} />
          <KpiCard value={lowStockCount} label="Stock critique" color={COLORS.error} style={{ marginLeft: 6 }} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard value={formatDA(totalValue)} label="Valeur stock" color={COLORS.success} />
        </View>

        {totalProducts === 0 && (
          <TouchableOpacity
            style={styles.initButton}
            onPress={initializeDefaultStock}
          >
            <Text style={styles.initButtonText}>📦 Initialiser le stock par défaut</Text>
          </TouchableOpacity>
        )}

        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Chercher un produit..." />
          </View>
          <TouchableOpacity style={styles.importButton} onPress={importFromFile}>
            <Text style={styles.importButtonText}>📁</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => {
              logger.debug('Ouverture modal ajout produit');
              setEditingProductId(null);
              reset({ name: '', barcode: '', category: '', price: '', stock_quantity: '', min_stock: '' });
              setModalVisible(true);
            }}
          >
            <Text style={styles.importButtonText}>➕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'all' && styles.tabActive]}
            onPress={() => setTab('all')}
          >
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>Tous ({filtered.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'low' && styles.tabActive]}
            onPress={() => setTab('low')}
          >
            <Text style={[styles.tabText, tab === 'low' && styles.tabTextActive]}>Stock faible ({lowStockCount})</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle>{tab === 'low' ? 'Produits en stock faible' : 'Inventaire complet'}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {filteredByTab.length === 0 ? (
            <Text style={styles.emptyText}>Aucun produit</Text>
          ) : (
            filteredByTab.map((p) => {
              const status = getStockStatus(p.stock_quantity, p.min_stock);
              const dotColor = status === 'critical' ? COLORS.error : status === 'low' ? COLORS.warning : COLORS.success;
              return (
                <View key={p.id}>
                  <View style={styles.stockRow}>
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
                        {p.category || 'Non catégorisé'} • {formatDA(p.price)}
                        {p.barcode ? ` • ${p.barcode}` : ''}
                      </Text>
                      <ProgressBar
                        value={p.stock_quantity}
                        max={Math.max(p.min_stock * 3, p.stock_quantity)}
                        color={dotColor}
                        height={4}
                      />
                      <Text style={styles.stockQty}>
                        {p.stock_quantity} en stock {p.stock_quantity <= p.min_stock ? `(min: ${p.min_stock})` : ''}
                      </Text>
                    </View>
                    <View style={styles.stockActions}>
                      <TouchableOpacity onPress={() => openEditModal(p)} style={styles.actionBtn}>
                        <Text style={styles.actionBtnText}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(p.id, p.name)}
                        style={[styles.actionBtn, styles.actionBtnDelete]}
                      >
                        <Text style={styles.actionBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Divider />
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      {/* Modal ajout/modification avec validation */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingProductId ? 'Modifier produit' : 'Nouveau produit'}
            </Text>

            {/* Name field */}
            <View>
              <TextInput
                style={[styles.input, touched.name && errors.name && styles.inputError]}
                placeholder="Nom du produit *"
                value={values.name}
                onChangeText={(text) => handleChange('name', text)}
                onBlur={() => handleBlur('name')}
                editable={!isSubmitting}
              />
              {touched.name && errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Barcode field */}
            <View style={styles.fieldRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TextInput
                  style={[styles.input, touched.barcode && errors.barcode && styles.inputError]}
                  placeholder="Code-barres"
                  value={values.barcode}
                  onChangeText={(text) => handleChange('barcode', text)}
                  editable={!isSubmitting}
                />
                {touched.barcode && errors.barcode && (
                  <Text style={styles.errorText}>{errors.barcode}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
                <Text style={styles.scanBtnText}>📷</Text>
              </TouchableOpacity>
            </View>

            {/* Category field */}
            <View>
              <TextInput
                style={[styles.input, touched.category && errors.category && styles.inputError]}
                placeholder="Catégorie"
                value={values.category}
                onChangeText={(text) => handleChange('category', text)}
                editable={!isSubmitting}
              />
              {touched.category && errors.category && (
                <Text style={styles.errorText}>{errors.category}</Text>
              )}
            </View>

            {/* Price field */}
            <View>
              <TextInput
                style={[styles.input, touched.price && errors.price && styles.inputError]}
                placeholder="Prix (DA) *"
                value={values.price}
                onChangeText={(text) => handleChange('price', text)}
                keyboardType="decimal-pad"
                editable={!isSubmitting}
              />
              {touched.price && errors.price && (
                <Text style={styles.errorText}>{errors.price}</Text>
              )}
            </View>

            {/* Stock quantity field */}
            <View style={styles.fieldRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TextInput
                  style={[styles.input, touched.stock_quantity && errors.stock_quantity && styles.inputError]}
                  placeholder="Quantité en stock *"
                  value={values.stock_quantity}
                  onChangeText={(text) => handleChange('stock_quantity', text)}
                  keyboardType="number-pad"
                  editable={!isSubmitting}
                />
                {touched.stock_quantity && errors.stock_quantity && (
                  <Text style={styles.errorText}>{errors.stock_quantity}</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <TextInput
                  style={[styles.input, touched.min_stock && errors.min_stock && styles.inputError]}
                  placeholder="Minimum *"
                  value={values.min_stock}
                  onChangeText={(text) => handleChange('min_stock', text)}
                  keyboardType="number-pad"
                  editable={!isSubmitting}
                />
                {touched.min_stock && errors.min_stock && (
                  <Text style={styles.errorText}>{errors.min_stock}</Text>
                )}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setModalVisible(false);
                  reset();
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, isSubmitting && styles.modalSaveDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSaveText}>{isSubmitting ? '...' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr'] }}
          />
          <TouchableOpacity
            style={styles.closeScannerBtn}
            onPress={() => setScannerVisible(false)}
          >
            <Text style={styles.closeScannerText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.text },
  content: { paddingHorizontal: 12, paddingVertical: 12 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  initButton: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  initButtonText: { color: '#FFF', fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  importButton: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  importButtonText: { fontSize: 18 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: COLORS.border, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: '#FFF' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 24 },
  stockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  productImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  placeholderImage: { backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 24 },
  stockInfo: { flex: 1 },
  stockName: { fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  stockDetail: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  stockQty: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  stockActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 6, backgroundColor: COLORS.info, justifyContent: 'center', alignItems: 'center' },
  actionBtnDelete: { backgroundColor: COLORS.error },
  actionBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: COLORS.background, color: COLORS.text },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: -8, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  scanBtn: { width: 44, height: 44, backgroundColor: COLORS.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  scanBtnText: { fontSize: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.border },
  modalCancelText: { color: COLORS.text, textAlign: 'center', fontWeight: '600' },
  modalSave: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.primary },
  modalSaveText: { color: '#FFF', textAlign: 'center', fontWeight: '600' },
  modalSaveDisabled: { opacity: 0.6 },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  closeScannerBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', marginBottom: 12, marginHorizontal: 12, borderRadius: 8 },
  closeScannerText: { color: '#FFF', fontWeight: '600' },
});
