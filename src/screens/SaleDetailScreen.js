// src/screens/SaleDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, formatDA } from '../services/theme';
import { Card, Badge, RowBetween, Divider } from '../components/UIComponents';
import { getSaleWithItems, updateSaleStatus } from '../database/salesRepository';
import ReturnFromInvoiceModal from './modals/ReturnFromInvoiceModal';

export default function SaleDetailScreen({ route, navigation }) {
    const { saleId } = route.params;
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [returnModalVisible, setReturnModalVisible] = useState(false);

    useEffect(() => {
        loadSale();
    }, []);

    const loadSale = async () => {
        try {
            const data = await getSaleWithItems(saleId);
            setSale(data);
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de charger la facture');
        } finally {
            setLoading(false);
        }
    };

    const changeStatus = async (newStatus) => {
        try {
            await updateSaleStatus(saleId, newStatus);
            setSale(prev => ({ ...prev, status: newStatus }));
            Alert.alert('Succès', `Statut modifié en ${newStatus === 'paid' ? 'Payée' : newStatus === 'cancelled' ? 'Annulée' : 'En attente'}`);
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de modifier le statut');
        }
    };

    const exportToPDF = async () => {
        if (!sale) return;
        setExporting(true);
        try {
            const totalHT = sale.total / 1.19;
            const tva = sale.total - totalHT;
            const itemsHtml = sale.items.map(item => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${item.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatDA(item.unit_price)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatDA(item.total)}</td>
        </tr>
      `).join('');

            const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Facture ${sale.invoice}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #2c3e50; margin: 0; }
            .header p { color: #7f8c8d; margin: 5px 0; }
            .invoice-info { margin-bottom: 20px; }
            .invoice-info table { width: 100%; }
            .invoice-info td { padding: 5px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th { background-color: #3498db; color: white; padding: 10px; border: 1px solid #ddd; }
            .items-table td { border: 1px solid #ddd; padding: 8px; }
            .totals { text-align: right; margin-top: 20px; }
            .totals table { width: 300px; margin-left: auto; }
            .totals td { padding: 5px; }
            .status { display: inline-block; padding: 5px 10px; border-radius: 5px; color: white; background-color: ${sale.status === 'paid' ? '#27ae60' : sale.status === 'cancelled' ? '#e74c3c' : '#f39c12'}; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #95a5a6; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DAR ELSSALEM</h1>
            <p>Système de Gestion ERP</p>
            <h2>Facture ${sale.invoice}</h2>
          </div>

          <div class="invoice-info">
            <table>
              <tr><td><strong>Client :</strong></td><td>${sale.client_name}</td></tr>
              <tr><td><strong>Date :</strong></td><td>${new Date(sale.date || sale.sale_date).toLocaleDateString()}</td></tr>
              <tr><td><strong>Statut :</strong></td><td><span class="status">${sale.status === 'paid' ? 'Payée' : sale.status === 'cancelled' ? 'Annulée' : 'En attente'}</span></td></tr>
            </table>
          </div>

          <table class="items-table">
            <thead>
              <tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr><td>Total HT :</td><td>${formatDA(totalHT)}</td></tr>
              <tr><td>TVA (19%) :</td><td>${formatDA(tva)}</td></tr>
              <tr style="font-weight: bold;"><td>Total TTC :</td><td>${formatDA(sale.total)}</td></tr>
            </table>
          </div>

          <div class="footer">
            <p>Merci de votre confiance.</p>
            <p>DAR ELSSALEM ERP Mobile</p>
          </div>
        </body>
        </html>
      `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Facture ${sale.invoice}` });
            } else {
                Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erreur', 'Impossible de générer le PDF');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /><Text>Chargement...</Text></View>;
    if (!sale) return <View style={styles.loading}><Text>Facture introuvable</Text></View>;

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Text style={styles.invoice}>{sale.invoice}</Text>
                <RowBetween><Text style={styles.label}>Client</Text><Text>{sale.client_name}</Text></RowBetween>
                <Divider />
                <RowBetween><Text style={styles.label}>Date</Text><Text>{sale.date || new Date(sale.sale_date).toLocaleDateString()}</Text></RowBetween>
                <Divider />
                <RowBetween><Text style={styles.label}>Statut</Text><Badge status={sale.status || 'pending'} /></RowBetween>
                <Divider />
                <RowBetween><Text style={styles.label}>Total HT</Text><Text>{formatDA(Math.round((sale.total || 0) / 1.19))}</Text></RowBetween>
                <Divider />
                <RowBetween><Text style={styles.label}>TVA (19%)</Text><Text>{formatDA((sale.total || 0) - Math.round((sale.total || 0) / 1.19))}</Text></RowBetween>
                <Divider />
                <RowBetween><Text style={styles.label}>Total TTC</Text><Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{formatDA(sale.total || 0)}</Text></RowBetween>
            </Card>

            <Card style={styles.card}>
                <Text style={styles.subtitle}>Articles</Text>
                {sale.items && sale.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text>{item.quantity} x {formatDA(item.unit_price)}</Text>
                        <Text style={styles.itemTotal}>{formatDA(item.total)}</Text>
                    </View>
                ))}
            </Card>

            <View style={styles.buttons}>
                <TouchableOpacity style={[styles.btn, styles.exportBtn]} onPress={exportToPDF} disabled={exporting}>
                    <Text style={styles.btnText}>{exporting ? 'Génération...' : '📎 Exporter PDF'}</Text>
                </TouchableOpacity>
                {sale.status !== 'returned' && (
                    <TouchableOpacity style={[styles.btn, styles.returnBtn]} onPress={() => setReturnModalVisible(true)}>
                        <Text style={styles.btnText}>↩️ Effectuer un retour</Text>
                    </TouchableOpacity>
                )}
                {sale.status !== 'paid' && (
                    <TouchableOpacity style={[styles.btn, styles.paidBtn]} onPress={() => changeStatus('paid')}>
                        <Text style={styles.btnText}>✓ Marquer payée</Text>
                    </TouchableOpacity>
                )}
                {sale.status !== 'cancelled' && (
                    <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => changeStatus('cancelled')}>
                        <Text style={styles.btnText}>✗ Annuler</Text>
                    </TouchableOpacity>
                )}
                {sale.status !== 'pending' && (
                    <TouchableOpacity style={[styles.btn, styles.pendingBtn]} onPress={() => changeStatus('pending')}>
                        <Text style={styles.btnText}>↺ Remettre en attente</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ReturnFromInvoiceModal
                visible={returnModalVisible}
                onClose={() => setReturnModalVisible(false)}
                sale={sale}
                onSaved={() => {
                    loadSale();
                    setReturnModalVisible(false);
                }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5', padding: 14 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { marginBottom: 16, padding: 16 },
    invoice: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, color: COLORS.primary },
    label: { fontWeight: '500', color: COLORS.textSecondary },
    subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    itemName: { flex: 2 },
    itemTotal: { fontWeight: '500', color: COLORS.primary },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    btn: { flex: 1, minWidth: '45%', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    paidBtn: { backgroundColor: COLORS.success },
    cancelBtn: { backgroundColor: COLORS.danger },
    pendingBtn: { backgroundColor: COLORS.warning },
    exportBtn: { backgroundColor: COLORS.primary },
    returnBtn: { backgroundColor: COLORS.danger },
    btnText: { color: '#fff', fontWeight: '600' },
});
