import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import {
  syncManager,
  setApiUrl,
  getApiUrl,
  isConnected,
  api,
} from '../services/api';
import { toast } from '../components/Toast';
import { logger } from '../services/logger';
import {
  getLocalProducts,
  getLocalClients,
  getPendingActions,
  clearAllData,
  getLastSyncTime,
} from '../database/database';
import { getLocalSales } from '../database/salesRepository';

const DEFAULT_PORT = '5000';

const buildApiUrl = (wifiIp, wifiPort, internetUrl) => {
  if (internetUrl && internetUrl.trim()) {
    const base = internetUrl.trim().replace(/\/+$/, '');
    return base.endsWith('/api') ? base : `${base}/api`;
  }
  return `http://${wifiIp}:${wifiPort}/api`;
};

export default function SyncScreen() {
  const [wifiIp, setWifiIp] = useState('192.168.1.65');
  const [wifiPort, setWifiPort] = useState(DEFAULT_PORT);
  const [internetUrl, setInternetUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [connInfo, setConnInfo] = useState(null);
  const [pendingCount, setPending] = useState(0);
  const [autoSyncStatus, setAutoSyncStatus] = useState(null); // null | 'checking' | 'syncing' | 'done'
  const pollIntervalRef = useRef(null);
  const isSyncingRef = useRef(false);

  const refreshStats = useCallback(async () => {
    const [products, clients, sales, pending, connected, apiUrl, last] = await Promise.all([
      getLocalProducts(),
      getLocalClients(),
      getLocalSales(),
      getPendingActions(),
      isConnected(),
      Promise.resolve(getApiUrl()),
      getLastSyncTime(),
    ]);

    const totalCA = sales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    setStats({
      total_produits: products.length,
      total_clients: clients.length,
      total_ventes: sales.length,
      ca_total: totalCA,
    });
    setPending(pending.length);
    setLastSync(last);
    setConnInfo({
      isOnline: connected,
      activeUrl: apiUrl,
    });
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // ── Polling: vérifie toutes les 30s si l'ERP demande une sync ──
  const checkAndAutoSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    try {
      const connected = await isConnected();
      if (!connected) return;
      const res = await api.get('/sync/check');
      const { sync_needed } = res.data?.data || res.data || {};
      if (!sync_needed) return;

      // Acquitter immédiatement pour éviter les doubles déclenchements
      await api.post('/sync/ack');

      isSyncingRef.current = true;
      setAutoSyncStatus('syncing');
      logger.info('Auto-sync triggered by ERP server');
      toast.info('Synchronisation automatique', "L'ERP a demandé une mise à jour.");

      await syncManager.syncAllData();
      await refreshStats();

      setAutoSyncStatus('done');
      toast.success('Sync terminée', 'Données mises à jour depuis l\'ERP.');
      setTimeout(() => setAutoSyncStatus(null), 5000);
    } catch (e) {
      logger.warn('Auto-sync check failed', e?.message);
    } finally {
      isSyncingRef.current = false;
    }
  }, [refreshStats]);

  useEffect(() => {
    // Lancer le polling dès que le composant est monté
    pollIntervalRef.current = setInterval(checkAndAutoSync, 30000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [checkAndAutoSync]);

  const handleTest = useCallback(async () => {
    const nextUrl = buildApiUrl(wifiIp, wifiPort, internetUrl);
    const ok = await setApiUrl(nextUrl);
    if (!ok) {
      toast.error('URL invalide', "Vérifiez l'adresse saisie.");
      return;
    }
    await refreshStats();
    if (await isConnected()) {
      toast.success('Connexion configurée', `API: ${nextUrl}`);
    } else {
      toast.warning('Configuration enregistrée', 'Le serveur semble hors ligne pour le moment.');
    }
  }, [wifiIp, wifiPort, internetUrl, refreshStats]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncManager.syncAllData();
      await refreshStats();
      toast.success('Succès', 'La synchronisation est terminée.');
      logger.info('Sync completed manually');
    } catch (error) {
      logger.error('Sync error in UI', error);
      toast.error('Erreur', `Échec de la synchronisation: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }, [refreshStats]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Effacer les données locales',
      "Toutes les données locales seront supprimées.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            await refreshStats();
            toast.success('Nettoyage', 'Données locales supprimées.');
          },
        },
      ]
    );
  }, [refreshStats]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Synchronisation ERP</Text>
        <Text style={s.headerSub}>Source unique: API + syncManager</Text>
      </View>

      <StatusBadge connInfo={connInfo} />
      {stats && <StatsRow stats={stats} pending={pendingCount} />}

      {/* Bandeau sync automatique ERP */}
      {autoSyncStatus === 'syncing' && (
        <View style={s.autoSyncBanner}>
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
          <Text style={s.autoSyncText}>🔄 Synchronisation demandée par l'ERP en cours…</Text>
        </View>
      )}
      {autoSyncStatus === 'done' && (
        <View style={[s.autoSyncBanner, { backgroundColor: '#16a34a' }]}>
          <Text style={s.autoSyncText}>✅ Synchronisation automatique terminée</Text>
        </View>
      )}

      <Section title="Connexion WiFi locale">
        <Text style={s.label}>Adresse IP du serveur</Text>
        <View style={s.row}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={wifiIp}
            onChangeText={setWifiIp}
            placeholder="192.168.1.10"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
          <Text style={s.colon}>:</Text>
          <TextInput
            style={[s.input, { width: 80 }]}
            value={wifiPort}
            onChangeText={setWifiPort}
            placeholder="5000"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
      </Section>

      <Section title="Connexion Internet (optionnel)">
        <Text style={s.label}>URL publique</Text>
        <TextInput
          style={s.input}
          value={internetUrl}
          onChangeText={setInternetUrl}
          placeholder="https://example.ngrok.io"
          placeholderTextColor="#666"
          autoCapitalize="none"
        />
      </Section>

      <TouchableOpacity style={s.btnSecondary} onPress={handleTest}>
        <Text style={s.btnSecondaryText}>Tester et enregistrer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btnPrimary, syncing && s.btnDisabled]}
        onPress={handleSync}
        disabled={syncing}
      >
        {syncing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Synchroniser maintenant</Text>}
      </TouchableOpacity>

      {lastSync && (
        <Text style={s.lastSync}>
          Dernière synchronisation: {new Date(lastSync).toLocaleString('fr-FR')}
        </Text>
      )}

      {pendingCount > 0 && (
        <View style={s.pendingBox}>
          <Text style={s.pendingText}>{pendingCount} élément(s) en attente</Text>
        </View>
      )}

      <TouchableOpacity style={s.btnDanger} onPress={handleClear}>
        <Text style={s.btnDangerText}>Effacer les données locales</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatusBadge({ connInfo }) {
  if (!connInfo) return null;
  const online = connInfo.isOnline;
  return (
    <View style={[s.badge, online ? s.badgeOnline : s.badgeOffline]}>
      <Text style={s.badgeText}>
        {online ? `Connecté: ${connInfo.activeUrl}` : 'Hors ligne'}
      </Text>
    </View>
  );
}

function StatsRow({ stats, pending }) {
  const items = [
    { label: 'Produits', value: stats.total_produits },
    { label: 'Clients', value: stats.total_clients },
    { label: 'Ventes', value: stats.total_ventes },
    { label: 'En attente', value: pending },
  ];
  return (
    <View style={s.statsRow}>
      {items.map((item) => (
        <View key={item.label} style={s.statCard}>
          <Text style={s.statValue}>{item.value}</Text>
          <Text style={s.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC' },
  headerSub: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  badge: { borderRadius: 10, padding: 12, marginBottom: 16 },
  badgeOnline: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: '#22C55E55' },
  badgeOffline: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#EF444455' },
  badgeText: { color: '#F8FAFC', fontSize: 12, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#141B2D', borderRadius: 10,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2D3A54',
  },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
  statLabel: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  section: {
    backgroundColor: '#141B2D', borderRadius: 12, borderWidth: 1,
    borderColor: '#2D3A54', padding: 16, marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 12 },
  label: { fontSize: 12, color: '#94A3B8', marginBottom: 6 },
  input: {
    backgroundColor: '#0F1729', borderWidth: 1, borderColor: '#2D3A54',
    borderRadius: 8, padding: 12, color: '#F8FAFC', fontSize: 14, marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colon: { color: '#94A3B8', fontSize: 18, marginBottom: 4 },
  btnPrimary: {
    backgroundColor: '#3B82F6', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnSecondary: {
    borderWidth: 1.5, borderColor: '#3B82F6', borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  btnSecondaryText: { color: '#3B82F6', fontSize: 15, fontWeight: '600' },
  btnDanger: {
    borderWidth: 1, borderColor: '#EF4444', borderRadius: 12,
    padding: 12, alignItems: 'center', marginTop: 16,
  },
  btnDangerText: { color: '#EF4444', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  lastSync: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 8 },
  pendingBox: {
    backgroundColor: 'rgba(251,191,36,0.10)', borderWidth: 1,
    borderColor: '#FBBF2455', borderRadius: 10, padding: 12, marginTop: 8,
  },
  pendingText: { color: '#FBBF24', fontSize: 13, fontWeight: '600' },
});
