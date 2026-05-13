// src/screens/SyncScreen_Enhanced.js
// Phase 4.3 — Validation + Logger + Toast

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import * as Yup from 'yup';
import { syncManager } from '../services/api';
import SyncService from '../services/syncService';
import { logger } from '../services/logger';
import Toast from '../components/Toast';

const DEFAULT_TOKEN = 'DARELSSALEM2026';
const DEFAULT_PORT = '5000';

// ─── Schéma validation config connexion ───────────────────────
const ConnectionSchema = Yup.object().shape({
  wifiIp: Yup.string()
    .matches(/^(\d{1,3}\.){3}\d{1,3}$/, 'Adresse IP invalide (ex: 192.168.1.65)')
    .required('Adresse IP requise'),
  wifiPort: Yup.string()
    .matches(/^\d{2,5}$/, 'Port invalide (ex: 5000)')
    .required('Port requis'),
  token: Yup.string()
    .min(4, 'Token trop court (min 4 caractères)')
    .required('Token requis'),
  internetUrl: Yup.string()
    .url('URL invalide (ex: https://xxxx.ngrok.io)')
    .nullable()
    .transform(v => v === '' ? null : v),
});

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatusBadge({ connInfo }) {
  if (!connInfo) return null;
  const online = connInfo.isOnline;
  return (
    <View style={[s.badge, online ? s.badgeOnline : s.badgeOffline]}>
      <Text style={s.badgeText}>
        {online ? `✅ Connecté — ${connInfo.activeUrl}` : '🔴 Hors ligne — Données locales uniquement'}
      </Text>
    </View>
  );
}

