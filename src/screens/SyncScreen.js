/**
 * SyncScreen.js — Écran de synchronisation ERP ↔ Mobile
 * =======================================================
 * Permet de configurer la connexion et de lancer la synchronisation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SyncService from './syncService';

// ─────────────────────────────────────────────────────────────
//  Constantes
// ─────────────────────────────────────────────────────────────
const DEFAULT_TOKEN   = 'DARELSSALEM2026';
const DEFAULT_PORT    = '5000';

// ─────────────────────────────────────────────────────────────
//  Composant
// ─────────────────────────────────────────────────────────────
export default function SyncScreen() {
  const [wifiIp,      setWifiIp]      = useState('192.168.1.');
  const [wifiPort,    setWifiPort]    = useState(DEFAULT_PORT);
  const [internetUrl, setInternetUrl] = useState('');
  const [token,       setToken]       = useState(DEFAULT_TOKEN);
  const [showToken,   setShowToken]   = useState(false);
  const [syncing,     setSyncing]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [stats,       setStats]       = useState(null);
  const [lastSync,    setLastSync]    = useState(null);
  const [connInfo,    setConnInfo]    = useState(null);
  const [pendingCount, setPending]    = useState(0);
  const [autoSync,    setAutoSync]    = useState(false);

  // ── Charger la config sauvegardée ──────────────────────────
  useEffect(() => {
    (async () => {
      await SyncService.loadConfig();
      const info = SyncService.getConnectionInfo();
      if (info.wifiUrl) {
        const url = new URL(info.wifiUrl);
        setWifiIp(url.hostname);
        setWifiPort(url.port || DEFAULT_PORT);
      }
      if (info.internetUrl) setInternetUrl(info.internetUrl);
      await _refreshStats();
    })();

    SyncService.onProgress(({ step, percent }) => {
      setProgress(percent);
      const msgs = {
        pull:           'Connexion à l\'ERP...',
        pull_produits:  'Téléchargement des produits...',
        pull_clients:   'Téléchargement des clients...',
        pull_ventes:    'Téléchargement des ventes...',
        push:           'Envoi des données locales...',
        done:           'Synchronisation terminée ✅',
      };
      setProgressMsg(msgs[step] || step);
    });
  }, []);

  const _refreshStats = useCallback(async () => {
    const s = await SyncService.getLocalStats();
    setStats(s);
    setLastSync(s.last_sync);
    setPending(s.pending_count);
    setConnInfo(SyncService.getConnectionInfo());
  }, []);

  // ── Tester la connexion ─────────────────────────────────────
  const handleTest = useCallback(async () => {
    const wifiUrl = `http://${wifiIp}:${wifiPort}`;
    await SyncService.configure({ wifiUrl, internetUrl: internetUrl || null, token });
    const info = SyncService.getConnectionInfo();
    setConnInfo(info);
    if (info.isOnline) {
      Alert.alert('✅ Connexion réussie', `Connecté à :\n${info.activeUrl}`);
    } else {
      Alert.alert('❌ Connexion échouée',
        'Vérifiez :\n• Le PC et le téléphone sont sur le même WiFi\n• Le serveur ERP est démarré\n• L\'adresse IP est correcte');
    }
  }, [wifiIp, wifiPort, internetUrl, token]);

  // ── Synchronisation complète ────────────────────────────────
  const handleSync = useCallback(async () => {
    const wifiUrl = `http://${wifiIp}:${wifiPort}`;
    await SyncService.configure({ wifiUrl, internetUrl: internetUrl || null, token });

    setSyncing(true);
    setProgress(0);
    setProgressMsg('Démarrage...');

    const result = await SyncService.fullSync();
    setSyncing(false);
    await _refreshStats();

    if (result.success) {
      Alert.alert('✅ Synchronisation réussie',
        `📦 Produits  : ${result.produits}\n` +
        `👥 Clients   : ${result.clients}\n` +
        `💰 Ventes    : ${result.ventes}\n` +
        (result.pushed?.ventes ? `📤 Ventes envoyées : ${result.pushed.ventes}\n` : ''));
    } else {
      Alert.alert('⚠️ Synchronisation partielle',
        result.errors.join('\n') || 'Erreur inconnue');
    }
  }, [wifiIp, wifiPort, internetUrl, token, _refreshStats]);

  // ── Réinitialiser les données locales ──────────────────────
  const handleClear = useCallback(() => {
    Alert.alert('🗑️ Effacer les données locales',
      'Toutes les données téléchargées seront supprimées.\nLes données en attente d\'envoi seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer', style: 'destructive',
          onPress: async () => {
            await SyncService.clearLocal();
            await _refreshStats();
            Alert.alert('✅', 'Données locales supprimées.');
          },
        },
      ]);
  }, [_refreshStats]);

  // ─────────────────────────────────────────────────────────
  //  Rendu
  // ─────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ── En-tête ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>🔄 Synchronisation ERP</Text>
        <Text style={s.headerSub}>DAR ELSSALEM ↔ Mobile</Text>
      </View>

      {/* ── Statut de connexion ── */}
      <StatusBadge connInfo={connInfo} />

      {/* ── Stats locales ── */}
      {stats && <StatsRow stats={stats} pending={pendingCount} />}

      {/* ── Configuration WiFi ── */}
      <Section title="📡 Connexion WiFi Local">
        <Text style={s.label}>Adresse IP du PC ERP</Text>
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
        <Text style={s.hint}>
          💡 Sur le PC → ouvrez CMD → tapez  ipconfig  → cherchez "Adresse IPv4"
        </Text>
      </Section>

      {/* ── Configuration Internet ── */}
      <Section title="🌐 Connexion Internet (optionnel)">
        <Text style={s.label}>URL publique (ngrok, VPS...)</Text>
        <TextInput
          style={s.input}
          value={internetUrl}
          onChangeText={setInternetUrl}
          placeholder="https://xxxx.ngrok.io"
          placeholderTextColor="#666"
          autoCapitalize="none"
        />
        <Text style={s.hint}>
          💡 Laissez vide si vous utilisez uniquement le WiFi local
        </Text>
      </Section>

      {/* ── Token ── */}
      <Section title="🔑 Token de sécurité">
        <View style={s.row}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={token}
            onChangeText={setToken}
            secureTextEntry={!showToken}
            placeholder="Token API"
            placeholderTextColor="#666"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setShowToken(v => !v)}
          >
            <Text>{showToken ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
      </Section>

      {/* ── Boutons ── */}
      <TouchableOpacity style={s.btnSecondary} onPress={handleTest}>
        <Text style={s.btnSecondaryText}>🔍  Tester la connexion</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btnPrimary, syncing && s.btnDisabled]}
        onPress={handleSync}
        disabled={syncing}
      >
        {syncing
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnPrimaryText}>🔄  Synchroniser maintenant</Text>
        }
      </TouchableOpacity>

      {/* ── Barre de progression ── */}
      {syncing && (
        <View style={s.progressBox}>
          <Text style={s.progressMsg}>{progressMsg}</Text>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={s.progressPct}>{Math.round(progress)}%</Text>
        </View>
      )}

      {/* ── Dernière sync ── */}
      {lastSync && (
        <Text style={s.lastSync}>
          🕐 Dernière synchronisation :{' '}
          {new Date(lastSync).toLocaleString('fr-FR')}
        </Text>
      )}

      {/* ── Données en attente ── */}
      {pendingCount > 0 && (
        <View style={s.pendingBox}>
          <Text style={s.pendingText}>
            ⏳ {pendingCount} élément(s) en attente d'envoi vers l'ERP
          </Text>
          <Text style={s.pendingHint}>
            Ces données seront envoyées à la prochaine synchronisation.
          </Text>
        </View>
      )}

      {/* ── Effacer données locales ── */}
      <TouchableOpacity style={s.btnDanger} onPress={handleClear}>
        <Text style={s.btnDangerText}>🗑️  Effacer les données locales</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
