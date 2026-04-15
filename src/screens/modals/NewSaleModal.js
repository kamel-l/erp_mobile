// src/screens/modals/NewSaleModal.js
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
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

  useEffect(() => {
    if (visible) {
      loadProducts();
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

  // Récupérer la liste des clients existants (pour vérifier les doublons)
  const getExistingClients = async () => {
    return await getLocalClients();
  };

  // Créer un nouveau client si le nom n'existe pas
  const ensureClient = async (clientName) => {
    if (!clientName || clientName.trim() === '') return null;

    const clients = await getExistingClients();
    const existing = clients.find(c => c.name.toLowerCase() === clientName.trim().toLowerCase());
    if (existing) {
      return existing; // Client déjà existant
    }

    // Créer un nouveau client
    const newClient = {
      id: Date.now(),
      name: clientName.trim(),
      phone: '',
      email: '',
      address: '',
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

  const totalHT = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const tva = totalHT * 0.19;
  const totalTTC = totalHT + tva;

  const saveSale = async () => {
    if (!client || !client.name.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom du client');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins un produit');
      return;
    }
    setLoading(true);
    try {
      // 1. S'assurer que le client existe en base (création si nouveau)
      const finalClient = await ensureClient(client.name);
      if (!finalClient) {
        Alert.alert('Erreur', 'Impossible de créer ou trouver le client');
        return;
      }

      // 2. Enregistrer la vente avec l'ID du client
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

      Alert.alert('Succès', 'Vente enregistrée localement');
      onSaved(); // Recharge la liste des ventes
      onClose(); // Ferme le modal
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Nouvelle vente</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client</Text>
            <View style={styles.clientRow}>
              <TextInput
                style={styles.clientInput}
                placeholder="Nom du client (sera ajouté s'il est nouveau)"
                value={client?.name || ''}
                onChangeText={text => setClient({ id: null, name: text })}
              />
              {/* Bouton pour sélectionner un client existant (optionnel) */}
              <TouchableOpacity
                style={styles.selectClientBtn}
                onPress={async () => {
                  const clients = await getLocalClients();
                  if (clients.length === 0) {
                    Alert.alert('Info', 'Aucun client existant. Ajoutez-en un d\'abord.');
                    return;
                  }
                  const names = clients.map(c => c.name).join('\n');
                  Alert.alert(
                    'Sélectionner un client',
                    `Clients existants :\n${names}`,
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Choisir',
                        onPress: () => {
                          // Pour simplifier, on peut demander de taper le nom exact
                          Alert.prompt(
                            'Nom du client',
                            'Entrez le nom exact du client existant',
                            [
                              { text: 'Annuler', style: 'cancel' },
                              {
                                text: 'OK',
                                onPress: (inputName) => {
                                  const found = clients.find(c => c.name.toLowerCase() === inputName?.toLowerCase());
                                  if (found) {
                                    setClient({ id: found.id, name: found.name });
                                  } else {
                                    Alert.alert('Erreur', 'Client non trouvé');
                                  }
                                }
                              }
                            ]
                          );
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.selectClientBtnText}>📋</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produits</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par nom ou code-barres"
              value={search}
              onChangeText={setSearch}
            />
            {filteredProducts.map(product => (
              <TouchableOpacity key={product.id} style={styles.productItem} onPress={() => addToCart(product)}>
                <View>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productPrice}>{formatDA(Number(product.price))}</Text>
                </View>
                <Text style={styles.addIcon}>+</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Panier</Text>
            {cart.length === 0 ? (
              <Text style={styles.emptyCart}>Aucun produit</Text>
            ) : (
              cart.map(item => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartName}>{item.name}</Text>
                    <Text style={styles.cartPrice}>{formatDA(Number(item.price))}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemTotal}>{formatDA(Number(item.price) * item.quantity)}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            <View style={styles.totalRow}>
              <Text>Total HT</Text>
              <Text>{formatDA(totalHT)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>TVA (19%)</Text>
              <Text>{formatDA(tva)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={{ fontWeight: 'bold' }}>Total TTC</Text>
              <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{formatDA(totalTTC)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={saveSale} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 18, color: COLORS.textSecondary },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.text },
  clientRow: { flexDirection: 'row', gap: 8 },
  clientInput: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  selectClientBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
  selectClientBtnText: { color: COLORS.primary, fontWeight: '500', fontSize: 16 },
  searchInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 10, marginBottom: 12, backgroundColor: '#fff' },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8, borderWidth: 0.5, borderColor: '#E0E0E0' },
  productName: { fontSize: 14, fontWeight: '500' },
  productPrice: { fontSize: 12, color: COLORS.textSecondary },
  addIcon: { fontSize: 20, color: COLORS.primary },
  cartItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8, borderWidth: 0.5, borderColor: '#E0E0E0' },
  cartName: { fontSize: 14, fontWeight: '500' },
  cartPrice: { fontSize: 12, color: COLORS.textSecondary },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  qtyText: { fontSize: 14, fontWeight: '500', minWidth: 24, textAlign: 'center' },
  itemTotal: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  emptyCart: { textAlign: 'center', color: COLORS.textSecondary, padding: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  grandTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  footer: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#eee' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '500' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: COLORS.primary },
  saveBtnText: { color: '#fff', fontWeight: '500' },
});