function StatsRow({ stats, pending }) {
  const items = [
    { icon: '📦', label: 'Produits', value: stats.total_produits },
    { icon: '👥', label: 'Clients', value: stats.total_clients },
    { icon: '💰', label: 'Ventes', value: stats.total_ventes },
    { icon: '⏳', label: 'En attente', value: pending, warn: pending > 0 },
  ];
  return (
    <View style={s.statsRow}>
      {items.map(item => (
        <View key={item.label} style={s.statCard}>
          <Text style={s.statIcon}>{item.icon}</Text>
          <Text style={[s.statValue, item.warn && s.statWarn]}>{item.value}</Text>
          <Text style={s.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function SyncScreen_Enhanced() {
  const [wifiIp, setWifiIp] = useState('192.168.1.65');
  const [wifiPort, setWifiPort] = useState(DEFAULT_PORT);
  const [internetUrl, setInternetUrl] = useState('');
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [showToken, setShowToken] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [stats, setStats] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [connInfo, setConnInfo] = useState(null);
  const [pendingCount, setPending] = useState(0);
  const [errors, setErrors] = useState({});

  const refreshStats = useCallback(async () => {
    try {
      const st = await SyncService.getLocalStats();
      setStats(st);
      setLastSync(st.last_sync);
      setPending(st.pending_count);
      setConnInfo(SyncService.getConnectionInfo());
    } catch (error) {
      logger.error('SyncScreen: erreur refreshStats', error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await SyncService.loadConfig();
      const info = SyncService.getConnectionInfo();
      if (info.wifiUrl) {
        try {
          const url = new URL(info.wifiUrl);
          setWifiIp(url.hostname);
          setWifiPort(url.port || DEFAULT_PORT);
        } catch {
          logger.warn('SyncScreen: URL invalide dans config');
        }
      }
      if (info.internetUrl) setInternetUrl(info.internetUrl);
      await refreshStats();
    })();

    SyncService.onProgress(({ step, percent }) => {
      setProgress(percent);
      const msgs = {
        pull: 'Connexion à l\'ERP...',
        pull_produits: 'Téléchargement produits...',
        pull_clients: 'Téléchargement clients...',
        pull_ventes: 'Téléchargement ventes...',
        push: 'Envoi données locales...',
        done: 'Synchronisation terminée ✅',
      };
      setProgressMsg(msgs[step] || step);
    });
  }, [refreshStats]);

  // ── Valider config avant test/sync ──────────────────────────
  const validateConfig = useCallback(async () => {
    try {
      await ConnectionSchema.validate(
        { wifiIp, wifiPort, token, internetUrl: internetUrl || null },
        { abortEarly: false }
      );
      setErrors({});
      return true;
    } catch (err) {
      const errs = {};
      if (err.inner) {
        err.inner.forEach(e => { errs[e.path] = e.message; });
      }
      setErrors(errs);
      logger.warn('SyncScreen: validation config échouée', errs);
      Toast.error('Veuillez corriger la configuration');
      return false;
    }
  }, [wifiIp, wifiPort, token, internetUrl]);

  // ── Tester connexion ─────────────────────────────────────────
  const handleTest = useCallback(async () => {
    if (!(await validateConfig())) return;
    setTesting(true);
    logger.info('SyncScreen: test connexion', { wifiIp, wifiPort });
    try {
      const wifiUrl = `http://${wifiIp}:${wifiPort}`;
      await SyncService.configure({ wifiUrl, internetUrl: internetUrl || null, token });
      const info = SyncService.getConnectionInfo();
      setConnInfo(info);
      if (info.isOnline) {
        logger.info('SyncScreen: connexion réussie', { url: info.activeUrl });
        Toast.success(`Connecté à ${info.activeUrl}`);
      } else {
        logger.warn('SyncScreen: connexion échouée');
        Toast.error('Connexion échouée — vérifiez IP et serveur');
      }
    } catch (error) {
      logger.error('SyncScreen: erreur test connexion', error);
      Toast.error('Erreur de connexion: ' + error.message);
    } finally {
      setTesting(false);
    }
  }, [validateConfig, wifiIp, wifiPort, internetUrl, token]);

  // ── Synchronisation complète ─────────────────────────────────
  const handleSync = useCallback(async () => {
    if (!(await validateConfig())) return;
    setSyncing(true);
    setProgress(0);
    setProgressMsg('Démarrage...');
    logger.info('SyncScreen: début synchronisation');
    try {
      setProgressMsg('Connexion au serveur...');
      setProgress(20);
      await syncManager.syncAllData();
      setProgress(100);
      setProgressMsg('Synchronisation terminée ✅');
      await refreshStats();
      logger.info('SyncScreen: synchronisation réussie');
      Toast.success('Synchronisation terminée avec succès');
    } catch (error) {
      logger.error('SyncScreen: échec synchronisation', error);
      Toast.error('Échec: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }, [validateConfig, refreshStats]);

  // ── Effacer données locales ──────────────────────────────────
  const handleClear = useCallback(async () => {
    logger.warn('SyncScreen: effacement données locales demandé');
    try {
      await SyncService.clearLocal();
      await refreshStats();
      logger.info('SyncScreen: données locales effacées');
      Toast.success('Données locales supprimées');
    } catch (error) {
      logger.error('SyncScreen: erreur effacement', error);
      Toast.error('Erreur lors de l\'effacement');
    }
  }, [refreshStats]);

  const renderField = (label, value, onChange, fieldKey, props = {}) => (
    <View style={{ marginBottom: 4 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, errors[fieldKey] && s.inputError]}
        value={value}
        onChangeText={v => { onChange(v); if (errors[fieldKey]) setErrors(p => ({ ...p, [fieldKey]: null })); }}
        placeholderTextColor="#666"
        {...props}
      />
      {errors[fieldKey] ? <Text style={s.errorText}>{errors[fieldKey]}</Text> : null}
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      <View style={s.header}>
        <Text style={s.headerTitle}>🔄 Synchronisation ERP</Text>
        <Text style={s.headerSub}>DAR ELSSALEM ↔ Mobile</Text>
      </View>

      <StatusBadge connInfo={connInfo} />
      {stats && <StatsRow stats={stats} pending={pendingCount} />}

      {/* Config WiFi */}
      <Section title="📡 Connexion WiFi Local">
        <Text style={s.label}>Adresse IP du PC ERP</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[s.input, { marginBottom: 0 }, errors.wifiIp && s.inputError]}
              value={wifiIp}
              onChangeText={v => { setWifiIp(v); if (errors.wifiIp) setErrors(p => ({ ...p, wifiIp: null })); }}
              placeholder="192.168.1.65"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
          <Text style={s.colon}>:</Text>
          <View style={{ width: 80 }}>
            <TextInput
              style={[s.input, { marginBottom: 0 }, errors.wifiPort && s.inputError]}
              value={wifiPort}
              onChangeText={v => { setWifiPort(v); if (errors.wifiPort) setErrors(p => ({ ...p, wifiPort: null })); }}
              placeholder="5000"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
        </View>
        {(errors.wifiIp || errors.wifiPort) && (
          <Text style={s.errorText}>{errors.wifiIp || errors.wifiPort}</Text>
        )}
        <Text style={s.hint}>💡 CMD → ipconfig → cherchez "Adresse IPv4"</Text>
      </Section>

      {/* Config Internet */}
      <Section title="🌐 Connexion Internet (optionnel)">
        {renderField('URL publique (ngrok, VPS...)', internetUrl, setInternetUrl, 'internetUrl', {
          placeholder: 'https://xxxx.ngrok.io',
          autoCapitalize: 'none',
        })}
        <Text style={s.hint}>💡 Laissez vide pour WiFi uniquement</Text>
      </Section>

      {/* Token */}
      <Section title="🔑 Token de sécurité">
        <Text style={s.label}>Token API</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[s.input, { marginBottom: 0 }, errors.token && s.inputError]}
              value={token}
              onChangeText={v => { setToken(v); if (errors.token) setErrors(p => ({ ...p, token: null })); }}
              secureTextEntry={!showToken}
              placeholder="Token API"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowToken(v => !v)}>
            <Text>{showToken ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {errors.token && <Text style={s.errorText}>{errors.token}</Text>}
      </Section>

      {/* Boutons */}
      <TouchableOpacity style={[s.btnSecondary, testing && s.btnDisabled]} onPress={handleTest} disabled={testing}>
        {testing
          ? <ActivityIndicator color="#3B82F6" />
          : <Text style={s.btnSecondaryText}>🔍 Tester la connexion</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={[s.btnPrimary, syncing && s.btnDisabled]} onPress={handleSync} disabled={syncing}>
        {syncing
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnPrimaryText}>🔄 Synchroniser maintenant</Text>
        }
      </TouchableOpacity>

      {/* Barre progression */}
      {syncing && (
        <View style={s.progressBox}>
          <Text style={s.progressMsg}>{progressMsg}</Text>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={s.progressPct}>{Math.round(progress)}%</Text>
        </View>
      )}

      {lastSync && (
        <Text style={s.lastSync}>
          🕐 Dernière sync : {new Date(lastSync).toLocaleString('fr-FR')}
        </Text>
      )}

      {pendingCount > 0 && (
        <View style={s.pendingBox}>
          <Text style={s.pendingText}>⏳ {pendingCount} élément(s) en attente d'envoi</Text>
          <Text style={s.pendingHint}>Seront envoyés à la prochaine synchronisation.</Text>
        </View>
      )}

      <TouchableOpacity style={s.btnDanger} onPress={handleClear}>
        <Text style={s.btnDangerText}>🗑️ Effacer les données locales</Text>
      </TouchableOpacity>

    </ScrollView>
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
  statCard: { flex: 1, backgroundColor: '#141B2D', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2D3A54' },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
  statWarn: { color: '#FBBF24' },
  statLabel: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  section: { backgroundColor: '#141B2D', borderRadius: 12, borderWidth: 1, borderColor: '#2D3A54', padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 12 },
  label: { fontSize: 12, color: '#94A3B8', marginBottom: 6 },
  hint: { fontSize: 11, color: '#64748B', marginTop: 6, fontStyle: 'italic' },
  input: { backgroundColor: '#0F1729', borderWidth: 1, borderColor: '#2D3A54', borderRadius: 8, padding: 12, color: '#F8FAFC', fontSize: 14, marginBottom: 4 },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colon: { color: '#94A3B8', fontSize: 18, marginBottom: 4 },
  eyeBtn: { padding: 12, backgroundColor: '#1E2A42', borderRadius: 8, borderWidth: 1, borderColor: '#2D3A54' },
  btnPrimary: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnSecondary: { borderWidth: 1.5, borderColor: '#3B82F6', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  btnSecondaryText: { color: '#3B82F6', fontSize: 15, fontWeight: '600' },
  btnDanger: { borderWidth: 1, borderColor: '#EF4444', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 16 },
  btnDangerText: { color: '#EF4444', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  progressBox: { backgroundColor: '#141B2D', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2D3A54' },
  progressMsg: { color: '#94A3B8', fontSize: 13, marginBottom: 8 },
  progressBg: { backgroundColor: '#0F1729', borderRadius: 6, height: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: '#3B82F6', height: 8, borderRadius: 6 },
  progressPct: { color: '#3B82F6', fontSize: 12, textAlign: 'right', marginTop: 4, fontWeight: 'bold' },
  lastSync: { color: '#64748B', fontSize: 11, textAlign: 'center', marginTop: 8 },
  pendingBox: { backgroundColor: 'rgba(251,191,36,0.10)', borderWidth: 1, borderColor: '#FBBF2455', borderRadius: 10, padding: 12, marginTop: 8 },
  pendingText: { color: '#FBBF24', fontSize: 13, fontWeight: '600' },
  pendingHint: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
});
