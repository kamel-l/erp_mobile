// src/screens/StockImportScreen.js (version SQLite)
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, formatDA } from '../services/theme';
import { Card, RowBetween, Divider } from '../components/UIComponents';
import { getLocalProducts, saveProductsLocally } from '../database/database';

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
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', category: '', price: '', stock_quantity: '', min_stock: '', description: '' });

  const loadProducts = async () => {
    try {
      setLoading(true);
      const prods = await getLocalProducts();
      setProducts(prods);
      setHasStock(prods.length > 0);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const initializeDefaultStock = async () => {
    Alert.alert('Initialiser le stock', 'Cela va remplacer le stock actuel par les 10 produits par défaut. Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Initialiser', onPress: async () => {
        setLoading(true);
        try {
          await saveProductsLocally(DEFAULT_STOCK);
          await loadProducts();
          Alert.alert('Succès', `Stock initialisé avec ${DEFAULT_STOCK.length} produits`);
        } catch (error) { Alert.alert('Erreur', error.message); } finally { setLoading(false); }
      }}
    ]);
  };

  const resetToDefaultStock = async () => {
    Alert.alert('Réinitialiser le stock', 'Remplacer par les produits par défaut ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réinitialiser', onPress: async () => {
        setLoading(true);
        try {
          await saveProductsLocally(DEFAULT_STOCK);
          await loadProducts();
          Alert.alert('Succès', 'Stock réinitialisé');
        } catch (error) { Alert.alert('Erreur', error.message); } finally { setLoading(false); }
      }}
    ]);
  };

  const clearStock = async () => {
    Alert.alert('Vider le stock', 'Supprimer TOUS les produits ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: async () => {
        setLoading(true);
        try {
          await saveProductsLocally([]);
          await loadProducts();
          Alert.alert('Succès', 'Stock vidé');
        } catch (error) { Alert.alert('Erreur', error.message); } finally { setLoading(false); }
      }}
    ]);
  };

  const parseAndImportCSV = async (csvContent) => {
    const lines = csvContent.split('\n').filter(l => l.trim());
    if (lines.length === 0) throw new Error('Fichier CSV vide');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['name', 'price'];
    const missing = required.filter(col => !headers.includes(col));
    if (missing.length) throw new Error(`Colonnes manquantes: ${missing.join(', ')}`);
    const productsList = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const product = { id: Date.now() + i + Math.random(), created_at: new Date().toISOString() };
      headers.forEach((header, idx) => {
        const val = values[idx] || '';
        switch (header) {
          case 'name': product.name = val; break;
          case 'price': product.price = parseFloat(val) || 0; break;
          case 'stock_quantity': product.stock_quantity = parseInt(val) || 0; break;
          case 'min_stock': product.min_stock = parseInt(val) || 0; break;
          case 'barcode': product.barcode = val; break;
          case 'category': product.category = val; break;
          case 'description': product.description = val; break;
          default: product[header] = val;
        }
      });
      if (!product.stock_quantity) product.stock_quantity = 0;
      if (!product.min_stock) product.min_stock = 0;
      if (product.name && product.price >= 0) productsList.push(product);
    }
    if (productsList.length === 0) throw new Error('Aucun produit valide');
    await saveProductsLocally(productsList);
    await loadProducts();
    Alert.alert('Import réussi', `${productsList.length} produit(s) importé(s)`);
  };

  const importFromCSVFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/*', copyToCacheDirectory: true });
      if (result.type === 'cancel') return;
      setLoading(true);
      const fileContent = await FileSystem.readAsStringAsync(result.uri);
      await parseAndImportCSV(fileContent);
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const importFromCSVText = async () => {
    if (!csvText.trim()) { Alert.alert('Erreur', 'Veuillez coller du contenu CSV'); return; }
    setLoading(true);
    try {
      await parseAndImportCSV(csvText);
      setCsvModalVisible(false);
      setCsvText('');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price || parseFloat(newProduct.price) <= 0) {
      Alert.alert('Erreur', 'Nom et prix valides requis');
      return;
    }
    setLoading(true);
    try {
      const product = {
        id: Date.now() + Math.random(),
        name: newProduct.name.trim(),
        barcode: newProduct.barcode.trim() || '',
        category: newProduct.category.trim() || 'Non catégorisé',
        price: parseFloat(newProduct.price),
        stock_quantity: parseInt(newProduct.stock_quantity) || 0,
        min_stock: parseInt(newProduct.min_stock) || 0,
        description: newProduct.description.trim() || '',
        created_at: new Date().toISOString(),
      };
      const updated = [...products, product];
      await saveProductsLocally(updated);
      await loadProducts();
      setAddModalVisible(false);
      setNewProduct({ name: '', barcode: '', category: '', price: '', stock_quantity: '', min_stock: '', description: '' });
      Alert.alert('Succès', 'Produit ajouté');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const goToApp = () => navigation.replace('Main');

  const totalValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);
  const lowStockCount = products.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)).length;

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.logoCircle}><Text style={styles.logoText}>ERP</Text></View>
        <Text style={styles.appName}>DAR ELSSALEM</Text>
        <Text style={styles.appSubtitle}>Gestion de Stock</Text>
      </View>
      <Card style={styles.statsCard}>
        <Text style={styles.statsTitle}>📊 État du stock</Text>
        <RowBetween style={styles.statRow}><Text style={styles.statLabel}>Produits en stock</Text><Text style={[styles.statValue, { color: COLORS.primary }]}>{products.length}</Text></RowBetween>
        <RowBetween style={styles.statRow}><Text style={styles.statLabel}>Valeur totale</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{formatDA(totalValue)}</Text></RowBetween>
        <RowBetween style={styles.statRow}><Text style={styles.statLabel}>Stock critique</Text><Text style={[styles.statValue, { color: COLORS.danger }]}>{lowStockCount}</Text></RowBetween>
      </Card>
      {!hasStock && (
        <TouchableOpacity style={styles.initBtn} onPress={initializeDefaultStock}>
          <Text style={styles.initIcon}>🚀</Text>
          <Text style={styles.initTitle}>Initialiser le stock par défaut</Text>
          <Text style={styles.initSubtitle}>Créer 10 produits de démonstration</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.goToAppBtn} onPress={goToApp}>
        <Text style={styles.goToAppText}>✓ Accéder à l'application</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>📥 Importer des produits</Text>
      <TouchableOpacity style={styles.importBtn} onPress={importFromCSVFile}>
        <Text style={styles.btnIcon}>📄</Text>
        <View style={{ flex: 1 }}><Text style={styles.btnTitle}>Importer depuis un fichier CSV</Text><Text style={styles.btnSubtitle}>Sélectionner un fichier .csv ou .txt</Text></View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.importBtn} onPress={() => setCsvModalVisible(true)}>
        <Text style={styles.btnIcon}>📋</Text>
        <View style={{ flex: 1 }}><Text style={styles.btnTitle}>Coller du texte CSV</Text><Text style={styles.btnSubtitle}>Importer depuis le presse-papiers</Text></View>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>➕ Ajouter un produit</Text>
      <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
        <Text style={styles.btnIcon}>➕</Text>
        <View style={{ flex: 1 }}><Text style={styles.btnTitle}>Ajouter manuellement</Text><Text style={styles.btnSubtitle}>Saisir les informations du produit</Text></View>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>⚙️ Gestion du stock</Text>
      <TouchableOpacity style={styles.resetBtn} onPress={resetToDefaultStock}>
        <Text style={styles.btnIcon}>🔄</Text>
        <View style={{ flex: 1 }}><Text style={styles.btnTitle}>Réinitialiser le stock</Text><Text style={styles.btnSubtitle}>Restaurer les produits par défaut</Text></View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.clearBtn} onPress={clearStock}>
        <Text style={styles.btnIcon}>🗑️</Text>
        <View style={{ flex: 1 }}><Text style={[styles.btnTitle, { color: COLORS.danger }]}>Vider le stock</Text><Text style={styles.btnSubtitle}>Supprimer tous les produits</Text></View>
      </TouchableOpacity>
      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>📦 Aperçu des produits</Text>
        {products.slice(0,5).map(p => (
          <View key={p.id} style={styles.previewItem}>
            <Text style={styles.previewName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.previewPrice}>{formatDA(p.price)}</Text>
          </View>
        ))}
        {products.length > 5 && <Text style={styles.previewMore}>... et {products.length-5} autres</Text>}
        {products.length === 0 && <Text style={styles.previewEmpty}>Aucun produit en stock</Text>}
      </View>
      <Card style={{ marginTop:20, backgroundColor:'#E3F2FD' }}>
        <Text style={styles.infoTitle}>ℹ️ Format CSV attendu</Text>
        <Text style={styles.infoText}>name,price,stock_quantity,min_stock,category,barcode,description</Text>
        <Text style={styles.infoSubtext}>• name et price obligatoires • Première ligne = en-têtes</Text>
      </Card>
      {/* Modals ... (similaires) */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F5F5F5' },
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
    },});