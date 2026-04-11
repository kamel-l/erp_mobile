// src/screens/modals/NewSaleModal.js
// Créer une nouvelle vente/facture directement depuis le téléphone

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { COLORS, formatDA } from '../../services/theme';
import { MOCK_DATA, salesAPI, stockAPI } from '../../services/api';
import { Avatar, Badge, Divider, RowBetween } from '../../components/UIComponents';

const AVATAR_COLORS = [
  { bg: '#E3F2FD', text: '#0D47A1' }, { bg: '#FFF3E0', text: '#E65100' },
  { bg: '#E8F5E9', text: '#1B5E20' }, { bg: '#F3E5F5', text: '#4A148C' },
];

const MOCK_PRODUCTS = [
  { id: 1, name: 'Ordinateur HP ProBook', selling_price: 75000, stock_quantity: 2 },
  { id: 2, name: 'Souris Logitech MX', selling_price: 1500, stock_quantity: 8 },
  { id: 3, name: 'Écran Samsung 24"', selling_price: 25000, stock_quantity: 3 },
  { id: 4, name: 'Clavier HP Slim', selling_price: 2500, stock_quantity: 35 },
  { id: 5, name: 'Bureau Professionnel', selling_price: 35000, stock_quantity: 12 },
  { id: 6, name: 'Chaise Ergonomique', selling_price: 15000, stock_quantity: 8 },
];

const MOCK_CLIENTS = [
  { id: 1, name: 'Ahmed H.', initials: 'AH' },
  { id: 2, name: 'Sara R.', initials: 'SR' },
  { id: 3, name: 'M. Benali', initials: 'MB' },
  { id: 4, name: 'Karim T.', initials: 'KT' },
];

