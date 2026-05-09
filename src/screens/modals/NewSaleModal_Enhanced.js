// src/screens/modals/NewSaleModal_Enhanced.js
/**
 * NewSaleModal amélioré avec:
 * - Validation Yup pour les ventes
 * - Logger pour tous les événements
 * - Toast pour feedback utilisateur
 * - Gestion d'erreurs robuste
 */

import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, FlatList,
  ScrollView,
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
import Toast from '../../components/Toast';

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
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isCredit, setIsCredit] = useState(false);
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
      setIsCredit(false);
      setIncludeTVA(true);
    }
  }, [visible, initialClient]);

  const loadProducts = async () => {
    try {
      logger.debug('Chargement des produits pour modal');
      const prods = await getLocalProducts();
      setProducts(prods || []);
      logger.info('Produits chargés', { count: prods?.length || 0 });
    } catch (error) {
      logger.error('Erreur chargement produits', error);
      Toast.error('Impossible de charger les produits');
    }
  };

  const loadClients = async () => {
    try {
      logger.debug('Chargement des clients pour modal');
      const clients = await getLocalClients();
      setClientsList(clients || []);
      logger.info('Clients chargés', { count: clients?.length || 0 });
    } catch (error) {
      logger.error('Erreur chargement clients', error);
      Toast.error('Impossible de charger les clients');
    }
  };

  const selectClient = (selected) => {
    logger.debug('Client sélectionné', { clientId: selected.id, name: selected.name });
    setClient(selected);
    setClientModalVisible(false);
    Toast.success(`Client: ${selected.name}`);
  };

  const addNewClient = async () => {
    try {
      if (!newClientName.trim()) {
        logger.warn('Tentative ajout client sans nom');
        Toast.error('Saisir un nom');
        return;
      }

      const clientName = newClientName.trim();
      logger.debug('Création nouveau client', { name: clientName });

      const newClient = {
        id: Date.now(),
        name: clientName,
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

      logger.info('Nouveau client créé', { id: newClient.id, name: clientName });
      Toast.success('Client créé ✓');
    } catch (error) {
      logger.error('Erreur création client', error);
      Toast.error('Impossible de créer le client');
    }
  };

  const filteredProducts = products.filter((p) => {
    const searchLower = search.toLowerCase();
    if (searchLower === '') return true;
    const nameFirst = p.name.charAt(0).toLowerCase();
    if (nameFirst === searchLower) return true;
    const barcodeFirst = p.barcode ? p.barcode.charAt(0).toLowerCase() : '';
    if (barcodeFirst === searchLower) return true;
    if (p.barcode && p.barcode.toLowerCase().includes(searchLower)) return true;
    return false;
  });

  const openProductModal = (product) => {
    logger.debug('Ouverture modal produit', { productId: product.id, name: product.name });
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      setQuantity(String(existing.quantity));
      setUnitPrice(String(existing.price));
    } else {
      setQuantity('1');
      setUnitPrice(String(product.price));
    }
    setSelectedProduct(product);
    setProductModalVisible(true);
  };

  const searchProductByBarcode = async (code) => {
    try {
      if (!code) {
        logger.debug('Recherche barcode vide');
        return;
      }

      let trimmedCode = code.trim();
      const quoteMatch = trimmedCode.match(/"([^"]+)"/);
      if (quoteMatch) {
        trimmedCode = quoteMatch[1].trim();
      } else {
        trimmedCode = trimmedCode.replace(/^[{]+|[\s}]+$/g, '').trim();
      }

      logger.debug('Recherche produit par code-barres', { barcode: trimmedCode });

      let product = await getProductByBarcode(trimmedCode);

      if (!product) {
        logger.debug('Recherche produit étendue', { barcode: trimmedCode });
        product = await findProductByAny(trimmedCode);
      }

      if (product) {
        logger.info('Produit trouvé', { id: product.id, name: product.name });
        openProductModal(product);
        setBarcode('');
        Toast.success(`Produit: ${product.name}`);
      } else {
        logger.warn('Produit non trouvé', { barcode: trimmedCode });
        Toast.error(`Code "${trimmedCode}" non trouvé`);
      }
    } catch (error) {
      logger.error('Erreur recherche produit', error);
      Toast.error('Erreur recherche produit');
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    logger.debug('Code-barres scanné', { data });
    setScannerVisible(false);
    searchProductByBarcode(data);
  };

  const openScanner = async () => {
    try {
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
    } catch (error) {
      logger.error('Erreur ouverture scanner', error);
      Toast.error('Erreur scanner');
    }
  };

  const addOrUpdateCart = () => {
    try {
      if (!selectedProduct) {
        logger.warn('Aucun produit sélectionné');
        Toast.error('Aucun produit');
        return;
      }

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        logger.warn('Quantité invalide', { quantity });
        Toast.error('Quantité invalide');
        return;
      }

      const price = parseFloat(unitPrice);
      if (isNaN(price) || price <= 0) {
        logger.warn('Prix invalide', { price: unitPrice });
        Toast.error('Prix invalide');
        return;
      }

      const stockDisponible = selectedProduct.stock_quantity || 0;
      if (qty > stockDisponible) {
        logger.warn('Stock insuffisant', { 
          requested: qty, 
          available: stockDisponible, 
          product: selectedProduct.name 
        });
        Toast.error(`Stock insuffisant (${stockDisponible})`);
        return;
      }

      logger.debug('Ajout/mise à jour panier', { 
        productId: selectedProduct.id, 
        name: selectedProduct.name,
        quantity: qty,
        price
      });

      const existingIndex = cart.findIndex((item) => item.id === selectedProduct.id);
      if (existingIndex !== -1) {
        const updatedCart = [...cart];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: qty,
          price,
        };
        setCart(updatedCart);
        logger.info('Produit panier mis à jour', { 
          product: selectedProduct.name,
          newQuantity: qty 
        });
      } else {
        setCart([...cart, { ...selectedProduct, quantity: qty, price }]);
        logger.info('Produit ajouté au panier', { 
          product: selectedProduct.name,
          quantity: qty 
        });
      }

      Toast.success('Panier mis à jour');
      setProductModalVisible(false);
      setSelectedProduct(null);
      setQuantity('1');
      setUnitPrice('');
    } catch (error) {
      logger.error('Erreur ajout panier', error);
      Toast.error('Erreur panier');
    }
  };

  const updateQuantity = (id, delta) => {
    try {
      logger.debug('Mise à jour quantité panier', { productId: id, delta });
      setCart(
        cart.map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) {
              logger.info('Suppression produit panier', { product: item.name });
              return null;
            }
            if (delta > 0 && newQty > (item.stock_quantity || 0)) {
              logger.warn('Stock insuffisant pour augmentation', { 
                product: item.name,
                available: item.stock_quantity 
              });
              Toast.error(`Stock limité à ${item.stock_quantity}`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        }).filter(Boolean)
      );
    } catch (error) {
      logger.error('Erreur mise à jour quantité', error);
      Toast.error('Erreur quantité');
    }
  };

  const editPrice = (item) => {
    logger.debug('Ouverture édition prix', { product: item.name, currentPrice: item.price });
    Alert.prompt(
      'Modifier le prix unitaire',
      `Prix actuel : ${formatDA(Number(item.price))}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Modifier',
          onPress: (newPrice) => {
            try {
              const price = parseFloat(newPrice);
              if (isNaN(price) || price <= 0) {
                logger.warn('Prix invalide saisi', { input: newPrice });
                Toast.error('Prix invalide');
                return;
              }
              logger.debug('Prix modifié', { product: item.name, newPrice: price });
              setCart(cart.map((cartItem) =>
                cartItem.id === item.id ? { ...cartItem, price } : cartItem
              ));
              logger.info('Prix produit modifié', { product: item.name });
              Toast.success('Prix mis à jour');
            } catch (error) {
              logger.error('Erreur modification prix', error);
              Toast.error('Erreur prix');
            }
          },
        },
      ],
      'plain-text',
      String(item.price)
    );
  };

  const { totalHT, tva, totalTTC } = calculateSaleTotals(cart, includeTVA);

  const saveSale = async () => {
    try {
      logger.debug('Tentative sauvegarde vente', { 
        cartItems: cart.length,
        client: client?.name,
        isCredit,
        paymentMethod 
      });

      const validationError = validateSaleDraft({ client, cart, isCredit, paymentMethod });
      if (validationError) {
        logger.warn('Erreur validation vente', { error: validationError });
        const title = validationError.includes('stock disponible') ? 'Stock insuffisant' : 'Erreur';
        Toast.error(validationError);
        return;
      }

      setLoading(true);
      await savePreparedSale({ client, cart, isCredit, paymentMethod, includeTVA });

      logger.info('Vente enregistrée', { 
        clientName: client?.name,
        totalTTC,
        items: cart.length 
      });

      Toast.success('Vente enregistrée ✓');
      onSaved();
      onClose();
    } catch (error) {
      logger.error('Erreur sauvegarde vente', error);
      Toast.error('Erreur sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartTableRow}>
      <Text style={[styles.cartTableCell, styles.cartProductName]} numberOfLines={1}>{item.name}</Text>
      <View style={styles.cartQuantityCell}>
        <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyBtnSmall}>
          <Text style={styles.qtyBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.cartQtyText}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyBtnSmall}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => editPrice(item)} style={styles.priceTouchable}>
        <Text style={[styles.cartTableCell, styles.cartPriceCell]}>{formatDA(Number(item.price))}</Text>
      </TouchableOpacity>
      <Text style={[styles.cartTableCell, styles.cartTotalCell]}>{formatDA(Number(item.price) * item.quantity)}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Nouvelle vente</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator>
          {/* Client section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Client</Text>
            <TouchableOpacity style={styles.clientSelector} onPress={() => setClientModalVisible(true)}>
              <Text style={styles.clientSelectorText}>
                {client ? client.name : 'Sélectionner un client'}
              </Text>
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
                    <Text style={styles.productPrice}>{formatDA(Number(product.price))}</Text>
                    {product.barcode && <Text style={styles.productBarcode}>📍 {product.barcode}</Text>}
                    <Text style={styles.stockInfo}>📦 {product.stock_quantity || 0}</Text>
                  </View>
                  <Text style={styles.addIcon}>➕</Text>
                </TouchableOpacity>
              ))}
              {filteredProducts.length === 0 && (
                <Text style={styles.emptyText}>Aucun produit</Text>
              )}
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
                  <Text style={[styles.cartHeaderCell, styles.cartTotalHeader]}>Total</Text>
                </View>
                <ScrollView style={styles.cartList} nestedScrollEnabled>
                  {cart.map((item) => (
                    <React.Fragment key={item.id.toString()}>
                      {renderCartItem({ item })}
                    </React.Fragment>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

          {/* Options section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Options</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionBtn, !isCredit && styles.optionBtnActive]}
                onPress={() => setIsCredit(false)}
              >
                <Text style={[styles.optionBtnText, !isCredit && { color: '#fff' }]}>💳 Immédiat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, isCredit && styles.optionBtnActive]}
                onPress={() => setIsCredit(true)}
              >
                <Text style={[styles.optionBtnText, isCredit && { color: '#fff' }]}>📅 Crédit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionBtn, includeTVA && styles.optionBtnActive]}
                onPress={() => setIncludeTVA(true)}
              >
                <Text style={[styles.optionBtnText, includeTVA && { color: '#fff' }]}>TVA incl.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, !includeTVA && styles.optionBtnActive]}
                onPress={() => setIncludeTVA(false)}
              >
                <Text style={[styles.optionBtnText, !includeTVA && { color: '#fff' }]}>HT</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment method section */}
          {!isCredit && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Paiement</Text>
              <View style={styles.paymentRow}>
                {[
                  { value: 'cash', label: 'Espèces', icon: '💰' },
                  { value: 'card', label: 'Carte', icon: '💳' },
                  { value: 'transfer', label: 'Virement', icon: '🏦' },
                  { value: 'check', label: 'Chèque', icon: '📝' },
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
          )}

          {/* Summary section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Récapitulatif</Text>
            <View style={styles.totalRow}>
              <Text>Total HT</Text>
              <Text style={styles.totalValue}>{formatDA(totalHT)}</Text>
            </View>
            {includeTVA && (
              <View style={styles.totalRow}>
                <Text>TVA (19%)</Text>
                <Text style={styles.totalValue}>{formatDA(tva)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={{ fontWeight: 'bold' }}>Total {includeTVA ? 'TTC' : 'HT'}</Text>
              <Text style={{ fontWeight: 'bold', color: COLORS.primary, fontSize: 16 }}>
                {formatDA(totalTTC)}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={saveSale} disabled={loading || cart.length === 0 || !client}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Enregistrer ({cart.length})</Text>
            )}
          </TouchableOpacity>
        </View>

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
                  <TouchableOpacity
                    key={c.id}
                    style={styles.clientOption}
                    onPress={() => selectClient(c)}
                  >
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
              <Text style={styles.productDetailPrice}>{formatDA(Number(selectedProduct?.price))}</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Quantité</Text>
                <TextInput
                  style={styles.quantityInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  placeholder="1"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Prix unitaire</Text>
                <TextInput
                  style={styles.quantityInput}
                  value={unitPrice}
                  onChangeText={setUnitPrice}
                  keyboardType="decimal-pad"
                  placeholder={String(selectedProduct?.price)}
                />
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
            <CameraView
              style={styles.camera}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr'] }}
            />
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
