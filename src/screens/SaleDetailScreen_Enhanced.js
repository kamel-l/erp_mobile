// src/screens/SaleDetailScreen_Enhanced.js
// Phase 4.3 — Logger + Toast + validation statut

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, formatDA } from '../services/theme';
import { Card, Badge, RowBetween, Divider } from '../components/UIComponents';
import { getSaleWithItems, updateSaleStatus } from '../database/salesRepository';
import ReturnFromInvoiceModal from './modals/ReturnFromInvoiceModal';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

const STATUS_LABELS = {
  paid: 'Payée',
  cancelled: 'Annulée',
  pending: 'En attente',
  returned: 'Retournée',
};

const STATUS_ACTIONS = [
  { key: 'paid',      label: '✓ Marquer payée',       style: 'paidBtn' },
  { key: 'cancelled', label: '✗ Annuler',              style: 'cancelBtn' },
  { key: 'pending',   label: '↺ Remettre en attente',  style: 'pendingBtn' },
];

export default function SaleDetailScreen_Enhanced({ route, navigation }) {
  const { saleId } = route.params;
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);

  const loadSale = useCallback(async () => {
    logger.info('SaleDetailScreen: chargement facture', { saleId });
    try {
      const data = await getSaleWithItems(saleId);
      setSale(data);
      logger.debug('SaleDetailScreen: facture chargée', { invoice: data?.invoice });
    } catch (error) {
      logger.error('SaleDetailScreen: erreur chargement', error);
      Toast.error('Impossible de charger la facture');
      Alert.alert('Erreur', 'Impossible de charger la facture', [
        { text: 'Retour', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [saleId, navigation]);

  useEffect(() => { loadSale(); }, [loadSale]);

  // ── Changer statut ───────────────────────────────────────────
  const changeStatus = useCallback(async (newStatus) => {
    if (sale?.status === newStatus) {
      Toast.info(`La facture est déjà ${STATUS_LABELS[newStatus]?.toLowerCase()}`);
      return;
    }
    setChangingStatus(true);
    logger.info('SaleDetailScreen: changement statut', { saleId, from: sale?.status, to: newStatus });
    try {
      await updateSaleStatus(saleId, newStatus);
      setSale(prev => ({ ...prev, status: newStatus }));
      Toast.success(`Statut modifié : ${STATUS_LABELS[newStatus]}`);
      logger.info('SaleDetailScreen: statut modifié avec succès', { newStatus });
    } catch (error) {
      logger.error('SaleDetailScreen: erreur changement statut', error);
      Toast.error('Impossible de modifier le statut');
    } finally {
      setChangingStatus(false);
    }
  }, [saleId, sale]);

  const confirmChangeStatus = useCallback((newStatus) => {
    Alert.alert(
      'Confirmer',
      `Changer le statut en "${STATUS_LABELS[newStatus]}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => changeStatus(newStatus) },
      ]
    );
  }, [changeStatus]);

  // ── Export PDF ───────────────────────────────────────────────
  const exportToPDF = useCallback(async () => {
    if (!sale) return;
    setExporting(true);
    logger.info('SaleDetailScreen: export PDF', { invoice: sale.invoice });
    try {
      const totalHT = sale.total / 1.19;
      const tva = sale.total - totalHT;
      const statusColor = sale.status === 'paid' ? '#27ae60' : sale.status === 'cancelled' ? '#e74c3c' : '#f39c12';
      const itemsHtml = (sale.items || []).map(item => `
        <tr>
          <td style="border:1px solid #ddd;padding:8px">${item.name}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center">${item.quantity}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right">${formatDA(item.unit_price)}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right">${formatDA(item.total)}</td>
        </tr>`).join('');

      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>Facture ${sale.invoice}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:20px}
          .hdr{text-align:center;margin-bottom:30px}
          .hdr h1{color:#2c3e50;margin:0}.hdr p{color:#7f8c8d;margin:5px 0}
          table.items{width:100%;border-collapse:collapse;margin-bottom:20px}
          table.items th{background:#3498db;color:#fff;padding:10px;border:1px solid #ddd}
          .totals{text-align:right}.totals table{width:300px;margin-left:auto}
          .totals td{padding:5px}
          .status{display:inline-block;padding:4px 10px;border-radius:4px;color:#fff;background:${statusColor}}
          .footer{text-align:center;margin-top:40px;font-size:12px;color:#95a5a6}
        </style></head><body>
        <div class="hdr"><h1>DAR ELSSALEM</h1><p>Système ERP</p><h2>Facture ${sale.invoice}</h2></div>
        <table><tr><td><b>Client :</b></td><td>${sale.client_name}</td></tr>
          <tr><td><b>Date :</b></td><td>${new Date(sale.date || sale.sale_date).toLocaleDateString('fr-FR')}</td></tr>
          <tr><td><b>Statut :</b></td><td><span class="status">${STATUS_LABELS[sale.status] || sale.status}</span></td></tr>
        </table>
        <br/>
        <table class="items"><thead><tr><th>Produit</th><th>Qté</th><th>Prix unit.</th><th>Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody></table>
        <div class="totals"><table>
          <tr><td>Total HT :</td><td>${formatDA(totalHT)}</td></tr>
          <tr><td>TVA (19%) :</td><td>${formatDA(tva)}</td></tr>
          <tr style="font-weight:bold"><td>Total TTC :</td><td>${formatDA(sale.total)}</td></tr>
        </table></div>
        <div class="footer"><p>Merci de votre confiance.</p><p>DAR ELSSALEM ERP Mobile</p></div>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Facture ${sale.invoice}` });
        logger.info('SaleDetailScreen: PDF partagé', { invoice: sale.invoice });
        Toast.success('PDF généré avec succès');
      } else {
        Toast.warning('Le partage n\'est pas disponible sur cet appareil');
      }
    } catch (error) {
      logger.error('SaleDetailScreen: erreur export PDF', error);
      Toast.error('Impossible de générer le PDF');
    } finally {
      setExporting(false);
    }
  }, [sale]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.loading}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📄</Text>
        <Text style={styles.loadingText}>Facture introuvable</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalHT = Math.round((sale.total || 0) / 1.19);
  const tva = (sale.total || 0) - totalHT;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Carte en-tête facture */}
      <Card style={styles.card}>
        <RowBetween style={{ marginBottom: 12 }}>
          <Text style={styles.invoice}>{sale.invoice}</Text>
          <Badge status={sale.status || 'pending'} />
        </RowBetween>
        <RowBetween><Text style={styles.label}>Client</Text><Text style={styles.value}>{sale.client_name}</Text></RowBetween>
        <Divider />
        <RowBetween>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{sale.date || new Date(sale.sale_date).toLocaleDateString('fr-FR')}</Text>
        </RowBetween>
        <Divider />
        <RowBetween><Text style={styles.label}>Total HT</Text><Text style={styles.value}>{formatDA(totalHT)}</Text></RowBetween>
        <Divider />
        <RowBetween><Text style={styles.label}>TVA (19%)</Text><Text style={styles.value}>{formatDA(tva)}</Text></RowBetween>
        <Divider />
        <RowBetween>
          <Text style={styles.label}>Total TTC</Text>
          <Text style={[styles.value, { fontWeight: 'bold', color: COLORS.primary, fontSize: 16 }]}>{formatDA(sale.total || 0)}</Text>
        </RowBetween>
        {sale.payment_method && (
          <>
            <Divider />
            <RowBetween>
              <Text style={styles.label}>Paiement</Text>
              <Text style={styles.value}>{sale.payment_method}</Text>
            </RowBetween>
          </>
        )}
        {sale.notes ? (
          <>
            <Divider />
            <View>
              <Text style={[styles.label, { marginBottom: 4 }]}>Notes</Text>
              <Text style={styles.notes}>{sale.notes}</Text>
            </View>
          </>
        ) : null}
      </Card>

      {/* Articles */}
      <Card style={styles.card}>
        <Text style={styles.subtitle}>Articles ({(sale.items || []).length})</Text>
        {(sale.items || []).map((item, idx) => (
          <View key={idx}>
            <View style={styles.itemRow}>
              <View style={{ flex: 2 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>{item.quantity} × {formatDA(item.unit_price)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatDA(item.total)}</Text>
            </View>
            {idx < (sale.items.length - 1) && <Divider />}
          </View>
        ))}
      </Card>

      {/* Actions */}
      <Text style={styles.sectionLabel}>ACTIONS</Text>
      <View style={styles.buttonsGrid}>
        {/* Export PDF */}
        <TouchableOpacity
          style={[styles.btn, styles.exportBtn, exporting && styles.btnDisabled]}
          onPress={exportToPDF}
          disabled={exporting}
        >
          <Text style={styles.btnText}>{exporting ? '⏳ Génération...' : '📎 Exporter PDF'}</Text>
        </TouchableOpacity>

        {/* Retour (si pas déjà retourné) */}
        {sale.status !== 'returned' && (
          <TouchableOpacity
            style={[styles.btn, styles.returnBtn]}
            onPress={() => setReturnModalVisible(true)}
          >
            <Text style={styles.btnText}>↩️ Effectuer un retour</Text>
          </TouchableOpacity>
        )}

        {/* Boutons changement statut */}
        {changingStatus ? (
          <View style={[styles.btn, { backgroundColor: '#E0E0E0', justifyContent: 'center' }]}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : (
          STATUS_ACTIONS
            .filter(a => a.key !== sale.status)
            .map(a => (
              <TouchableOpacity
                key={a.key}
                style={[styles.btn, styles[a.style]]}
                onPress={() => confirmChangeStatus(a.key)}
              >
                <Text style={styles.btnText}>{a.label}</Text>
              </TouchableOpacity>
            ))
        )}
      </View>

      <ReturnFromInvoiceModal
        visible={returnModalVisible}
        onClose={() => setReturnModalVisible(false)}
        sale={sale}
        onSaved={() => { loadSale(); setReturnModalVisible(false); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 14, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: COLORS.textSecondary },
  backBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  backBtnText: { color: COLORS.primary, fontWeight: '500' },
  card: { marginBottom: 14, padding: 16 },
  invoice: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  label: { fontWeight: '500', color: COLORS.textSecondary, fontSize: 13 },
  value: { color: COLORS.text, fontSize: 14 },
  notes: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: COLORS.text },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  itemName: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  itemQty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  itemTotal: { fontWeight: '600', color: COLORS.primary, fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '500', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  buttonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  btn: { flex: 1, minWidth: '45%', paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  paidBtn: { backgroundColor: COLORS.success },
  cancelBtn: { backgroundColor: COLORS.danger },
  pendingBtn: { backgroundColor: COLORS.warning },
  exportBtn: { backgroundColor: COLORS.primary },
  returnBtn: { backgroundColor: '#FF7043' },
});
