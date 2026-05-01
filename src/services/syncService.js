/**
 * syncService.js — Service de synchronisation ERP ↔ Mobile
 * ==========================================================
 * Gère la connexion WiFi local ET Internet vers l'API ERP.
 * Stocke les données localement (AsyncStorage) pour le mode hors ligne.
 * 
 * Usage :
 *   import SyncService from './syncService';
 *   await SyncService.configure({ wifiUrl: 'http://192.168.1.10:5000', token: 'DARELSSALEM2026' });
 *   const result = await SyncService.fullSync();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// ─────────────────────────────────────────────────────────────
//  Clés de stockage local
// ─────────────────────────────────────────────────────────────
const KEYS = {
  CONFIG:          'erp_config',
  PRODUITS:        'erp_produits',
  CLIENTS:         'erp_clients',
  VENTES:          'erp_ventes',
  LAST_SYNC:       'erp_last_sync',
  PENDING_VENTES:  'erp_pending_ventes',   // ventes créées hors ligne
  PENDING_CLIENTS: 'erp_pending_clients',  // clients créés hors ligne
  PENDING_IMAGES:  'erp_pending_images',   // images en attente
};

// ─────────────────────────────────────────────────────────────
//  Classe principale
// ─────────────────────────────────────────────────────────────
class SyncService {
  constructor() {
    this.config = {
      wifiUrl:    null,      // ex: 'http://192.168.1.10:5000'
      internetUrl: null,     // ex: 'https://mon-domaine.com' (ngrok ou VPS)
      token:      'DARELSSALEM2026',
      timeout:    10000,     // 10 secondes
    };
    this.activeUrl = null;
    this._onProgress = null;
    this._onStatusChange = null;
  }

  // ───────────────────────────────────────────────────────────
  //  Configuration
  // ───────────────────────────────────────────────────────────

  /**
   * Configure le service et teste la connexion.
   * @param {object} cfg - { wifiUrl, internetUrl, token }
   */
  async configure(cfg) {
    this.config = { ...this.config, ...cfg };
    await AsyncStorage.setItem(KEYS.CONFIG, JSON.stringify(this.config));
    await this._detectBestUrl();
    return this.activeUrl;
  }

  /** Recharge la configuration depuis le stockage local. */
  async loadConfig() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CONFIG);
      if (raw) {
        this.config = { ...this.config, ...JSON.parse(raw) };
      }
    } catch (_) {}
  }

  // ───────────────────────────────────────────────────────────
  //  Détection automatique de la meilleure URL
  // ───────────────────────────────────────────────────────────

  async _detectBestUrl() {
    const netInfo = await NetInfo.fetch();
    this._notify('status', { connected: netInfo.isConnected, type: netInfo.type });

    // 1. Essayer d'abord le WiFi local (plus rapide)
    if (netInfo.type === 'wifi' && this.config.wifiUrl) {
      const ok = await this._ping(this.config.wifiUrl);
      if (ok) {
        this.activeUrl = this.config.wifiUrl;
        console.log('✅ Connexion WiFi local :', this.activeUrl);
        return true;
      }
    }

    // 2. Essayer Internet
    if (this.config.internetUrl) {
      const ok = await this._ping(this.config.internetUrl);
      if (ok) {
        this.activeUrl = this.config.internetUrl;
        console.log('✅ Connexion Internet :', this.activeUrl);
        return true;
      }
    }

    this.activeUrl = null;
    console.warn('⚠️ ERP injoignable — mode hors ligne');
    return false;
  }

  async _ping(baseUrl) {
    try {
      const res = await fetch(`${baseUrl}/api/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  get isOnline() {
    return this.activeUrl !== null;
  }

  // ───────────────────────────────────────────────────────────
  //  Requêtes HTTP
  // ───────────────────────────────────────────────────────────

  async _get(path, params = {}) {
    if (!this.activeUrl) throw new Error('ERP injoignable');
    const url = new URL(`${this.activeUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Token': this.config.token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur API');
    return json.data;
  }

  async _post(path, body = {}) {
    if (!this.activeUrl) throw new Error('ERP injoignable');
    const res = await fetch(`${this.activeUrl}${path}`, {
      method: 'POST',
      headers: {
        'X-API-Token': this.config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur API');
    return json.data;
  }

  async _put(path, body = {}) {
    if (!this.activeUrl) throw new Error('ERP injoignable');
    const res = await fetch(`${this.activeUrl}${path}`, {
      method: 'PUT',
      headers: {
        'X-API-Token': this.config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur API');
    return json.data;
  }

  // ───────────────────────────────────────────────────────────
  //  SYNCHRONISATION COMPLÈTE  (ERP → Mobile)
  // ───────────────────────────────────────────────────────────

  /**
   * Télécharge toutes les données de l'ERP et les stocke localement.
   * Envoie ensuite les données en attente (push).
   */
  async fullSync(options = {}) {
    const { sinceLastSync = true } = options;
    const result = {
      success: false,
      produits: 0,
      clients: 0,
      ventes: 0,
      pushed: {},
      errors: [],
      timestamp: new Date().toISOString(),
    };

    // Détecter la meilleure URL
    await this._detectBestUrl();

    if (!this.isOnline) {
      result.errors.push('Aucune connexion à l\'ERP');
      return result;
    }

    this._notify('progress', { step: 'pull', percent: 0 });

    try {
      // ── 1. PULL : ERP → Mobile ────────────────────────────
      const lastSync = sinceLastSync
        ? await AsyncStorage.getItem(KEYS.LAST_SYNC)
        : null;

      const params = lastSync ? { since: lastSync } : {};
      const syncData = await this._get('/api/sync', params);

      // Sauvegarder les produits
      if (syncData.produits && syncData.produits.length > 0) {
        const existing = await this.getLocalProduits();
        const merged   = this._mergeById(existing, syncData.produits);
        await AsyncStorage.setItem(KEYS.PRODUITS, JSON.stringify(merged));
        result.produits = syncData.produits.length;
      }

      this._notify('progress', { step: 'pull_produits', percent: 30 });

      // Sauvegarder les clients
      if (syncData.clients && syncData.clients.length > 0) {
        const existing = await this.getLocalClients();
        const merged   = this._mergeById(existing, syncData.clients);
        await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(merged));
        result.clients = syncData.clients.length;
      }

      this._notify('progress', { step: 'pull_clients', percent: 50 });

      // Sauvegarder les ventes
      if (syncData.ventes && syncData.ventes.length > 0) {
        const existing = await this.getLocalVentes();
        const merged   = this._mergeById(existing, syncData.ventes);
        await AsyncStorage.setItem(KEYS.VENTES, JSON.stringify(merged));
        result.ventes = syncData.ventes.length;
      }

      this._notify('progress', { step: 'pull_ventes', percent: 70 });

      // ── 2. PUSH : Mobile → ERP ────────────────────────────
      const pushResult = await this._pushPending();
      result.pushed = pushResult;

      this._notify('progress', { step: 'push', percent: 90 });

      // ── 3. Mettre à jour la date de dernière sync ─────────
      const now = new Date().toISOString();
      await AsyncStorage.setItem(KEYS.LAST_SYNC, now);
      result.timestamp = now;
      result.success   = true;

      this._notify('progress', { step: 'done', percent: 100 });
      this._notify('status', { lastSync: now, success: true });

    } catch (e) {
      result.errors.push(e.message);
      this._notify('status', { success: false, error: e.message });
    }

    return result;
  }

  // ───────────────────────────────────────────────────────────
  //  PUSH : envoyer les données en attente vers l'ERP
  // ───────────────────────────────────────────────────────────

  async _pushPending() {
    const pendingVentes  = await this._loadPending(KEYS.PENDING_VENTES);
    const pendingClients = await this._loadPending(KEYS.PENDING_CLIENTS);
    const pendingImages  = await this._loadPending(KEYS.PENDING_IMAGES);

    if (!pendingVentes.length && !pendingClients.length && !pendingImages.length) {
      return { ventes: 0, clients: 0, images: 0 };
    }

    try {
      const result = await this._post('/api/sync/push', {
        ventes:           pendingVentes,
        clients:          pendingClients,
        produits_images:  pendingImages,
      });

      // Vider la queue si push réussi
      await AsyncStorage.removeItem(KEYS.PENDING_VENTES);
      await AsyncStorage.removeItem(KEYS.PENDING_CLIENTS);
      await AsyncStorage.removeItem(KEYS.PENDING_IMAGES);

      console.log('✅ Push réussi :', result);
      return result;
    } catch (e) {
      console.warn('⚠️ Push échoué, données conservées localement :', e.message);
      return { error: e.message };
    }
  }

  // ───────────────────────────────────────────────────────────
  //  API PUBLIQUE — Produits
  // ───────────────────────────────────────────────────────────

  async getProduits() {
    await this._detectBestUrl();
    if (this.isOnline) {
      try {
        const produits = await this._get('/api/produits');
        await AsyncStorage.setItem(KEYS.PRODUITS, JSON.stringify(produits));
        return produits;
      } catch (_) {}
    }
    return this.getLocalProduits();
  }

  async getLocalProduits() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PRODUITS);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  async updateProduit(id, data) {
    await this._detectBestUrl();
    if (this.isOnline) {
      return this._put(`/api/produits/${id}`, data);
    }
    // Hors ligne : mettre à jour localement + ajouter image en pending
    if (data.image_base64) {
      await this._addPending(KEYS.PENDING_IMAGES, { id, image_base64: data.image_base64 });
    }
    const produits = await this.getLocalProduits();
    const idx = produits.findIndex(p => p.id === id);
    if (idx >= 0) {
      produits[idx] = { ...produits[idx], ...data };
      await AsyncStorage.setItem(KEYS.PRODUITS, JSON.stringify(produits));
    }
    return { id, offline: true };
  }

  // ───────────────────────────────────────────────────────────
  //  API PUBLIQUE — Clients
  // ───────────────────────────────────────────────────────────

  async getClients() {
    await this._detectBestUrl();
    if (this.isOnline) {
      try {
        const clients = await this._get('/api/clients');
        await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
        return clients;
      } catch (_) {}
    }
    return this.getLocalClients();
  }

  async getLocalClients() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CLIENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  async createClient(data) {
    await this._detectBestUrl();
    if (this.isOnline) {
      const result = await this._post('/api/clients', data);
      // Mettre à jour le cache local
      const clients = await this.getLocalClients();
      clients.unshift({ ...data, id: result.id });
      await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
      return result;
    }
    // Hors ligne : stocker en pending avec ID temporaire
    const tempId = `temp_${Date.now()}`;
    const newClient = { ...data, id: tempId, _pending: true };
    await this._addPending(KEYS.PENDING_CLIENTS, data);
    const clients = await this.getLocalClients();
    clients.unshift(newClient);
    await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
    return { id: tempId, offline: true };
  }

  // ───────────────────────────────────────────────────────────
  //  API PUBLIQUE — Ventes
  // ───────────────────────────────────────────────────────────

  async getVentes(limit = 50) {
    await this._detectBestUrl();
    if (this.isOnline) {
      try {
        const ventes = await this._get('/api/ventes', { limit });
        await AsyncStorage.setItem(KEYS.VENTES, JSON.stringify(ventes));
        return ventes;
      } catch (_) {}
    }
    return this.getLocalVentes();
  }

  async getLocalVentes() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.VENTES);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  /**
   * Crée une vente.
   * Si hors ligne → stockée localement et envoyée à la prochaine sync.
   */
  async createVente(data) {
    await this._detectBestUrl();

    // Générer un numéro de facture temporaire si absent
    if (!data.invoice_number) {
      const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      data.invoice_number = `MOB-${ts}`;
    }
    data.sale_date = data.sale_date || new Date().toISOString()
      .replace('T', ' ').slice(0, 19);

    if (this.isOnline) {
      try {
        const result = await this._post('/api/ventes', data);
        // Ajouter au cache local
        const ventes = await this.getLocalVentes();
        ventes.unshift({ ...data, id: result.id });
        await AsyncStorage.setItem(KEYS.VENTES, JSON.stringify(ventes));
        return result;
      } catch (e) {
        console.warn('Envoi vente échoué, mise en queue :', e.message);
      }
    }

    // Hors ligne (ou envoi échoué) → file d'attente
    const tempId = `temp_${Date.now()}`;
    await this._addPending(KEYS.PENDING_VENTES, data);
    const ventes = await this.getLocalVentes();
    ventes.unshift({ ...data, id: tempId, _pending: true });
    await AsyncStorage.setItem(KEYS.VENTES, JSON.stringify(ventes));
    return { id: tempId, invoice_number: data.invoice_number, offline: true };
  }

  // ───────────────────────────────────────────────────────────
  //  Statistiques rapides (depuis le cache local)
  // ───────────────────────────────────────────────────────────

  async getLocalStats() {
    const [produits, clients, ventes] = await Promise.all([
      this.getLocalProduits(),
      this.getLocalClients(),
      this.getLocalVentes(),
    ]);
    const ca = ventes.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const lastSync = await AsyncStorage.getItem(KEYS.LAST_SYNC);
    const pending  = await this._countPending();
    return {
      total_produits: produits.length,
      total_clients:  clients.length,
      total_ventes:   ventes.length,
      ca_total:       ca,
      last_sync:      lastSync,
      pending_count:  pending,
    };
  }

  async getPendingCount() {
    return this._countPending();
  }

  // ───────────────────────────────────────────────────────────
  //  Helpers internes
  // ───────────────────────────────────────────────────────────

  /** Fusionne deux tableaux d'objets par ID (les nouveaux écrasent les anciens). */
  _mergeById(existing, incoming) {
    const map = new Map(existing.map(e => [e.id, e]));
    incoming.forEach(item => map.set(item.id, item));
    return Array.from(map.values());
  }

  async _loadPending(key) {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  async _addPending(key, item) {
    const list = await this._loadPending(key);
    list.push(item);
    await AsyncStorage.setItem(key, JSON.stringify(list));
  }

  async _countPending() {
    const v = await this._loadPending(KEYS.PENDING_VENTES);
    const c = await this._loadPending(KEYS.PENDING_CLIENTS);
    const i = await this._loadPending(KEYS.PENDING_IMAGES);
    return v.length + c.length + i.length;
  }

  /** Enregistre un callback de progression. */
  onProgress(cb)      { this._onProgress     = cb; }
  onStatusChange(cb)  { this._onStatusChange  = cb; }

  _notify(type, data) {
    if (type === 'progress' && this._onProgress)     this._onProgress(data);
    if (type === 'status'   && this._onStatusChange) this._onStatusChange(data);
  }

  /** Efface toutes les données locales (déconnexion). */
  async clearLocal() {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    this.activeUrl = null;
    this.config = { ...this.config, wifiUrl: null, internetUrl: null };
  }

  /** Retourne l'URL active et les infos de connexion. */
  getConnectionInfo() {
    return {
      activeUrl:    this.activeUrl,
      isOnline:     this.isOnline,
      wifiUrl:      this.config.wifiUrl,
      internetUrl:  this.config.internetUrl,
    };
  }
}

// Singleton partagé dans toute l'app
export default new SyncService();
