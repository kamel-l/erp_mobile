// src/screens/modals/NewSaleModal.js
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, FlatList,
  ScrollView,
} from 'react-native';
import { COLORS, formatDA } from '../../services/theme';
import {
  getLocalProducts,
  saveSaleLocally,
  getLocalClients,
  saveClientsLocally,
} from '../../database/database';

export default function NewSaleModal({ visible, onClose, onSaved, initialClient }) {
  const [client, setClient] = useState(null);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    if (visible) {
      loadProducts();
      loadClients();
      if (initialClient) {
        setClient(initialClient);
      } else {
        setClient(null);
      }
      setSearch('');
      setCart([]);
    }
  }, [visible, initialClient]);

  const loadProducts = async () => {
    const prods = await getLocalProducts();
    setProducts(prods);
  };

  const loadClients = async () => {
    const clients = await getLocalClients();
    setClientsList(clients);
  };

  const selectClient = (selected) => {
    setClient(selected);
    setClientModalVisible(false);
  };

  const addNewClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un nom');
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
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  const openProductModal = (product) => {
    const existing = cart.find(item => item.id === product.id);
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

  const addOrUpdateCart = () => {
    if (!selectedProduct) return;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erreur', 'La quantité doit être un nombre positif');
      return;
    }
    const price = parseFloat(unitPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Erreur', 'Le prix doit être un nombre positif');
      return;
    }
    const existingIndex = cart.findIndex(item => item.id === selectedProduct.id);
    if (existingIndex !== -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: qty,
        price: price,
      };
      setCart(updatedCart);
    } else {
      setCart([...cart, { ...selectedProduct, quantity: qty, price: price }]);
    }
    setProductModalVisible(false);
    setSelectedProduct(null);
    setQuantity('1');
    setUnitPrice('');
  };

  const updateQuantity = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const editPrice = (item) => {
    Alert.prompt(
      'Modifier le prix unitaire',
      `Prix actuel : ${formatDA(Number(item.price))}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Modifier',
          onPress: (newPrice) => {
            const price = parseFloat(newPrice);
            if (isNaN(price) || price <= 0) {
              Alert.alert('Erreur', 'Veuillez entrer un prix valide');
              return;
            }
            setCart(cart.map(cartItem =>
              cartItem.id === item.id ? { ...cartItem, price: price } : cartItem
            ));
          }
        }
      ],
      'plain-text',
      String(item.price)
    );
  };

  const totalHT = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const tva = totalHT * 0.19;
  const totalTTC = totalHT + tva;

  const saveSale = async () => {
    if (!client) {
      Alert.alert('Erreur', 'Veuillez sélectionner un client');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins un produit');
      return;
    }
    setLoading(true);
    try {
      const saleData = {
        client_id: client.id,
        client_name: client.name,
        date: new Date().toLocaleDateString(),
        items: cart.length,
        total: totalTTC,
        status: 'pending',
        invoice: `FAC-${Date.now()}`,
        sale_date: new Date().toISOString(),
        payment_status: 'pending',
      };
      const itemsData = cart.map(item => ({
        product_id: item.id,
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        unit_price: Number(item.price),
        total: Number(item.price) * item.quantity,
      }));
      await saveSaleLocally(saleData, itemsData);
      Alert.alert('Succès', 'Vente enregistrée');
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Rendu d'un élément du panier (utilisé dans ScrollView)
  const renderCartItem = (item) => (
    <View key={item.id} style={styles.cartTableRow}>
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
          {/* Client */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client</Text>
            <TouchableOpacity style={styles.clientSelector} onPress={() => setClientModalVisible(true)}>
              <Text style={styles.clientSelectorText}>
                {client ? client.name : 'Sélectionner un client'}
              </Text>
              <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Produits disponibles (ScrollView) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produits disponibles</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher"
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView style={styles.productScrollView} nestedScrollEnabled={true}>
              {filteredProducts.map(product => (
                <TouchableOpacity key={product.id} style={styles.productItem} onPress={() => openProductModal(product)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>{formatDA(Number(product.price))}</Text>
                  </View>
                  <Text style={styles.addIcon}>+</Text>
                </TouchableOpacity>
              ))}
              {filteredProducts.length === 0 && (
                <Text style={styles.emptyText}>Aucun produit trouvé</Text>
              )}
            </ScrollView>
          </View>

          {/* Panier (ScrollView au lieu de FlatList pour éviter l'avertissement) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Panier</Text>
            {cart.length === 0 ? (
              <Text style={styles.emptyCart}>Aucun produit ajouté</Text>
            ) : (
              <>
                <View style={styles.cartTableHeader}>
                  <Text style={[styles.cartHeaderCell, styles.cartProductName]}>Produit</Text>
                  <Text style={[styles.cartHeaderCell, styles.cartQuantityHeader]}>Qté</Text>
                  <Text style={[styles.cartHeaderCell, styles.cartPriceHeader]}>Prix U.</Text>
                  <Text style={[styles.cartHeaderCell, styles.cartTotalHeader]}>Total</Text>
                </View>
                <ScrollView style={styles.cartScrollView} nestedScrollEnabled={true}>
                  {cart.map(item => renderCartItem(item))}
                </ScrollView>
              </>
            )}
          </View>

          {/* Totaux */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            <View style={styles.totalRow}><Text>Total HT</Text><Text>{formatDA(totalHT)}</Text></View>
            <View style={styles.totalRow}><Text>TVA (19%)</Text><Text>{formatDA(tva)}</Text></View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={{ fontWeight: 'bold' }}>Total TTC</Text>
              <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{formatDA(totalTTC)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelBtnText}>Annuler</Text></TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={saveSale} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal client (inchangé) */}
      <Modal visible={clientModalVisible} animationType="slide" transparent onRequestClose={() => setClientModalVisible(false)}>
        <View style={styles.clientModalOverlay}>
          <View style={styles.clientModalContent}>
            <Text style={styles.clientModalTitle}>Choisir un client</Text>
            <FlatList
              data={clientsList}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.clientItem} onPress={() => selectClient(item)}>
                  <Text style={styles.clientItemName}>{item.name}</Text>
                  {item.phone ? <Text style={styles.clientItemPhone}>{item.phone}</Text> : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucun client existant</Text>}
            />
            <View style={styles.addClientSection}>
              <TextInput
                style={styles.newClientInput}
                placeholder="Nouveau client (nom)"
                value={newClientName}
                onChangeText={setNewClientName}
              />
              <TouchableOpacity style={styles.addClientBtn} onPress={addNewClient}>
                <Text style={styles.addClientBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeClientModal} onPress={() => setClientModalVisible(false)}>
              <Text style={styles.closeClientModalText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal produit */}
      <Modal visible={productModalVisible} animationType="fade" transparent onRequestClose={() => setProductModalVisible(false)}>
        <View style={styles.productModalOverlay}>
          <View style={styles.productModalContent}>
            <Text style={styles.productModalTitle}>Ajouter au panier</Text>
            <Text style={styles.productNameModal}>{selectedProduct?.name}</Text>
            <View style={styles.productModalField}>
              <Text style={styles.productModalLabel}>Quantité :</Text>
              <TextInput
                style={styles.productModalInput}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={styles.productModalField}>
              <Text style={styles.productModalLabel}>Prix unitaire (DA) :</Text>
              <TextInput
                style={styles.productModalInput}
                keyboardType="numeric"
                value={unitPrice}
                onChangeText={setUnitPrice}
              />
            </View>
            <View style={styles.productModalButtons}>
              <TouchableOpacity style={styles.productModalCancel} onPress={() => setProductModalVisible(false)}>
                <Text style={styles.productModalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.productModalConfirm} onPress={addOrUpdateCart}>
                <Text style={styles.productModalConfirmText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  closeBtnText: { fontSize: 18, color: COLORS.textSecondary, padding: 8 },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.text },
  clientSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  clientSelectorText: { fontSize: 14, color: COLORS.text },
  chevron: { fontSize: 14, color: COLORS.textSecondary },
  searchInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, marginBottom: 12, backgroundColor: '#fff' },
  productScrollView: { maxHeight: 200, backgroundColor: '#fff', borderRadius: 8, borderWidth: 0.5, borderColor: '#E0E0E0' },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  productName: { fontSize: 14, fontWeight: '500' },
  productPrice: { fontSize: 12, color: COLORS.textSecondary },
  addIcon: { fontSize: 20, color: COLORS.primary, marginLeft: 8 },
  emptyText: { textAlign: 'center', padding: 20, color: COLORS.textSecondary },
  emptyCart: { textAlign: 'center', color: COLORS.textSecondary, padding: 20 },
  cartTableHeader: { flexDirection: 'row', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 8, marginBottom: 8 },
  cartHeaderCell: { fontWeight: 'bold', color: COLORS.text, fontSize: 12 },
  cartProductName: { flex: 3 },
  cartQuantityHeader: { flex: 1.5, textAlign: 'center' },
  cartPriceHeader: { flex: 2, textAlign: 'right' },
  cartTotalHeader: { flex: 2, textAlign: 'right' },
  cartTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  cartTableCell: { fontSize: 12, color: COLORS.text },
  cartQuantityCell: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  qtyBtnSmall: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  cartQtyText: { fontSize: 12, fontWeight: '500', minWidth: 20, textAlign: 'center' },
  priceTouchable: { flex: 2, alignItems: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  cartPriceCell: { textAlign: 'right', paddingRight: 8 },
  cartTotalCell: { flex: 2, textAlign: 'right', fontWeight: '500', color: COLORS.primary },
  cartScrollView: { maxHeight: 250 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  grandTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  footer: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#eee' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '500' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: COLORS.primary },
  saveBtnText: { color: '#fff', fontWeight: '500' },
  clientModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  clientModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%', maxHeight: '80%' },
  clientModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: COLORS.primary, textAlign: 'center' },
  clientItem: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  clientItemName: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  clientItemPhone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  addClientSection: { flexDirection: 'row', marginTop: 16, gap: 8 },
  newClientInput: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, fontSize: 14 },
  addClientBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addClientBtnText: { color: '#fff', fontWeight: '500' },
  closeClientModal: { marginTop: 16, alignItems: 'center', padding: 12 },
  closeClientModalText: { color: COLORS.primary, fontWeight: '500' },
  productModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  productModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%' },
  productModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: COLORS.primary, textAlign: 'center' },
  productNameModal: { fontSize: 16, fontWeight: '500', color: COLORS.text, textAlign: 'center', marginBottom: 20 },
  productModalField: { marginBottom: 15 },
  productModalLabel: { fontSize: 14, fontWeight: '500', marginBottom: 5, color: COLORS.text },
  productModalInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'center' },
  productModalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  productModalCancel: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#eee' },
  productModalCancelText: { color: COLORS.textSecondary, fontWeight: '500' },
  productModalConfirm: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: COLORS.primary },
  productModalConfirmText: { color: '#fff', fontWeight: '500' },
});