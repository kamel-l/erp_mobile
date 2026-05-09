// src/screens/ReportsScreen_Enhanced.js
/**
 * ReportsScreen amélioré avec:
 * - Logger pour tous les calculs
 * - Toast pour feedback
 * - Gestion d'erreurs robuste
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, formatDA } from '../services/theme';
import {
  Card, KpiCard, SectionTitle, Divider, RowBetween, ProgressBar,
} from '../components/UIComponents';
import { getLocalProducts, getLocalClients } from '../database/database';
import { getLocalSales } from '../database/salesRepository';
import { logger } from '../services/logger';
import Toast from '../components/Toast';
import { measurePerformance } from '../utils/performanceOptimizations';

export default function ReportsScreenEnhanced() {
  const [refreshing, setRefreshing] = useState(false);
  const [year] = useState(2026);
  const [salesData, setSalesData] = useState({
    monthly: [],
    topProducts: [],
    topClients: [],
    totalCA: 0,
    netProfit: 0,
    grossMargin: 0,
    salesCount: 0,
    paidCount: 0,
    recoveryRate: 0,
    stockValue: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadReportsData = useCallback(async () => {
    try {
      await measurePerformance('Load Reports Data', async () => {
        setLoading(true);
        logger.debug('Chargement des données de rapports');

        const sales = await getLocalSales();
        const products = await getLocalProducts();

        logger.debug('Données brutes chargées', { salesCount: sales.length, productsCount: products.length });

        // Calcul des ventes par mois
        const monthlyMap = {};
        sales.forEach(sale => {
          if (sale.date) {
            const month = sale.date.substring(0, 7);
            monthlyMap[month] = (monthlyMap[month] || 0) + (sale.total || 0);
          }
        });

        let monthly = Object.entries(monthlyMap)
          .slice(-4)
          .map(([month, ca]) => ({
            month: month.substring(5, 7) + '/' + month.substring(2, 4),
            ca: ca,
          }))
          .reverse();

        if (monthly.length === 0) {
          monthly = [
            { month: 'Jan', ca: 0 },
            { month: 'Fév', ca: 0 },
            { month: 'Mar', ca: 0 },
            { month: 'Avr', ca: 0 }
          ];
        }

        logger.debug('Ventes mensuelles calculées', { months: monthly.length });

        // Top produits
        const productSales = {};
        for (const sale of sales) {
          if (sale.items && sale.items.length) {
            for (const item of sale.items) {
              productSales[item.name] = (productSales[item.name] || 0) + (item.total || 0);
            }
          }
        }

        let topProducts = Object.entries(productSales)
          .map(([name, revenue]) => ({ name, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map((p, idx, arr) => ({
            ...p,
            pct: arr[0]?.revenue ? Math.round((p.revenue / arr[0].revenue) * 100) : 0
          }));

        logger.debug('Top produits calculés', { count: topProducts.length });

        // Top clients
        const clientSales = {};
        sales.forEach(sale => {
          if (sale.client_name) {
            clientSales[sale.client_name] = (clientSales[sale.client_name] || 0) + (sale.total || 0);
          }
        });

        const topClients = Object.entries(clientSales)
          .map(([name, salesAmount]) => ({ name, sales: salesAmount, count: 1 }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 3)
          .map((c, idx) => ({
            ...c,
            medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'
          }));

        logger.debug('Top clients calculés', { count: topClients.length });

        // Calculs de métriques
        const totalCA = sales.reduce((sum, s) => sum + (s.total || 0), 0);
        const paidSales = sales.filter(s => s.status === 'paid');
        const paidCA = paidSales.reduce((sum, s) => sum + (s.total || 0), 0);
        const netProfit = Math.round(paidCA * 0.257);
        const grossMargin = totalCA ? Math.round((paidCA / totalCA) * 100) : 0;
        const recoveryRate = sales.length ? Math.round((paidSales.length / sales.length) * 100) : 0;
        const stockValue = products.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);

        logger.info('Rapports calculés', {
          totalCA,
          netProfit,
          grossMargin,
          recoveryRate,
          stockValue,
          salesCount: sales.length
        });

        setSalesData({
          monthly,
          topProducts,
          topClients,
          totalCA,
          netProfit,
          grossMargin,
          salesCount: sales.length,
          paidCount: paidSales.length,
          recoveryRate,
          stockValue,
        });
      });
    } catch (error) {
      logger.error('Erreur lors du chargement des rapports', error);
      Toast.error('Impossible de charger les rapports');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      logger.debug('ReportsScreen obtient le focus');
      loadReportsData();
    }, [loadReportsData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    logger.debug('Rafraîchissement des rapports');
    await loadReportsData();
    setRefreshing(false);
  };

  const exportToPDF = async () => {
    try {
      logger.debug('Tentative export PDF rapports');
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; border-bottom: 3px solid #6366F1; padding-bottom: 10px; }
              h2 { color: #666; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #6366F1; color: white; }
              .metric { display: inline-block; width: 48%; margin: 1%; padding: 15px; border: 1px solid #ddd; }
              .value { font-size: 24px; font-weight: bold; color: #6366F1; }
              .label { font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <h1>📊 Rapport de Gestion ${new Date().getFullYear()}</h1>
            <p>Généré le: ${new Date().toLocaleDateString('fr-FR')}</p>

            <h2>Métriques Principales</h2>
            <div class="metric">
              <div class="label">Chiffre d'affaires</div>
              <div class="value">${formatDA(salesData.totalCA)}</div>
            </div>
            <div class="metric">
              <div class="label">Bénéfice Net</div>
              <div class="value">${formatDA(salesData.netProfit)}</div>
            </div>
            <div class="metric">
              <div class="label">Taux de Recouvrement</div>
              <div class="value">${salesData.recoveryRate}%</div>
            </div>
            <div class="metric">
              <div class="label">Valeur du Stock</div>
              <div class="value">${formatDA(salesData.stockValue)}</div>
            </div>

            <h2>Ventes Mensuelles</h2>
            <table>
              <tr>
                <th>Mois</th>
                <th>Chiffre d'affaires</th>
              </tr>
              ${salesData.monthly.map(m => `
                <tr>
                  <td>${m.month}</td>
                  <td>${formatDA(m.ca)}</td>
                </tr>
              `).join('')}
            </table>

            <h2>Top 5 Produits</h2>
            <table>
              <tr>
                <th>Produit</th>
                <th>Revenu</th>
              </tr>
              ${salesData.topProducts.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${formatDA(p.revenue)}</td>
                </tr>
              `).join('')}
            </table>

            <h2>Top Clients</h2>
            <table>
              <tr>
                <th>Client</th>
                <th>Ventes</th>
              </tr>
              ${salesData.topClients.map(c => `
                <tr>
                  <td>${c.medal} ${c.name}</td>
                  <td>${formatDA(c.sales)}</td>
                </tr>
              `).join('')}
            </table>

            <p style="margin-top: 40px; font-size: 12px; color: #999;">
              Rapport généré automatiquement par l'application ERP Mobile
            </p>
          </body>
        </html>
      `;

      const fileName = `rapport_${new Date().toISOString().split('T')[0]}.html`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, htmlContent);
      logger.info('Rapport exporté', { fileName, path: filePath });

      await Sharing.shareAsync(filePath, { mimeType: 'text/html', dialogTitle: fileName });
      Toast.success('Rapport partagé ✓');
    } catch (error) {
      logger.error('Erreur export rapport', error);
      Toast.error('Impossible d\'exporter le rapport');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Calcul des rapports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Métriques principales */}
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Chiffre d'affaires</Text>
            <Text style={styles.metricValue}>{formatDA(salesData.totalCA)}</Text>
            <Text style={styles.metricCount}>{salesData.salesCount} ventes</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Bénéfice net (25.7%)</Text>
            <Text style={[styles.metricValue, { color: COLORS.success }]}>{formatDA(salesData.netProfit)}</Text>
            <Text style={styles.metricCount}>{salesData.paidCount} payées</Text>
          </Card>
        </View>

        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Taux de recouvrement</Text>
            <Text style={[styles.metricValue, { color: COLORS.warning }]}>{salesData.recoveryRate}%</Text>
            <ProgressBar
              value={salesData.recoveryRate / 100}
              color={COLORS.warning}
              height={4}
              style={{ marginTop: 8 }}
            />
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Valeur du stock</Text>
            <Text style={[styles.metricValue, { color: COLORS.info }]}>{formatDA(salesData.stockValue)}</Text>
          </Card>
        </View>

        {/* Ventes mensuelles */}
        <SectionTitle>Ventes sur 4 derniers mois</SectionTitle>
        <Card>
          {salesData.monthly.map((month, idx) => (
            <View key={idx}>
              <RowBetween style={styles.monthRow}>
                <Text style={styles.monthLabel}>{month.month}</Text>
                <View style={styles.monthMetrics}>
                  <ProgressBar
                    value={month.ca / Math.max(...salesData.monthly.map(m => m.ca), 1)}
                    color={COLORS.primary}
                    height={8}
                    width={100}
                  />
                  <Text style={styles.monthValue}>{formatDA(month.ca)}</Text>
                </View>
              </RowBetween>
              {idx < salesData.monthly.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        {/* Top produits */}
        <SectionTitle>Top 5 Produits</SectionTitle>
        <Card>
          {salesData.topProducts.length === 0 ? (
            <Text style={styles.emptyText}>Aucune donnée</Text>
          ) : (
            salesData.topProducts.map((product, idx) => (
              <View key={idx}>
                <View style={styles.productRow}>
                  <View style={styles.productRank}>
                    <Text style={styles.productRankText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <ProgressBar
                      value={product.pct / 100}
                      color={COLORS.success}
                      height={4}
                    />
                  </View>
                  <Text style={styles.productValue}>{formatDA(product.revenue)}</Text>
                </View>
                {idx < salesData.topProducts.length - 1 && <Divider />}
              </View>
            ))
          )}
        </Card>

        {/* Top clients */}
        <SectionTitle>Top Clients</SectionTitle>
        <Card>
          {salesData.topClients.length === 0 ? (
            <Text style={styles.emptyText}>Aucune donnée</Text>
          ) : (
            salesData.topClients.map((client, idx) => (
              <View key={idx}>
                <RowBetween style={styles.clientRow}>
                  <View>
                    <Text style={styles.clientMedal}>{client.medal}</Text>
                    <Text style={styles.clientName}>{client.name}</Text>
                  </View>
                  <Text style={styles.clientCA}>{formatDA(client.sales)}</Text>
                </RowBetween>
                {idx < salesData.topClients.length - 1 && <Divider />}
              </View>
            ))
          )}
        </Card>

        {/* Export button */}
        <TouchableOpacity style={styles.exportBtn} onPress={exportToPDF}>
          <Text style={styles.exportBtnText}>📄 Exporter le rapport</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 12, paddingVertical: 12 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.text },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metricCard: { flex: 1, padding: 12 },
  metricLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  metricCount: { fontSize: 11, color: COLORS.textSecondary },
  monthRow: { paddingVertical: 12 },
  monthLabel: { fontWeight: '600', color: COLORS.text, width: 40 },
  monthMetrics: { flex: 1, marginHorizontal: 12 },
  monthValue: { fontSize: 12, color: COLORS.text, fontWeight: '600', marginTop: 4 },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  productRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  productRankText: { color: '#FFF', fontWeight: 'bold' },
  productInfo: { flex: 1 },
  productName: { fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  productValue: { fontWeight: '600', color: COLORS.success, width: 80, textAlign: 'right' },
  clientRow: { paddingVertical: 12 },
  clientMedal: { fontSize: 24, marginBottom: 4 },
  clientName: { fontWeight: '600', color: COLORS.text },
  clientCA: { fontWeight: '600', color: COLORS.success, fontSize: 14 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: 24 },
  exportBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginVertical: 24 },
  exportBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
});
