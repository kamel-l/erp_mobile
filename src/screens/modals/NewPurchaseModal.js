// src/screens/modals/NewPurchaseModal.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, ScrollView, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { COLORS, formatDA } from '../../services/theme';
import { savePurchaseLocally } from '../../database/database';
import { getLocalProducts } from '../../database/database';

export default function NewPurchaseModal({ visible, onClose, onSaved }) {
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('pending'); // 'pending' | 'received'
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Recherche produit
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductList, setShowProductList] = useState(false);

  useEffect(() => {
    if (visible) {
      loadProducts();
      resetForm();
    }
  }, [visible]);

  const loadProducts = async () => {
    const products = await getLocalProducts();
    setAllProducts(products);
  };

  const resetForm = () => {
    setSupplierName('');
    setNotes('');
    setStatus('pending');
    setItems([]);
    setSearchQuery('');
    setFilteredProducts([]);
    setShowProductList(false);
  };

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (query.trim().length < 1) {
      setFilteredProducts([]);
      setShowProductList(false);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allProducts.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 8);
    setFilteredProducts(filtered);
    setShowProductList(true);
  }, [allProducts]);

  const addProductToList = (product) => {
    // Vérifier si déjà dans la liste
    const existing = items.findIndex(i => i.product_id === product.id);
    if (existing !== -1) {
      // Incrémenter quantité
      const updated = [...items];
      updated[existing].quantity += 1;
      updated[existing].total = updated[existing].quantity * updated[existing].unit_price;
      setItems(updated);
    } else {
      const unitPrice = product.price || 0;
      setItems(prev => [...prev, {
        product_id: product.id,
        barcode: product.barcode || null,
        name: product.name,
        quantity: 1,
        unit_price: unitPrice,
        total: unitPrice,
      }]);
    }
    setSearchQuery('');
    setShowProductList(false);
  };

  const addManualItem = () => {
    setItems(prev => [...prev, {
      product_id: null,
      barcode: null,
      name: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
      isManual: true, // Article hors catalogue
    }]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    // Recalculer le total de la ligne
    const qty = parseFloat(updated[index].quantity) || 0;
    const price = parseFloat(updated[index].unit_price) || 0;
    updated[index].total = qty * price;
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

  const handleSave = async () => {
    if (!supplierName.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le nom du fournisseur.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins un article.');
      return;
    }
    for (const item of items) {
      if (!item.name?.trim()) {
        Alert.alert('Erreur', 'Chaque article doit avoir un nom.');
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        Alert.alert('Erreur', `Quantité invalide pour "${item.name}".`);
        return;
      }
    }

    setSaving(true);
    try {
      await savePurchaseLocally(
        {
          supplier_name: supplierName.trim(),
          total: totalAmount,
          status,
          notes: notes.trim() || null,
        },
        items.map(i => ({
          ...i,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          total: parseFloat(i.total) || 0,
        }))
      );
      onSaved && onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer l'achat.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* En-tête */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🛒 Nouvel Achat</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Fournisseur */}
            <Text style={styles.label}>Fournisseur *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom du fournisseur"
              value={supplierName}
              onChangeText={setSupplierName}
              placeholderTextColor={COLORS.textSecondary}
            />

            {/* Statut */}
            <Text style={styles.label}>Statut de réception</Text>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[styles.statusBtn, status === 'pending' && styles.statusBtnActive]}
                onPress={() => setStatus('pending')}
              >
                <Text style={[styles.statusBtnText, status === 'pending' && styles.statusBtnTextActive]}>
                  ⏳ En attente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, status === 'received' && styles.statusBtnActiveGreen]}
                onPress={() => setStatus('received')}
              >
                <Text style={[styles.statusBtnText, status === 'received' && styles.statusBtnTextActive]}>
                  ✅ Reçu
                </Text>
              </TouchableOpacity>
            </View>
            {status === 'received' && (
              <View style={styles.stockHint}>
                <Text style={styles.stockHintText}>
                  ✅ Le stock sera mis à jour pour tous les articles reçus.{`\n`}
                  📦 Les articles hors catalogue seront automatiquement créés dans le stock.
                </Text>
              </View>
            )}

            {/* Recherche produit */}
            <Text style={styles.label}>Ajouter un produit</Text>
            <View style={styles.searchWrapper}>
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Rechercher par nom ou code-barres..."
                value={searchQuery}
                onChangeText={handleSearch}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            {/* Liste de suggestions */}
            {showProductList && filteredProducts.length > 0 && (
              <View style={styles.suggestionList}>
                {filteredProducts.map(product => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.suggestionItem}
                    onPress={() => addProductToList(product)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionName}>{product.name}</Text>
                      {product.barcode && (
                        <Text style={styles.suggestionBarcode}>Code: {product.barcode}</Text>
                      )}
                    </View>
                    <Text style={styles.suggestionPrice}>{formatDA(product.price)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Bouton ajout manuel */}
            <TouchableOpacity style={styles.addManualBtn} onPress={addManualItem}>
              <Text style={styles.addManualBtnText}>📦 Article hors catalogue</Text>
              <Text style={styles.addManualBtnSub}>Sera créé dans le stock à la réception</Text>
            </TouchableOpacity>

            {/* Liste des articles */}
            {items.length > 0 && (
              <>
                <Text style={styles.label}>Articles ({items.length})</Text>
                {items.map((item, index) => (
                  <View
                    key={index}
                    style={[
                      styles.itemCard,
                      item.isManual && styles.itemCardManual,
                    ]}
                  >
                    <View style={styles.itemCardHeader}>
                      <TextInput
                        style={styles.itemNameInput}
                        placeholder="Nom de l'article"
                        value={item.name}
                        onChangeText={v => updateItem(index, 'name', v)}
                        placeholderTextColor={COLORS.textSecondary}
                      />
                      <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeBtn}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Badge hors catalogue */}
                    {item.isManual && (
                      <View style={styles.manualBadge}>
                        <Text style={styles.manualBadgeText}>📦 Hors catalogue — sera créé dans le stock</Text>
                      </View>
                    )}
                    {!item.isManual && (
                      <View style={styles.catalogBadge}>
                        <Text style={styles.catalogBadgeText}>✔ Produit catalogue</Text>
                      </View>
                    )}

                    <View style={styles.itemCardRow}>
                      <View style={styles.itemField}>
                        <Text style={styles.fieldLabel}>Quantité</Text>
                        <TextInput
                          style={styles.fieldInput}
                          keyboardType="numeric"
                          value={String(item.quantity)}
                          onChangeText={v => updateItem(index, 'quantity', v)}
                          placeholderTextColor={COLORS.textSecondary}
                        />
                      </View>
                      <View style={styles.itemField}>
                        <Text style={styles.fieldLabel}>Prix unitaire (DA)</Text>
                        <TextInput
                          style={styles.fieldInput}
                          keyboardType="numeric"
                          value={String(item.unit_price)}
                          onChangeText={v => updateItem(index, 'unit_price', v)}
                          placeholderTextColor={COLORS.textSecondary}
                        />
                      </View>
                      <View style={styles.itemField}>
                        <Text style={styles.fieldLabel}>Sous-total</Text>
                        <Text style={styles.subTotal}>{formatDA(item.total)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Notes */}
            <Text style={styles.label}>Notes (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Remarques sur la commande..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholderTextColor={COLORS.textSecondary}
            />

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Achat</Text>
              <Text style={styles.totalValue}>{formatDA(totalAmount)}</Text>
            </View>

            {/* Bouton sauvegarder */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {status === 'received' ? '✅ Enregistrer & Mettre en stock' : '💾 Enregistrer le bon'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 22,
    color: COLORS.textSecondary,
  },
  body: {
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#FAFAFA',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statusBtnActive: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warningLight,
  },
  statusBtnActiveGreen: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successLight,
  },
  statusBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statusBtnTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  stockHint: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  stockHintText: {
    fontSize: 12,
    color: COLORS.primary,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#FAFAFA',
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  suggestionBarcode: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  suggestionPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  addManualBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addManualBtnText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addManualBtnSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  itemCardManual: {
    borderColor: '#B0BEC5',
    borderStyle: 'dashed',
    backgroundColor: '#F5F7FA',
  },
  manualBadge: {
    backgroundColor: '#E8F0FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  manualBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  catalogBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  catalogBadgeText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8EEF4',
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
  },
  removeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  removeBtnText: {
    fontSize: 18,
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  itemCardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  itemField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  subTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    paddingTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
