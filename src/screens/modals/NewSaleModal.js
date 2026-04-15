// src/screens/modals/NewSaleModal.js (version avec modal personnalisé pour le prix)
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
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    if (visible) {
      loadProducts();
      if (initialClient) setClient(initialClient);
      else setClient(null);
      setSearch('');
      setCart([]);
    }
  }, [visible, initialClient]);

  const loadProducts = async () => {
    const prods = await getLocalProducts();
    setProducts(prods);
  };

  const getExistingClients = async () => await getLocalClients();

  const ensureClient = async (clientName) => {
    if (!clientName?.trim()) return null;
    const clients = await getExistingClients();
    const existing = clients.find(c => c.name.toLowerCase() === clientName.trim().toLowerCase());
    if (existing) return existing;
    const newClient = {
      id: Date.now(),
      name: clientName.trim(),
      phone: '', email: '', address: '',
      created_at: new Date().toISOString(),
    };
    const updatedClients = [...clients, newClient];
    await saveClientsLocally(updatedClients);
    return newClient;
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
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

  // Ouvre le modal de modification du prix
  const openPriceModal = (item) => {
    setEditingItem(item);
    setNewPrice(String(item.price));
    setPriceModalVisible(true);
  };

  // Valide et applique la modification du prix
  const confirmPriceChange = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix valide');
      return;
    }
    setCart(cart.map(cartItem =>
      cartItem.id === editingItem.id
        ? { ...cartItem, price: price }
        : cartItem
    ));
    setPriceModalVisible(false);
    setEditingItem(null);
    setNewPrice('');
  };

  const totalHT = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const tva = totalHT * 0.19;
  const totalTTC = totalHT + tva;

  const saveSale = async () => {
    if (!client?.name?.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom du client');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins un produit');
      return;
    }
    setLoading(true);
    try {
      const finalClient = await ensureClient(client.name);
      if (!finalClient) throw new Error('Client invalide');
      const saleData = {
        client_id: finalClient.id,
        client_name: finalClient.name,
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
      <TouchableOpacity onPress={() => openPriceModal(item)} style={styles.priceTouchable}>
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
          {/* Section client (inchangée) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client</Text>
            <View style={styles.clientRow}>
              <TextInput
                style={styles.clientInput}
                placeholder="Nom du client"
                value={client?.name || ''}
                onChangeText={text => setClient({ id: null, name: text })}
              />
              <TouchableOpacity style={styles.selectClientBtn} onPress={async () => {
                const clients = await getLocalClients();
                if (!clients.length) return Alert.alert('Info', 'Aucun client');
                Alert.alert('Sélection', clients.map(c => c.name).join('\n'), [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Choisir',
                    onPress: () => Alert.prompt('Nom exact', '', [
                      { text: 'Annuler' },
                      {
                        text: 'OK',
                        onPress: input => {
                          const found = clients.find(c => c.name.toLowerCase() === input?.toLowerCase());
                          if (found) setClient({ id: found.id, name: found.name });
                          else Alert.alert('Erreur', 'Non trouvé');
                        }
                      }
                    ])
                  }
                ]);
              }}>
                <Text style={styles.selectClientBtnText}>📋</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section produits disponibles */}
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
                <TouchableOpacity key={product.id} style={styles.productItem} onPress={() => addToCart(product)}>
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

          {/* Section panier */}
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
                <FlatList
                  data={cart}
                  keyExtractor={item => item.id.toString()}
                  renderItem={renderCartItem}
                  scrollEnabled={true}
                  style={styles.cartList}
                />
              </>
            )}
          </View>

          {/* Récapitulatif */}
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

        {/* Modal pour la modification du prix */}
        <Modal
          visible={priceModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPriceModalVisible(false)}
        >
          <View style={styles.priceModalOverlay}>
            <View style={styles.priceModalContent}>
              <Text style={styles.priceModalTitle}>Modifier le prix unitaire</Text>
              <TextInput
                style={styles.priceInput}
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="numeric"
                placeholder="Prix en DA"
                autoFocus={true}
              />
              <View style={styles.priceModalButtons}>
                <TouchableOpacity onPress={() => setPriceModalVisible(false)} style={styles.priceModalCancel}>
                  <Text style={styles.priceModalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmPriceChange} style={styles.priceModalConfirm}>
                  <Text style={styles.priceModalConfirmText}>Modifier</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
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
  clientRow: { flexDirection: 'row', gap: 8 },
  clientInput: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  selectClientBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  selectClientBtnText: { color: COLORS.primary, fontWeight: '500', fontSize: 16 },
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
  cartList: { maxHeight: 250 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  grandTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  footer: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#eee' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '500' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: COLORS.primary },
  saveBtnText: { color: '#fff', fontWeight: '500' },
  // Styles pour le modal de prix
  priceModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  priceModalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '80%', alignItems: 'center' },
  priceModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: COLORS.text },
  priceInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, width: '100%', fontSize: 16, marginBottom: 20 },
  priceModalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  priceModalCancel: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#eee', alignItems: 'center' },
  priceModalCancelText: { color: COLORS.textSecondary, fontWeight: '500' },
  priceModalConfirm: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  priceModalConfirmText: { color: '#fff', fontWeight: '500' },
});