//  Composants auxiliaires
// ─────────────────────────────────────────────────────────────

function StatusBadge({ connInfo }) {
  if (!connInfo) return null;
  const online = connInfo.isOnline;
  return (
    <View style={[s.badge, online ? s.badgeOnline : s.badgeOffline]}>
      <Text style={s.badgeText}>
        {online
          ? `✅ Connecté — ${connInfo.activeUrl}`
          : '🔴 Hors ligne — Données locales uniquement'}
      </Text>
    </View>
  );
}

function StatsRow({ stats, pending }) {
  const items = [
    { icon: '📦', label: 'Produits',  value: stats.total_produits },
    { icon: '👥', label: 'Clients',   value: stats.total_clients },
    { icon: '💰', label: 'Ventes',    value: stats.total_ventes },
    { icon: '⏳', label: 'En attente', value: pending, warn: pending > 0 },
  ];
  return (
    <View style={s.statsRow}>
      {items.map(item => (
        <View key={item.label} style={s.statCard}>
          <Text style={s.statIcon}>{item.icon}</Text>
          <Text style={[s.statValue, item.warn && s.statWarn]}>
            {item.value}
          </Text>
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

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0A0E1A' },
  content:     { padding: 16, paddingBottom: 40 },

  header:      { marginBottom: 20, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC' },
  headerSub:   { fontSize: 13, color: '#94A3B8', marginTop: 4 },

  // Statut
  badge:        { borderRadius: 10, padding: 12, marginBottom: 16 },
  badgeOnline:  { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: '#22C55E55' },
  badgeOffline: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: '#EF444455' },
  badgeText:    { color: '#F8FAFC', fontSize: 12, textAlign: 'center' },

  // Stats
  statsRow:    { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard:    { flex: 1, backgroundColor: '#141B2D', borderRadius: 10,
                 padding: 10, alignItems: 'center',
                 borderWidth: 1, borderColor: '#2D3A54' },
  statIcon:    { fontSize: 18, marginBottom: 4 },
  statValue:   { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
  statWarn:    { color: '#FBBF24' },
  statLabel:   { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  // Section
  section:      { backgroundColor: '#141B2D', borderRadius: 12,
                  borderWidth: 1, borderColor: '#2D3A54',
                  padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 12 },
  label:        { fontSize: 12, color: '#94A3B8', marginBottom: 6 },
  hint:         { fontSize: 11, color: '#64748B', marginTop: 6, fontStyle: 'italic' },

  // Inputs
  input: {
    backgroundColor: '#0F1729',
    borderWidth: 1, borderColor: '#2D3A54',
    borderRadius: 8, padding: 12,
    color: '#F8FAFC', fontSize: 14, marginBottom: 4,
  },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colon:  { color: '#94A3B8', fontSize: 18, marginBottom: 4 },
  eyeBtn: { padding: 12, backgroundColor: '#1E2A42',
            borderRadius: 8, borderWidth: 1, borderColor: '#2D3A54' },

  // Boutons
  btnPrimary: {
    backgroundColor: '#3B82F6', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 12,
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
  btnDisabled:   { opacity: 0.5 },

  // Progression
  progressBox:  { backgroundColor: '#141B2D', borderRadius: 10,
                  padding: 14, marginBottom: 12,
                  borderWidth: 1, borderColor: '#2D3A54' },
  progressMsg:  { color: '#94A3B8', fontSize: 13, marginBottom: 8 },
  progressBg:   { backgroundColor: '#0F1729', borderRadius: 6,
                  height: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: '#3B82F6', height: 8, borderRadius: 6 },
  progressPct:  { color: '#3B82F6', fontSize: 12, textAlign: 'right',
                  marginTop: 4, fontWeight: 'bold' },

  // Divers
  lastSync:   { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 8 },
  pendingBox: { backgroundColor: 'rgba(251,191,36,0.10)',
                borderWidth: 1, borderColor: '#FBBF2455',
                borderRadius: 10, padding: 12, marginTop: 8 },
  pendingText: { color: '#FBBF24', fontSize: 13, fontWeight: '600' },
  pendingHint: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
});
