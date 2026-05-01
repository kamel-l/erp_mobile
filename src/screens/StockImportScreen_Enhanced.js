// src/screens/StockImportScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, formatDA } from '../services/theme';
import { Card, RowBetween, Divider } from '../components/UIComponents';
import {
  getLocalProducts,
  saveProductsLocally,
  getProductByBarcode,
  updateProductStock,
  getLocalClients,
  saveClientsLocally,
  importSaleFromDAT,
  clearAllData,
} from '../database/database';

// Stock par défaut (uniquement pour l'initialisation manuelle)
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
  const [newProduct, setNewProduct] = useState({
    name: '', barcode: '', category: '', price: '', stock_quantity: '', min_stock: '', description: '',
  });

  // Charger les produits
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

  // Calcul des totaux (mise à jour après chaque chargement)
  const totalValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);
  const lowStockCount = products.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)).length;

  // ==================== NAVIGATION ====================
  const goToApp = () => navigation.replace('Main');

  // ==================== GESTION STOCK ====================
  const initializeDefaultStock = async () => {
    Alert.alert(
      'Initialiser le stock',
      'Cela va remplacer le stock actuel par les 10 produits par défaut. Continuer ?',
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
            } catch (error) { Alert.alert('Erreur', error.message); } finally { setLoading(false); }
          }
        }
      ]
    );
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
              await saveProductsLocally(DEFAULT_STOCK);
              await loadProducts();
              Alert.alert('Succès', `${DEFAULT_STOCK.length} produits par défaut chargés`);
            } catch (error) { Alert.alert('Erreur', error.message); } finally { setLoading(false); }
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
              await saveProductsLocally([]);
              await loadProducts();
              Alert.alert('Succès', 'Stock vidé avec succès');
            } catch (error) { Alert.alert('Erreur', error.message); } finally { setLoading(false); }
          }
        }
      ]
    );
  };

  const clearDatabase = async () => {
    Alert.alert(
      'Vider la base de données',
      '⚠️ ATTENTION : Cette action supprimera TOUTES les données (produits, clients, ventes, employés, etc.). Cette action est irréversible. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await clearAllData();
              await loadProducts();
              Alert.alert('Succès', 'La base de données a été entièrement vidée.');
            } catch (error) { Alert.alert('Erreur', error.message); } finally { setLoading(false); }
          }
        }
      ]
    );
  };

  // ==================== IMPORT CSV ====================
  const parseAndImportCSV = async (csvContent) => {
    const lines = csvContent.split('\n').filter(l => l.trim());
    if (lines.length === 0) throw new Error('Le fichier CSV est vide');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredColumns = ['name', 'price'];
    const missing = requiredColumns.filter(col => !headers.includes(col));
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
    if (productsList.length === 0) throw new Error('Aucun produit valide trouvé');
    await saveProductsLocally(productsList);
    await loadProducts();
    Alert.alert('Import réussi', `${productsList.length} produit(s) importé(s)`);
  };

  const importFromCSVFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/*',
        copyToCacheDirectory: true,
      });
      if (result.type === 'cancel') return;
      setLoading(true);
      const fileContent = await FileSystem.readAsStringAsync(result.uri);
      await parseAndImportCSV(fileContent);
    } catch (error) {
      Alert.alert('Erreur', `Impossible de lire le fichier: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const importFromCSVText = async () => {
    if (!csvText.trim()) {
      Alert.alert('Erreur', 'Veuillez coller du contenu CSV');
      return;
    }
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

  // ==================== AJOUT MANUEL ====================
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

  // ==================== IMPORT .DAT (fichiers uniques ou multiples séquentiels) ====================
  const parseAndImportDAT = async (content) => {
    // Parser les paramètres URL-encoded
    const params = {};
    const parts = content.split('&');
    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key && val) {
        params[key] = decodeURIComponent(val);
      }
    }

    // DEBUG : afficher les clés reçues (dans la console)
    console.log('📦 Paramètres du fichier DAT :', Object.keys(params).join(', '));

    const clientName = (params.Customer || '').trim() || 'Client Importé';
    const dateStr = params.Date ? params.Date.split(' ')[0] : new Date().toISOString().split('T')[0];
    const taxRate = parseFloat(params.TaxRate || 0);
    const paymentTerms = params.PaymentTerms || '1';
    const paymentMap = { '1': 'cash', '2': 'credit', '3': 'card', '4': 'transfer' };
    const paymentMethod = paymentMap[paymentTerms] || 'cash';

    // Gestion du client
    const existingClients = await getLocalClients();
    let clientId = existingClients.find(c => c.name.toLowerCase() === clientName.toLowerCase())?.id;
    if (!clientId) {
      const newClient = { id: Date.now(), name: clientName, phone: '', email: '', address: '', created_at: new Date().toISOString() };
      await saveClientsLocally([...existingClients, newClient]);
      clientId = newClient.id;
    }

    const itemCount = parseInt(params.ItemCount || 1, 10);
    const itemsForImport = [];

    for (let i = 1; i <= itemCount; i++) {
      // Récupération du code-barres (plusieurs clés possibles)
      const code = (
        params[`Item${i}Code`] || 
        params[`Item${i}Barcode`] || 
        params[`Item${i}BarCode`] || 
        params[`Item${i}Ref`] || 
        ''
      ).trim();

      // Récupération du nom : essayer plusieurs clés possibles
      let name = (
        params[`Item${i}Name`] || 
        params[`Item${i}Description`] || 
        params[`Item${i}Product`] || 
        params[`Item${i}Designation`] || 
        params[`Item${i}Label`] || 
        code || 
        ''
      ).trim();
      
      if (!name) {
        console.warn(`⚠️ Aucun nom trouvé pour l'article ${i}, les clés disponibles :`, Object.keys(params).filter(k => k.includes(`Item${i}`)));
        name = `Article ${i}`;
      }

      const qty = parseFloat(params[`Item${i}Qty`] || 1);
      const price = parseFloat(params[`Item${i}UnitValue`] || 0) / 100; // en centimes
      const discount = parseFloat(params[`Item${i}Discount`] || 0);

      // Rechercher ou créer le produit
      let product = null;
      if (code) product = await getProductByBarcode(code);
      if (!product && name !== `Article ${i}`) {
        const allProducts = await getLocalProducts();
        product = allProducts.find(p => p.name.toLowerCase() === name.toLowerCase());
      }

      let productId;
      if (product) {
        productId = product.id;
        const newStock = (product.stock_quantity || 0) + qty;
        await updateProductStock(productId, newStock);
      } else {
        const newProductItem = {
          id: Date.now() + Math.random(),
          name: name,
          barcode: code || '',
          category: '',
          price: price,
          stock_quantity: qty,
          min_stock: 0,
          description: '',
          created_at: new Date().toISOString(),
        };
        const allProducts = await getLocalProducts();
        await saveProductsLocally([...allProducts, newProductItem]);
        productId = newProductItem.id;
      }

      const total = price * qty * (1 - discount / 100);
      itemsForImport.push({
        product_id: productId,
        barcode: code,
        name: name,
        quantity: qty,
        unit_price: price,
        total: total,
      });
    }

    const subtotal = itemsForImport.reduce((sum, it) => sum + it.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const saleData = {
      client_id: clientId,
      client_name: clientName,
      date: dateStr,
      total: total,
      status: 'paid',
      tva_applied: taxRate > 0 ? 1 : 0,
      payment_method: paymentMethod,
      invoice_number: `IMP-${Date.now()}`,
    };
    await importSaleFromDAT(saleData, itemsForImport);
  };

  const importDATFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || result.type === 'cancel') return;

      const files = result.assets || (result.uri ? [result] : []);
      const datFiles = files.filter(f => f.name.toLowerCase().endsWith('.dat'));

      if (datFiles.length === 0) {
        Alert.alert('Aucun fichier .DAT', 'Veuillez sélectionner au moins un fichier .dat');
        return;
      }

      setLoading(true);
      let successCount = 0;
      let errorCount = 0;

      for (const file of datFiles) {
        try {
          const fileContent = await FileSystem.readAsStringAsync(file.uri);
          await parseAndImportDAT(fileContent);
          successCount++;
        } catch (err) {
          console.error(`Erreur avec ${file.name}:`, err);
          errorCount++;
        }
      }

      await loadProducts(); // rafraîchir le stock
      let message = `${successCount} fichier(s) importé(s) avec succès.`;
      if (errorCount > 0) message += ` ${errorCount} échec(s).`;
      Alert.alert('Import terminé', message);
    } catch (error) {
      Alert.alert('Erreur', `Impossible de sélectionner les fichiers : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDU ====================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du stock...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.logoCircle}><Text style={styles.logoText}>ERP</Text></View>
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

      <TouchableOpacity style={styles.barcodeImageBtn} onPress={() => navigation.navigate('BarcodeImageImport')}>
        <Text style={styles.btnIcon}>📸</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.btnTitle}>Importer images de codes-barres</Text>
          <Text style={styles.btnSubtitle}>Sélectionner des photos de QR / codes-barres</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.importBtn} onPress={importFromCSVFile}>
        <Text style={styles.btnIcon}>📄</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.btnTitle}>Importer depuis un fichier CSV</Text>
          <Text style={styles.btnSubtitle}>Sélectionner un fichier .csv ou .txt</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.importBtn} onPress={() => setCsvModalVisible(true)}>
        <Text style={styles.btnIcon}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.btnTitle}>Coller du texte CSV</Text>
          <Text style={styles.btnSubtitle}>Importer depuis le presse-papiers</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.datBtn} onPress={importDATFiles}>
        <Text style={styles.btnIcon}>📦</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.btnTitle}>Importer un/des fichiers .DAT</Text>
          <Text style={styles.btnSubtitle}>Sélectionnez un fichier .dat (possibilité d'en ajouter ensuite)</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>➕ Ajouter un produit</Text>
      <TouchableOpacity style={styles.addBtn} onPress={() => setAddModalVisible(true)}>
        <Text style={styles.btnIcon}>➕</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.btnTitle}>Ajouter manuellement</Text>
          <Text style={styles.btnSubtitle}>Saisir les informations du produit</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>⚙️ Gestion du stock & Données</Text>
      <TouchableOpacity style={styles.resetBtn} onPress={resetToDefaultStock}>
        <Text style={styles.btnIcon}>🔄</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.btnTitle}>Réinitialiser le stock</Text>
          <Text style={styles.btnSubtitle}>Restaurer les produits par défaut</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.clearBtn} onPress={clearStock}>
        <Text style={styles.btnIcon}>🗑️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.btnTitle, { color: COLORS.danger }]}>Vider le stock</Text>
          <Text style={styles.btnSubtitle}>Supprimer tous les produits</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.clearBtn, { borderColor: '#B71C1C', backgroundColor: '#FFCDD2' }]} onPress={clearDatabase}>
        <Text style={styles.btnIcon}>🧨</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.btnTitle, { color: '#B71C1C' }]}>Vider la base de données</Text>
          <Text style={styles.btnSubtitle}>Supprimer absolument toutes les données</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>📦 Aperçu des produits</Text>
        {products.slice(0, 5).map(p => (
          <View key={p.id} style={styles.previewItem}>
            <Text style={styles.previewName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.previewPrice}>{formatDA(p.price)}</Text>
          </View>
        ))}
        {products.length > 5 && <Text style={styles.previewMore}>... et {products.length - 5} autres produits</Text>}
        {products.length === 0 && <Text style={styles.previewEmpty}>Aucun produit en stock</Text>}
      </View>

      <Card style={{ marginTop: 20, backgroundColor: '#E3F2FD' }}>
        <Text style={styles.infoTitle}>ℹ️ Format CSV attendu</Text>
        <Text style={styles.infoText}>name,price,stock_quantity,min_stock,category,barcode,description</Text>
        <Text style={styles.infoSubtext}>• name et price sont obligatoires{'\n'}• La première ligne doit contenir les en-têtes</Text>
      </Card>

      {/* Modal Ajout produit */}
      <Modal visible={addModalVisible} animationType="slide" transparent onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>➕ Ajouter un produit</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom du produit *</Text>
                <TextInput style={styles.input} value={newProduct.name} onChangeText={t => setNewProduct({ ...newProduct, name: t })} placeholder="Ex: Ordinateur HP ProBook" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Prix (DA) *</Text>
                <TextInput style={styles.input} value={newProduct.price} onChangeText={t => setNewProduct({ ...newProduct, price: t })} keyboardType="numeric" placeholder="Ex: 75000" />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Quantité</Text>
                  <TextInput style={styles.input} value={newProduct.stock_quantity} onChangeText={t => setNewProduct({ ...newProduct, stock_quantity: t })} keyboardType="numeric" placeholder="0" />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Stock min</Text>
                  <TextInput style={styles.input} value={newProduct.min_stock} onChangeText={t => setNewProduct({ ...newProduct, min_stock: t })} keyboardType="numeric" placeholder="0" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Catégorie</Text>
                <TextInput style={styles.input} value={newProduct.category} onChangeText={t => setNewProduct({ ...newProduct, category: t })} placeholder="Ex: Informatique" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Code-barres</Text>
                <TextInput style={styles.input} value={newProduct.barcode} onChangeText={t => setNewProduct({ ...newProduct, barcode: t })} placeholder="Ex: HP001" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput style={[styles.input, { height: 80 }]} value={newProduct.description} onChangeText={t => setNewProduct({ ...newProduct, description: t })} multiline numberOfLines={3} placeholder="Description du produit" />
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={addProduct}>
                <Text style={styles.submitBtnText}>✓ Ajouter le produit</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal CSV Texte */}
      <Modal visible={csvModalVisible} animationType="slide" transparent onRequestClose={() => setCsvModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Coller du CSV</Text>
              <TouchableOpacity onPress={() => setCsvModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Collez votre contenu CSV ci-dessous{'\n'}Format: name,price,stock_quantity,min_stock,category,barcode</Text>
            <TextInput style={styles.csvInput} value={csvText} onChangeText={setCsvText} multiline numberOfLines={10} placeholder="name,price,stock_quantity,min_stock,category,barcode&#10;Produit A,1500,10,5,Catégorie,CODE001" />
            <TouchableOpacity style={styles.submitBtn} onPress={importFromCSVText}>
              <Text style={styles.submitBtnText}>📥 Importer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  loadingText: { marginTop: 20, fontSize: 16, fontWeight: '500', color: COLORS.primary },
  header: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
  logoCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  appName: { fontSize: 22, fontWeight: '700', color: COLORS.text, letterSpacing: 1 },
  appSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  statsCard: { marginBottom: 20 },
  statsTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  statRow: { marginBottom: 10 },
  statLabel: { fontSize: 13, color: COLORS.textSecondary },
  statValue: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12, marginTop: 20 },
  initBtn: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  initIcon: { fontSize: 48, marginBottom: 12 },
  initTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  initSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  goToAppBtn: { backgroundColor: COLORS.success, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
  goToAppText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  importBtn: { backgroundColor: '#E3F2FD', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.primary },
  datBtn: { backgroundColor: '#F3E5F5', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#A855F7' },
  addBtn: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.success },
  resetBtn: { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#FF9800' },
  clearBtn: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.danger },
  btnIcon: { fontSize: 32, marginRight: 12 },
  btnTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  btnSubtitle: { fontSize: 12, color: COLORS.textSecondary },
  previewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 20, borderWidth: 0.5, borderColor: '#E0E0E0' },
  previewTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  previewItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  previewName: { fontSize: 13, color: COLORS.text, flex: 1 },
  previewPrice: { fontSize: 13, fontWeight: '500', color: COLORS.primary },
  previewMore: { textAlign: 'center', fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  previewEmpty: { textAlign: 'center', fontSize: 13, color: COLORS.textSecondary, paddingVertical: 20 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  infoText: { fontSize: 11, fontFamily: 'monospace', backgroundColor: '#fff', padding: 8, borderRadius: 6, marginBottom: 8, color: COLORS.text },
  infoSubtext: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  closeBtn: { fontSize: 24, color: COLORS.textSecondary, padding: 4 },
  modalSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 18 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '500', color: COLORS.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: '#FAFAFA' },
  row: { flexDirection: 'row' },
  csvInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, padding: 12, fontSize: 12, fontFamily: 'monospace', color: COLORS.text, backgroundColor: '#FAFAFA', height: 200, textAlignVertical: 'top', marginBottom: 16 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  barcodeImageBtn: { backgroundColor: '#FCE4EC', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F48FB1' },
});