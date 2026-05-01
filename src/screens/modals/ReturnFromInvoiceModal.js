import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { COLORS, formatDA } from '../../services/theme';
import { calculateSaleTotals, savePreparedSale } from '../../services/salesService';

export default function ReturnFromInvoiceModal({ visible, onClose, onSaved, sale }) {
  const [returnItems, setReturnItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && sale && sale.items) {
      setReturnItems(
        sale.items.map(item => ({
          ...item,
          maxQuantity: item.quantity,
          returnQuantity: 0
        }))
      );
    }
  }, [visible, sale]);

  const updateQuantity = (id, delta) => {
    setReturnItems(items => items.map(item => {
      if (item.id === id || item.product_id === id) {
        let newQty = item.returnQuantity + delta;
        if (newQty < 0) newQty = 0;
        if (newQty > item.maxQuantity) {
          Alert.alert('Erreur', `Vous ne pouvez pas retourner plus de ${item.maxQuantity} exemplaire(s).`);
          newQty = item.maxQuantity;
        }
        return { ...item, returnQuantity: newQty };
      }
      return item;
    }));
  };

  const getCart = () => {
    return returnItems
      .filter(item => item.returnQuantity > 0)
      .map(item => ({
        id: item.product_id || item.id,
        barcode: item.barcode,
        name: item.name,
        quantity: item.returnQuantity,
        price: item.unit_price,
      }));
  };

  const cart = getCart();
  const { totalTTC } = calculateSaleTotals(cart, sale ? sale.tva_applied : false);

  const saveReturn = async () => {
    if (cart.length === 0) {
      Alert.alert('Erreur', 'Sélectionnez au moins un article à retourner.');
      return;
    }

    setLoading(true);
    try {
      const client = {
        id: sale.client_id,
        name: sale.client_name,
      };

      await savePreparedSale({
        client,
        cart,
        isCredit: false,
        paymentMethod: sale.payment_method || 'cash',
        includeTVA: sale.tva_applied,
        isReturn: true, 
      });

      Alert.alert('Succès', 'Le retour a été enregistré avec succès.');
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!sale) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Effectuer un retour</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.closeBtnText}>X</Text></TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Facture originale : <Text style={{fontWeight: 'bold'}}>{sale.invoice}</Text></Text>
          <Text style={styles.infoText}>Client : {sale.client_name}</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Articles à retourner</Text>
          
          <View style={styles.cartTableHeader}>
            <Text style={[styles.cartHeaderCell, styles.cartProductName]}>Produit</Text>
            <Text style={[styles.cartHeaderCell, styles.cartQuantityHeader]}>Qté Retour</Text>
            <Text style={[styles.cartHeaderCell, styles.cartPriceHeader]}>Remboursement</Text>
          </View>

          {returnItems.map((item, index) => (
            <View key={index} style={styles.cartTableRow}>
              <View style={styles.cartProductName}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMaxQty}>Max: {item.maxQuantity}</Text>
              </View>
              
              <View style={styles.cartQuantityCell}>
                <TouchableOpacity onPress={() => updateQuantity(item.id || item.product_id, -1)} style={styles.qtyBtnSmall}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.cartQtyText}>{item.returnQuantity}</Text>
                <TouchableOpacity onPress={() => updateQuantity(item.id || item.product_id, 1)} style={styles.qtyBtnSmall}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.cartTableCell, styles.cartTotalCell]}>
                {formatDA(item.unit_price * item.returnQuantity)}
              </Text>
            </View>
          ))}

          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Total à rembourser</Text>
            <Text style={styles.summaryTotal}>{formatDA(totalTTC)}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelBtnText}>Annuler</Text></TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={saveReturn} disabled={loading || cart.length === 0}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Valider le retour</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.danger },
  closeBtnText: { fontSize: 18, color: COLORS.textSecondary, padding: 8 },
  infoBox: { backgroundColor: '#FFEBEE', padding: 16, borderBottomWidth: 1, borderBottomColor: '#FFCDD2' },
  infoText: { fontSize: 14, color: '#C62828', marginBottom: 4 },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16, color: COLORS.text },
  cartTableHeader: { flexDirection: 'row', backgroundColor: '#E0E0E0', padding: 10, borderRadius: 8, marginBottom: 8 },
  cartHeaderCell: { fontWeight: 'bold', color: COLORS.text, fontSize: 12 },
  cartProductName: { flex: 3 },
  cartQuantityHeader: { flex: 2, textAlign: 'center' },
  cartPriceHeader: { flex: 2, textAlign: 'right' },
  cartTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 8, marginBottom: 4 },
  cartTableCell: { fontSize: 12, color: COLORS.text },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemMaxQty: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cartQuantityCell: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  qtyBtnSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  cartQtyText: { fontSize: 14, fontWeight: '500', minWidth: 20, textAlign: 'center' },
  cartTotalCell: { flex: 2, textAlign: 'right', fontWeight: 'bold', color: COLORS.danger, fontSize: 14 },
  summarySection: { marginTop: 24, padding: 16, backgroundColor: '#fff', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FFCDD2' },
  summaryTitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  summaryTotal: { fontSize: 24, fontWeight: 'bold', color: COLORS.danger },
  footer: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#eee' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '500', fontSize: 16 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: COLORS.danger },
  saveBtnText: { color: '#fff', fontWeight: '500', fontSize: 16 },
});
