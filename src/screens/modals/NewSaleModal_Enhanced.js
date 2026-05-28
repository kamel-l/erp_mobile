// src/screens/modals/NewSaleModal_Enhanced.js
/**
 * NewSaleModal amélioré avec:
 * - Validation Yup pour les ventes
 * - Logger pour tous les événements
 * - Toast pour feedback utilisateur
 * - Gestion d'erreurs robuste
 */

// src/screens/modals/NewSaleModal_Enhanced.js
/**
 * NewSaleModal synchronisé avec l'application desktop (PyQt)
 * - Structures de données identiques
 * - Validation stock bloquante
 * - Modes de paiement : cash, card, transfer, check, credit
 * - TVA toujours calculée (affichage HT/TTC toggle)
 */

import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, formatDA } from '../../services/theme';
import {
  getLocalProducts,
  getLocalClients,
  saveClientsLocally,
  getProductByBarcode,
  findProductByAny,
} from '../../database/database';
import { calculateSaleTotals, savePreparedSale, validateSaleDraft } from '../../services/salesService';
import { logger } from '../../services/logger';
import { toast } from '../../components/Toast';

export default function NewSaleModalEnhanced({ visible, onClose, onSaved, initialClient }) {
  const [client, setClient] = useState(null);
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [clientsList, setClientsList] = useState([]);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [includeTVA, setIncludeTVA] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (visible) {
      logger.debug('NewSaleModal ouvert');
      loadProducts();
      loadClients();
      setClient(initialClient || null);
      setSearch('');
      setBarcode('');
      setCart([]);
      setPaymentMethod('');
      setIncludeTVA(true);
    }
  }, [visible, initialClient]);

  const loadProducts = async () => {
    try {
      const prods = await getLocalProducts();
      setProducts(prods || []);
      logger.info('Produits chargés', { count: prods?.length || 0 });
    } catch (error) {
      logger.error('Erreur chargement produits', error);
      toast.error('Impossible de charger les produits');
    }
  };

  const loadClients = async () => {
    try {
      const clients = await getLocalClients();
      setClientsList(clients || []);
      logger.info('Clients chargés', { count: clients?.length || 0 });
    } catch (error) {
      logger.error('Erreur chargement clients', error);
      toast.error('Impossible de charger les clients');
    }
  };

  const selectClient = (selected) => {
    setClient(selected);
    setClientModalVisible(false);
    toast.success(`Client: ${selected.name}`);
  };

  const addNewClient = async () => {
    try {
      if (!newClientName.trim()) {
        toast.error('Saisir un nom');
        return;
      }
      const newClient = {
        id: Date.now(),
        name: newClientName.trim(),
        phone: '',
        email: '',
        address: '',
        created_at: new Date().toISOString(),
      };
      const updated = [...clientsList, newClient];
      await saveClientsLocally(updated);
      setClientsList(updated);
      setClient(newClient);
      setNewClientName('');
      setClientModalVisible(false);
      toast.success('Client créé ✓');
    } catch (error) {
      logger.error('Erreur création client', error);
      toast.error('Impossible de créer le client');
    }
  };

  const filteredProducts = products.filter((p) => {
    const searchLower = search.toLowerCase();
    if (searchLower === '') return true;
    return p.name.toLowerCase().includes(searchLower) ||
           (p.barcode && p.barcode.toLowerCase().includes(searchLower));
  });

  const openProductModal = (product) => {
    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      setQuantity(String(existing.quantity));
      setUnitPrice(String(existing.price));
      setDiscountPercent(String(existing.discount));
    } else {
      setQuantity('1');
      setUnitPrice(String(product.price));
      setDiscountPercent('0');
    }
    setSelectedProduct(product);
    setProductModalVisible(true);
  };

  const searchProductByBarcode = async (code) => {
    try {
      if (!code) return;
      let trimmedCode = code.trim();
      const quoteMatch = trimmedCode.match(/"([^"]+)"/);
      if (quoteMatch) trimmedCode = quoteMatch[1].trim();
      else trimmedCode = trimmedCode.replace(/^[{]+|[\s}]+$/g, '').trim();

      let product = await getProductByBarcode(trimmedCode);
      if (!product) product = await findProductByAny(trimmedCode);

      if (product) {
        openProductModal(product);
        setBarcode('');
        toast.success(`Produit: ${product.name}`);
      } else {
        toast.error(`Code "${trimmedCode}" non trouvé`);
      }
    } catch (error) {
      logger.error('Erreur recherche produit', error);
      toast.error('Erreur recherche produit');
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    setScannerVisible(false);
    searchProductByBarcode(data);
  };

  const openScanner = async () => {
    try {
      if (!permission?.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          toast.error("Autoriser l'accès caméra");
          return;
        }
      }
      setScannerVisible(true);
    } catch (error) {
      logger.error('Erreur ouverture scanner', error);
      toast.error('Erreur scanner');
    }
  };

  const addOrUpdateCart = () => {
    try {
      if (!selectedProduct) {
        toast.error('Aucun produit');
        return;
      }

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        toast.error('Quantité invalide');
        return;
      }

      const price = parseFloat(unitPrice);
      if (isNaN(price) || price <= 0) {
        toast.error('Prix invalide');
        return;
      }

      const discount = parseFloat(discountPercent);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        toast.error('Remise invalide (0-100%)');
        return;
      }

      const stockDisponible = selectedProduct.stock_quantity || 0;
      if (qty > stockDisponible) {
        toast.error(`Stock insuffisant (${stockDisponible})`);
        return;
      }

      const total = qty * price * (1 - discount / 100);

      const existingIndex = cart.findIndex((item) => item.product_id === selectedProduct.id);
      const newItem = {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qty,
        price: price,
        discount: discount,
        total: total,
      };

      if (existingIndex !== -1) {
        const updatedCart = [...cart];
        updatedCart[existingIndex] = newItem;
        setCart(updatedCart);
      } else {
        setCart([...cart, newItem]);
      }

      toast.success('Panier mis à jour');
      setProductModalVisible(false);
      setSelectedProduct(null);
      setQuantity('1');
      setUnitPrice('');
      setDiscountPercent('0');
    } catch (error) {
      logger.error('Erreur ajout panier', error);
      toast.error('Erreur panier');
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart(cart.map((item) => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        const product = products.find(p => p.id === productId);
        if (product && newQty > (product.stock_quantity || 0)) {
          toast.error(`Stock limité à ${product.stock_quantity}`);
          return item;
        }
        const newTotal = newQty * item.price * (1 - item.discount / 100);
        return { ...item, quantity: newQty, total: newTotal };
      }
      return item;
    }).filter(Boolean));
  };

  const editPrice = (item) => {
    Alert.prompt(
      'Modifier le prix unitaire',
      `Prix actuel : ${formatDA(item.price)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Modifier',
          onPress: (newPrice) => {
            const price = parseFloat(newPrice);
            if (isNaN(price) || price <= 0) {
              toast.error('Prix invalide');
              return;
            }
            setCart(cart.map(cartItem =>
              cartItem.product_id === item.product_id
                ? { ...cartItem, price, total: cartItem.quantity * price * (1 - cartItem.discount / 100) }
                : cartItem
            ));
            toast.success('Prix mis à jour');
          },
        },
      ],
      'plain-text',
      String(item.price)
    );
  };

  const editDiscount = (item) => {
    Alert.prompt(
      'Modifier la remise (%)',
      `Remise actuelle : ${item.discount}%`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Modifier',
          onPress: (newDiscount) => {
            const discount = parseFloat(newDiscount);
            if (isNaN(discount) || discount < 0 || discount > 100) {
              toast.error('Remise invalide (0-100)');
              return;
            }
            setCart(cart.map(cartItem =>
              cartItem.product_id === item.product_id
                ? { ...cartItem, discount, total: cartItem.quantity * cartItem.price * (1 - discount / 100) }
                : cartItem
            ));
            toast.success('Remise mise à jour');
          },
        },
      ],
      'plain-text',
      String(item.discount)
    );
  };

  // Calcul des totaux (identique à Python)
  const subtotalHT = cart.reduce((sum, item) => sum + item.total, 0);
  const vatRate = 0.19; // À lire depuis les paramètres si nécessaire
  const taxAmount = subtotalHT * vatRate;
  const totalTTC = subtotalHT + taxAmount;

  const saveSale = async () => {
    try {
      if (!client) {
        toast.error('Sélectionnez un client');
        return;
      }
      if (cart.length === 0) {
        toast.error('Panier vide');
        return;
      }
      if (!paymentMethod) {
        toast.error('Choisissez un mode de paiement');
        return;
      }

      setLoading(true);
      const saleData = {
        client_id: client.id,
        client_name: client.name,
        cart: cart,
        payment_method: paymentMethod,
        subtotal_ht: subtotalHT,
        tax_amount: taxAmount,
        total_ttc: totalTTC,
        vat_rate: vatRate,
        date: new Date().toISOString(),
      };
      await savePreparedSale(saleData);
      toast.success('Vente enregistrée ✓');
      onSaved();
      onClose();
    } catch (error) {
      logger.error('Erreur sauvegarde vente', error);
      toast.error('Erreur sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartTableRow}>
      <Text style={[styles.cartTableCell, styles.cartProductName]} numberOfLines={1}>{item.product_name}</Text>
      <View style={styles.cartQuantityCell}>
        <TouchableOpacity onPress={() => updateQuantity(item.product_id, -1)} style={styles.qtyBtnSmall}>
          <Text style={styles.qtyBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.cartQtyText}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => updateQuantity(item.product_id, 1)} style={styles.qtyBtnSmall}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => editPrice(item)} style={styles.priceTouchable}>
        <Text style={[styles.cartTableCell, styles.cartPriceCell]}>{formatDA(item.price)}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => editDiscount(item)} style={styles.discountTouchable}>
        <Text style={[styles.cartTableCell, styles.cartDiscountCell]}>{item.discount}%</Text>
      </TouchableOpacity>
      <Text style={[styles.cartTableCell, styles.cartTotalCell]}>{formatDA(item.total)}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Nouvelle vente</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Client section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Client</Text>
            <TouchableOpacity style={styles.clientSelector} onPress={() => setClientModalVisible(true)}>
              <Text style={styles.clientSelectorText}>{client ? client.name : 'Sélectionner un client'}</Text>
              <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Barcode section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Ajouter par code-barres</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                style={styles.barcodeInput}
                placeholder="Saisir code"
                value={barcode}
                onChangeText={setBarcode}
                onSubmitEditing={() => searchProductByBarcode(barcode)}
              />
              <TouchableOpacity style={styles.barcodeBtn} onPress={() => searchProductByBarcode(barcode)}>
                <Text style={styles.barcodeBtnText}>🔍</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
                <Text style={styles.scanBtnText}>📷</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Products section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Produits</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView style={styles.productScrollView} nestedScrollEnabled>
              {filteredProducts.map((product) => (
                <TouchableOpacity key={product.id} style={styles.productItem} onPress={() => openProductModal(product)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>{formatDA(product.price)}</Text>
                    {product.barcode && <Text style={styles.productBarcode}>📍 {product.barcode}</Text>}
                    <Text style={styles.stockInfo}>📦 {product.stock_quantity || 0}</Text>
                  </View>
                  <Text style={styles.addIcon}>➕</Text>
                </TouchableOpacity>
              ))}
              {filteredProducts.length === 0 && <Text style={styles.emptyText}>Aucun produit</Text>}
            </ScrollView>
          </View>

          {/* Cart section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛒 Panier ({cart.length})</Text>
            {cart.length === 0 ? (
              <Text style={styles.emptyCart}>Panier vide</Text>
            ) : (
              <>
                <View style={styles.cartTableHeader}>
                  <Text style={[styles.cartHeaderCell, styles.cartProductName]}>Produit</Text>
                  <Text style={[styles.cartHeaderCell, styles.cartQuantityHeader]}>Qte</Text>
                  <Text style={[styles.cartHeaderCell, styles.cartPriceHeader]}>P.U.</Text>
                  <Text style={[styles.cartHeaderCell, styles.cartDiscountHeader]}>Remise</Text>
                  <Text style={[styles.cartHeaderCell, styles.cartTotalHeader]}>Total</Text>
                </View>
                <ScrollView style={styles.cartList} nestedScrollEnabled>
                  {cart.map((item) => (
                    <React.Fragment key={item.product_id}>
                      {renderCartItem({ item })}
                    </React.Fragment>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

          {/* Payment method section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Mode de paiement</Text>
            <View style={styles.paymentRow}>
              {[
                { value: 'cash', label: 'Espèces', icon: '💰' },
                { value: 'card', label: 'Carte', icon: '💳' },
                { value: 'transfer', label: 'Virement', icon: '🏦' },
                { value: 'check', label: 'Chèque', icon: '📝' },
                { value: 'credit', label: 'Crédit', icon: '📅' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.paymentOption, paymentMethod === option.value && styles.paymentOptionActive]}
                  onPress={() => setPaymentMethod(option.value)}
                >
                  <Text style={styles.paymentIcon}>{option.icon}</Text>
                  <Text style={[styles.paymentLabel, paymentMethod === option.value && styles.paymentLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* TVA toggle (affichage seulement) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Options d'affichage</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionBtn, includeTVA && styles.optionBtnActive]}
                onPress={() => setIncludeTVA(true)}
              >
                <Text style={[styles.optionBtnText, includeTVA && { color: '#fff' }]}>Afficher TTC</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, !includeTVA && styles.optionBtnActive]}
                onPress={() => setIncludeTVA(false)}
              >
                <Text style={[styles.optionBtnText, !includeTVA && { color: '#fff' }]}>Afficher HT</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Récapitulatif</Text>
            <View style={styles.totalRow}>
              <Text>Total HT</Text>
              <Text style={styles.totalValue}>{formatDA(subtotalHT)}</Text>
            </View>
            {includeTVA && (
              <View style={styles.totalRow}>
                <Text>TVA (19%)</Text>
                <Text style={styles.totalValue}>{formatDA(taxAmount)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={{ fontWeight: 'bold' }}>Total {includeTVA ? 'TTC' : 'HT'}</Text>
              <Text style={{ fontWeight: 'bold', color: COLORS.primary, fontSize: 16 }}>
                {formatDA(includeTVA ? totalTTC : subtotalHT)}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={saveSale} disabled={loading || cart.length === 0 || !client || !paymentMethod}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>

        {/* Modals (client, product, scanner) - garder le même contenu que l'original mais adapter les champs */}
        {/* Client selection modal */}
        <Modal visible={clientModalVisible} animationType="slide" transparent onRequestClose={() => setClientModalVisible(false)}>
          <View style={styles.miniModalOverlay}>
            <View style={styles.miniModalContent}>
              <Text style={styles.miniModalTitle}>Sélectionner un client</Text>
              <TextInput
                style={styles.clientSearchInput}
                placeholder="Nouveau client..."
                value={newClientName}
                onChangeText={setNewClientName}
              />
              <TouchableOpacity style={styles.addClientBtn} onPress={addNewClient}>
                <Text style={styles.addClientBtnText}>➕ Créer</Text>
              </TouchableOpacity>
              <ScrollView style={styles.clientsListView}>
                {clientsList.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.clientOption} onPress={() => selectClient(c)}>
                    <Text style={styles.clientOptionText}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.miniModalClose} onPress={() => setClientModalVisible(false)}>
                <Text style={styles.miniModalCloseText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Product modal */}
        <Modal visible={productModalVisible} animationType="slide" transparent onRequestClose={() => setProductModalVisible(false)}>
          <View style={styles.miniModalOverlay}>
            <View style={styles.miniModalContent}>
              <Text style={styles.miniModalTitle}>{selectedProduct?.name}</Text>
              <Text style={styles.productDetailPrice}>{formatDA(selectedProduct?.price || 0)}</Text>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Quantité</Text>
                <TextInput style={styles.quantityInput} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Prix unitaire</Text>
                <TextInput style={styles.quantityInput} value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Remise (%)</Text>
                <TextInput style={styles.quantityInput} value={discountPercent} onChangeText={setDiscountPercent} keyboardType="decimal-pad" />
              </View>
              <View style={styles.miniModalButtons}>
                <TouchableOpacity style={styles.miniModalCancel} onPress={() => setProductModalVisible(false)}>
                  <Text style={styles.miniModalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.miniModalSave} onPress={addOrUpdateCart}>
                  <Text style={styles.miniModalSaveText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Scanner modal */}
        <Modal visible={scannerVisible} animationType="slide" transparent={false} onRequestClose={() => setScannerVisible(false)}>
          <View style={styles.scannerContainer}>
            <CameraView style={styles.camera} onBarcodeScanned={handleBarCodeScanned} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr'] }} />
            <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setScannerVisible(false)}>
              <Text style={styles.closeScannerText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ... (garder les styles existants, ajouter les nouveaux si besoin)
  cartDiscountHeader: { width: 50, textAlign: 'center' },
  cartDiscountCell: { width: 50, textAlign: 'center' },
  discountTouchable: { width: 50, alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  closeBtnText: { fontSize: 24, color: COLORS.text },
  content: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  section: { marginBottom: 16, backgroundColor: COLORS.card, borderRadius: 8, padding: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  clientSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.background, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border },
  clientSelectorText: { color: COLORS.text, fontWeight: '500' },
  chevron: { color: COLORS.textSecondary },
  barcodeRow: { flexDirection: 'row', gap: 8 },
  barcodeInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.background, color: COLORS.text },
  barcodeBtn: { width: 40, height: 40, borderRadius: 6, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  barcodeBtnText: { fontSize: 18 },
  scanBtn: { width: 40, height: 40, borderRadius: 6, backgroundColor: COLORS.info, justifyContent: 'center', alignItems: 'center' },
  scanBtnText: { fontSize: 18 },
  searchInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, backgroundColor: COLORS.background, color: COLORS.text },
  productScrollView: { maxHeight: 200 },
  productItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  productName: { fontWeight: '600', color: COLORS.text },
  productPrice: { fontSize: 12, color: COLORS.success },
  productBarcode: { fontSize: 10, color: COLORS.textSecondary },
  stockInfo: { fontSize: 11, color: COLORS.warning },
  addIcon: { fontSize: 16, marginLeft: 8 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 20 },
  cartTableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  cartHeaderCell: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  cartProductName: { flex: 1 },
  cartQuantityHeader: { width: 50, textAlign: 'center' },
  cartPriceHeader: { width: 60, textAlign: 'right' },
  cartTotalHeader: { width: 70, textAlign: 'right' },
  cartList: { maxHeight: 200 },
  cartTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cartTableCell: { fontSize: 12, color: COLORS.text },
  cartQuantityCell: { width: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  qtyBtnSmall: { width: 24, height: 24, borderRadius: 4, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  cartQtyText: { fontWeight: '600', color: COLORS.text },
  cartPriceCell: { width: 60, textAlign: 'right' },
  cartTotalCell: { width: 70, textAlign: 'right', fontWeight: '600' },
  priceTouchable: { flex: 1 },
  emptyCart: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 20 },
  optionsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  optionBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: COLORS.border, alignItems: 'center' },
  optionBtnActive: { backgroundColor: COLORS.primary },
  optionBtnText: { color: COLORS.textSecondary, fontWeight: '500' },
  paymentRow: { flexDirection: 'row', gap: 6 },
  paymentOption: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6, backgroundColor: COLORS.border },
  paymentOptionActive: { backgroundColor: COLORS.primary },
  paymentIcon: { fontSize: 20, marginBottom: 4 },
  paymentLabel: { fontSize: 10, color: COLORS.textSecondary },
  paymentLabelActive: { color: '#fff' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, color: COLORS.text },
  totalValue: { fontWeight: '600', color: COLORS.text },
  grandTotal: { borderTopWidth: 2, borderTopColor: COLORS.primary, paddingTopVertical: 12, paddingTopVertical: 8, marginTop: 4 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { color: COLORS.text, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  miniModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  miniModalContent: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, width: '100%', maxHeight: '80%' },
  miniModalTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  clientSearchInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, backgroundColor: COLORS.background, color: COLORS.text },
  addClientBtn: { paddingVertical: 8, borderRadius: 6, backgroundColor: COLORS.success, alignItems: 'center', marginBottom: 12 },
  addClientBtnText: { color: '#fff', fontWeight: '600' },
  clientsListView: { maxHeight: 300, marginBottom: 12 },
  clientOption: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  clientOptionText: { color: COLORS.text, fontWeight: '500' },
  miniModalClose: { paddingVertical: 8, borderRadius: 6, backgroundColor: COLORS.border, alignItems: 'center' },
  miniModalCloseText: { color: COLORS.text, fontWeight: '600' },
  productDetailPrice: { fontSize: 18, fontWeight: 'bold', color: COLORS.success, marginBottom: 16 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  quantityInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.background, color: COLORS.text },
  miniModalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  miniModalCancel: { flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: COLORS.border, alignItems: 'center' },
  miniModalCancelText: { color: COLORS.text, fontWeight: '600' },
  miniModalSave: { flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: COLORS.primary, alignItems: 'center' },
  miniModalSaveText: { color: '#fff', fontWeight: '600' },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  closeScannerBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, marginHorizontal: 12, marginBottom: 12, borderRadius: 8, alignItems: 'center' },
  closeScannerText: { color: '#fff', fontWeight: '600' },
});