export default function NewSaleModal({ visible, onClose, onSaved }) {
  const [step, setStep] = useState(1); // 1: client, 2: produits, 3: recap
  const [selectedClient, setSelectedClient] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const VAT_RATE = 0.19;

  const subtotal = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const tax = subtotal * VAT_RATE;
  const total = subtotal + tax;

  const filteredProducts = MOCK_PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredClients = MOCK_CLIENTS.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const addToCart = (product) => {
    const existing = cartItems.find(i => i.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        Alert.alert('Stock insuffisant', `Stock disponible : ${product.stock_quantity}`);
        return;
      }
      setCartItems(prev => prev.map(i =>
        i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCartItems(prev => [...prev, {
        product_id: product.id,
        product_name: product.name,
        unit_price: product.selling_price,
        quantity: 1,
        max_qty: product.stock_quantity,
      }]);
    }
  };

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const updateQty = (productId, delta) => {
    setCartItems(prev => prev.map(i => {
      if (i.product_id !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return null;
      if (newQty > i.max_qty) {
        Alert.alert('Stock insuffisant');
        return i;
      }
      return { ...i, quantity: newQty };
    }).filter(Boolean));
  };

  const handleSave = async () => {
    if (!selectedClient) { Alert.alert('Client requis'); return; }
    if (cartItems.length === 0) { Alert.alert('Panier vide'); return; }
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 800)); // Simule l'API
      Alert.alert('✅ Vente enregistrée !', `Total : ${formatDA(total)}`);
      reset();
      onSaved?.();
      onClose();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vente.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedClient(null);
    setCartItems([]);
    setProductSearch('');
    setClientSearch('');
    setPaymentMethod('cash');
  };

  const PAYMENT_METHODS = [
    { key: 'cash', label: '💵 Espèces' },
    { key: 'card', label: '💳 Carte' },
    { key: 'check', label: '📝 Chèque' },
    { key: 'credit', label: '🔄 Crédit' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouvelle Vente</Text>
          <Text style={styles.headerStep}>{step}/3</Text>
        </View>

        {/* Step indicators */}
        <View style={styles.steps}>
          {[1, 2, 3].map(s => (
            <View key={s} style={styles.stepRow}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
              </View>
              {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
            </View>
          ))}
        </View>

        {/* STEP 1: Select Client */}
        {step === 1 && (
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.stepTitle}>Choisir un client</Text>
            <View style={styles.searchBar}>
              <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={clientSearch}
                onChangeText={setClientSearch}
                placeholder="Rechercher..."
                placeholderTextColor="#BDBDBD"
              />
            </View>
            {filteredClients.map((c, i) => {
              const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.clientRow, selectedClient?.id === c.id && styles.clientRowSelected]}
                  onPress={() => setSelectedClient(c)}
                  activeOpacity={0.7}
                >
                  <Avatar initials={c.initials} bg={av.bg} textColor={av.text} />
                  <Text style={styles.clientName}>{c.name}</Text>
                  {selectedClient?.id === c.id && <Text style={{ color: COLORS.primary, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* STEP 2: Add Products */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            {cartItems.length > 0 && (
              <View style={styles.cartBanner}>
                <Text style={styles.cartBannerTxt}>{cartItems.length} article(s) — {formatDA(subtotal)}</Text>
              </View>
            )}
            <View style={[styles.searchBar, { margin: 14, marginBottom: 0 }]}>
              <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Chercher un produit..."
                placeholderTextColor="#BDBDBD"
              />
            </View>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.stepTitle}>Ajouter des produits</Text>
              {filteredProducts.map(p => {
                const inCart = cartItems.find(i => i.product_id === p.id);
                return (
                  <View key={p.id} style={styles.productRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.name}</Text>
                      <Text style={styles.productPrice}>{formatDA(p.selling_price)} • Stock: {p.stock_quantity}</Text>
                    </View>
                    {inCart ? (
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(p.id, -1)}>
                          <Text style={styles.qtyBtnTxt}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyNum}>{inCart.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(p.id, 1)}>
                          <Text style={styles.qtyBtnTxt}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(p)}>
                        <Text style={styles.addBtnTxt}>+ Ajouter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* STEP 3: Recap & Payment */}
        {step === 3 && (
          <ScrollView style={styles.body}>
            <Text style={styles.stepTitle}>Récapitulatif</Text>

            <View style={styles.recapCard}>
              <RowBetween>
                <Text style={styles.recapLabel}>Client</Text>
                <Text style={styles.recapValue}>{selectedClient?.name}</Text>
              </RowBetween>
              <Divider />
              {cartItems.map((item, i) => (
                <View key={i}>
                  <RowBetween>
                    <Text style={[styles.recapLabel, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.product_name}</Text>
                    <Text style={styles.recapValue}>×{item.quantity} → {formatDA(item.unit_price * item.quantity)}</Text>
                  </RowBetween>
                  {i < cartItems.length - 1 && <Divider />}
                </View>
              ))}
            </View>

            <View style={styles.recapCard}>
              <RowBetween><Text style={styles.recapLabel}>Sous-total HT</Text><Text style={styles.recapValue}>{formatDA(subtotal)}</Text></RowBetween>
              <Divider />
              <RowBetween><Text style={styles.recapLabel}>TVA (19%)</Text><Text style={[styles.recapValue, { color: COLORS.warning }]}>{formatDA(tax)}</Text></RowBetween>
              <Divider />
              <RowBetween>
                <Text style={[styles.recapLabel, { fontWeight: '600', fontSize: 15 }]}>TOTAL TTC</Text>
                <Text style={[styles.recapValue, { color: COLORS.primary, fontSize: 16, fontWeight: '600' }]}>{formatDA(total)}</Text>
              </RowBetween>
            </View>

            <Text style={styles.stepTitle}>Mode de paiement</Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.paymentBtn, paymentMethod === m.key && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod(m.key)}
                >
                  <Text style={[styles.paymentBtnTxt, paymentMethod === m.key && styles.paymentBtnTxtActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Bottom Buttons */}
        <View style={styles.bottomBtns}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backBtnTxt}>← Retour</Text>
            </TouchableOpacity>
          )}
          {step < 3 ? (
            <TouchableOpacity
              style={[styles.nextBtn, (step === 1 && !selectedClient) || (step === 2 && cartItems.length === 0) ? styles.nextBtnDisabled : null]}
              onPress={() => {
                if (step === 1 && !selectedClient) { Alert.alert('Sélectionnez un client'); return; }
                if (step === 2 && cartItems.length === 0) { Alert.alert('Ajoutez au moins un produit'); return; }
                setStep(s => s + 1);
              }}
            >
              <Text style={styles.nextBtnTxt}>Suivant →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>💾 Enregistrer la vente</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: 50,
  },
  closeBtn: { padding: 4 },
  closeTxt: { color: '#fff', fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '500' },
  headerStep: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderColor: '#E0E0E0' },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepNum: { fontSize: 13, fontWeight: '500', color: '#9E9E9E' },
  stepNumActive: { color: '#fff' },
  stepLine: { width: 50, height: 2, backgroundColor: '#E0E0E0', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: COLORS.primary },
  body: { flex: 1, padding: 14 },
  stepTitle: { fontSize: 11, fontWeight: '500', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 0.5, borderColor: '#E0E0E0', marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#212121', padding: 0 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 0.5, borderColor: '#E0E0E0' },
  clientRowSelected: { borderColor: COLORS.primary, backgroundColor: '#E3F2FD' },
  clientName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#212121' },
  cartBanner: { backgroundColor: COLORS.primaryLight, padding: 10, paddingHorizontal: 14 },
  cartBannerTxt: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '500' },
  productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 0.5, borderColor: '#E0E0E0' },
  productName: { fontSize: 13, fontWeight: '500', color: '#212121' },
  productPrice: { fontSize: 12, color: '#757575', marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '500', lineHeight: 20 },
  qtyNum: { fontSize: 15, fontWeight: '500', minWidth: 20, textAlign: 'center', color: '#212121' },
  addBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  addBtnTxt: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '500' },
  recapCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#E0E0E0' },
  recapLabel: { fontSize: 13, color: '#212121' },
  recapValue: { fontSize: 13, fontWeight: '500', color: '#212121' },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  paymentBtn: { flex: 1, minWidth: '45%', paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E0E0E0' },
  paymentBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paymentBtnTxt: { fontSize: 13, fontWeight: '500', color: '#757575' },
  paymentBtnTxtActive: { color: '#fff' },
  bottomBtns: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: '#fff', borderTopWidth: 0.5, borderColor: '#E0E0E0' },
  backBtn: { flex: 1, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#E0E0E0' },
  backBtnTxt: { fontSize: 14, color: '#757575', fontWeight: '500' },
  nextBtn: { flex: 2, height: 46, backgroundColor: COLORS.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '500' },
  saveBtn: { flex: 2, height: 46, backgroundColor: COLORS.success, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
