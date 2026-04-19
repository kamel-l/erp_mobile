// src/screens/SalesScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, SectionTitle, Divider, RowBetween, ProgressBar,
} from '../components/UIComponents';
import NewSaleModal from './modals/NewSaleModal';
import { getLocalSales } from '../database/database';

export default function SalesScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [newSaleVisible, setNewSaleVisible] = useState(false);

  const loadSales = useCallback(async () => {
    try {
      const cachedSales = await getLocalSales();
      setSales(cachedSales || []);
    } catch (error) {
      console.error('Erreur chargement ventes:', error);
      setSales([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSales(); }, [loadSales]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSales();
    setRefreshing(false);
  };

  const totalCA = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const paidCount = sales.filter(s => s.status === 'paid').length;
  const pendingCount = sales.filter(s => s.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Bouton pour voir toutes les factures */}
        <TouchableOpacity
          style={styles.allInvoicesBtn}
          onPress={() => navigation.navigate('Invoices')}
        >
          <Text style={styles.allInvoicesBtnText}>📄 Voir toutes les factures</Text>
        </TouchableOpacity>

        <SectionTitle action="+ Nouvelle vente" onAction={() => setNewSaleVisible(true)}>
          Nouvelle vente
        </SectionTitle>

        <Card>
          <RowBetween><Text style={styles.statLabel}>CA total</Text><Text style={[styles.statValue, { color: COLORS.primary }]}>{formatDA(totalCA)}</Text></RowBetween>
          <Divider />
          <RowBetween><Text style={styles.statLabel}>Factures émises</Text><Text style={styles.statValue}>{sales.length}</Text></RowBetween>
          <Divider />
          <RowBetween><Text style={styles.statLabel}>Payées</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{paidCount}</Text></RowBetween>
          <Divider />
          <RowBetween><Text style={styles.statLabel}>En attente</Text><Text style={[styles.statValue, { color: COLORS.warning }]}>{pendingCount}</Text></RowBetween>
          <Divider />
          <RowBetween style={{ marginBottom: 4 }}><Text style={styles.statLabel}>Taux recouvrement</Text><Text style={[styles.statValue, { color: COLORS.success }]}>{sales.length ? Math.round((paidCount / sales.length) * 100) : 0}%</Text></RowBetween>
          <ProgressBar value={sales.length ? (paidCount / sales.length) * 100 : 0} max={100} color={COLORS.success} />
        </Card>

        <TouchableOpacity style={styles.fabBtn} onPress={() => setNewSaleVisible(true)}>
          <Text style={styles.fabTxt}>+ Nouvelle vente</Text>
        </TouchableOpacity>
      </ScrollView>

      <NewSaleModal
        visible={newSaleVisible}
        onClose={() => setNewSaleVisible(false)}
        onSaved={() => {
          loadSales();
          setNewSaleVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 24 },
  allInvoicesBtn: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  allInvoicesBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statLabel: { fontSize: 13, color: COLORS.text },
  statValue: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  fabBtn: { backgroundColor: COLORS.primary, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  fabTxt: { color: '#fff', fontSize: 15, fontWeight: '500' },
});