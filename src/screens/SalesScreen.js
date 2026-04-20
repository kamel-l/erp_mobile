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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const generateInvoiceHTML = (sale) => {
  const date = new Date(sale.date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);


  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 8px; border: 1px solid #ddd; }
          .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .items-table th { background-color: #3498db; color: white; }
          .total-box { background-color: #f8f9fa; padding: 15px; border-radius: 8px; text-align: right; margin-top: 20px; }
          .total-box p { margin: 5px 0; font-size: 16px; }
          .total-box strong { font-size: 18px; color: #2c3e50; }
        </style>
      </head>
      <body>
        <h1>Facture ${sale.invoice}</h1>
        
        <table class="info-table">
          <tr>
            <td><strong>Client :</strong></td>
            <td>${sale.client}</td>
          </tr>
          <tr>
            <td><strong>Date :</strong></td>
            <td>${new Date(sale.date).toLocaleDateString('fr-FR')}</td>
          </tr>
          <tr>
            <td><strong>Statut :</strong></td>
            <td>${sale.status === 'paid' ? 'Payée' : 'En attente'}</td>
          </tr>
        </table>

        <table class="items-table">
          <thead>
            <tr>
              <th>Article</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items && sale.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatDA(item.price)}</td>
                <td>${formatDA(item.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-box">
          <p><strong>Total TTC :</strong> ${formatDA(sale.total)}</p>
        </div>

        <p style="margin-top: 30px; text-align: center; color: #7f8c8d;">
          Merci de votre confiance.
        </p>
      </body>
    </html>
  `;
};

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

  const exportSaleToPDF = async (sale) => {
    const date = new Date(sale.date);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const fileName = `${sale.client}_${day}${month}${year}.pdf`;

    const htmlContent = `
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #2c3e50;">Facture ${sale.invoice}</h1>
        <p><strong>Client :</strong> ${sale.client}</p>
        <p><strong>Date :</strong> ${new Date(sale.date).toLocaleDateString('fr-FR')}</p>
        <p><strong>Total TTC :</strong> ${formatDA(sale.total)}</p>
        <hr/>
        <h3>Articles</h3>
        <ul>
          ${sale.items && sale.items.map(item => `<li>${item.name} x ${item.quantity} = ${formatDA(item.total)}</li>`).join('')}
        </ul>
        <p><em>Merci de votre confiance.</em></p>
      </body>
    </html>
  `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    }
  };



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
        <TouchableOpacity style={styles.pdfBtn} onPress={() => exportSaleToPDF(selectedSale)}>
          <Text style={styles.pdfBtnText}>📄 Exporter en PDF</Text>
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