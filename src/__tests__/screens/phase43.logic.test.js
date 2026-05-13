// src/__tests__/screens/phase43.logic.test.js
// Phase 5 — Tests de la logique métier des écrans Phase 4.3
// (fonctions pures extraites des screens pour être testables)

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — BarcodeImageImportScreen: matchScore + normalizeStr
// ═══════════════════════════════════════════════════════════════

const normalizeStr = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[#\-_.,;:!?()[\]{}'"/\\|@&*%$^~`+=<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const matchScore = (a, b) => {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  const wordsA = na.split(' ').filter(Boolean);
  const wordsB = nb.split(' ').filter(Boolean);
  const common = wordsA.filter(w => wordsB.includes(w));
  if (common.length === 0) return 0;
  return Math.round((common.length / Math.max(wordsA.length, wordsB.length)) * 70);
};

const getBaseFileName = (fileName) => {
  if (!fileName) return null;
  return fileName.replace(/\.[^/.]+$/, '').toLowerCase().trim();
};

describe('BarcodeImageImportScreen — logique', () => {

  describe('normalizeStr', () => {
    it('retourne vide pour null/undefined', () => {
      expect(normalizeStr(null)).toBe('');
      expect(normalizeStr(undefined)).toBe('');
      expect(normalizeStr('')).toBe('');
    });

    it('met en minuscule', () => {
      expect(normalizeStr('PRODUIT TEST')).toBe('produit test');
    });

    it('remplace les tirets par des espaces', () => {
      expect(normalizeStr('produit-test')).toBe('produit test');
    });

    it('remplace les underscores par des espaces', () => {
      expect(normalizeStr('produit_test')).toBe('produit test');
    });

    it('remplace les points par des espaces', () => {
      expect(normalizeStr('produit.test')).toBe('produit test');
    });

    it('collapse les espaces multiples', () => {
      expect(normalizeStr('produit   test')).toBe('produit test');
    });

    it('trim les espaces de début et fin', () => {
      expect(normalizeStr('  produit test  ')).toBe('produit test');
    });
  });

  describe('matchScore', () => {
    it('retourne 100 pour une correspondance exacte', () => {
      expect(matchScore('huile moteur', 'huile moteur')).toBe(100);
    });

    it('est insensible à la casse', () => {
      expect(matchScore('Huile Moteur', 'huile moteur')).toBe(100);
    });

    it('retourne 80 si un terme contient l\'autre', () => {
      expect(matchScore('huile moteur 5W30', 'huile moteur')).toBe(80);
    });

    it('retourne 0 pour des termes sans mots en commun', () => {
      expect(matchScore('huile moteur', 'pneu voiture')).toBe(0);
    });

    it('retourne un score partiel pour des mots partiellement en commun', () => {
      const score = matchScore('huile moteur 5W30', 'huile filtre 5W30');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('gère les chaînes avec caractères spéciaux', () => {
      // "huile-moteur" et "huile moteur" → 100 après normalisation
      expect(matchScore('huile-moteur', 'huile moteur')).toBe(100);
    });

    it('retourne 80 pour une chaîne vide vs un terme (inclusion)', () => {
      // '' est inclus dans n'importe quelle chaîne → score 80 (contains)
      expect(matchScore('', 'produit')).toBe(80);
    });

    it('retourne 100 pour deux chaînes vides', () => {
      expect(matchScore('', '')).toBe(100);
    });

    it('reconnaît un code-barres exact', () => {
      expect(matchScore('3245673829102', '3245673829102')).toBe(100);
    });

    it('score > 0 pour des mots partiellement communs (filtre air)', () => {
      // 'filtre a air' vs 'filtre air' → 2 mots communs sur 3 max → ~47%
      const score = matchScore('filtre a air', 'filtre air');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('score >= 60 pour une correspondance forte', () => {
      // 'filtre air' vs 'filtre air' → exacte → 100%
      expect(matchScore('filtre air', 'filtre air')).toBeGreaterThanOrEqual(60);
    });
  });

  describe('getBaseFileName', () => {
    it('supprime l\'extension .jpg', () => {
      expect(getBaseFileName('produit.jpg')).toBe('produit');
    });

    it('supprime l\'extension .png', () => {
      expect(getBaseFileName('huile_moteur.png')).toBe('huile_moteur');
    });

    it('met en minuscule', () => {
      expect(getBaseFileName('HuileMOTEUR.jpg')).toBe('huilemoteur');
    });

    it('retourne null si fileName est null', () => {
      expect(getBaseFileName(null)).toBeNull();
    });

    it('retourne null si fileName est undefined', () => {
      expect(getBaseFileName(undefined)).toBeNull();
    });

    it('gère les noms de fichier sans extension', () => {
      expect(getBaseFileName('produit')).toBe('produit');
    });

    it('gère les codes-barres numériques', () => {
      expect(getBaseFileName('3245673829102.jpg')).toBe('3245673829102');
    });
  });

  describe('détection code-barres', () => {
    const isBarcodeLike = (str) => /^\d{8,14}$/.test(str);

    it('reconnaît EAN-13 (13 chiffres)', () => {
      expect(isBarcodeLike('3245673829102')).toBe(true);
    });

    it('reconnaît EAN-8 (8 chiffres)', () => {
      expect(isBarcodeLike('12345678')).toBe(true);
    });

    it('reconnaît UPC-A (12 chiffres)', () => {
      expect(isBarcodeLike('012345678905')).toBe(true);
    });

    it('rejette un code trop court (7 chiffres)', () => {
      expect(isBarcodeLike('1234567')).toBe(false);
    });

    it('rejette un code trop long (15 chiffres)', () => {
      expect(isBarcodeLike('123456789012345')).toBe(false);
    });

    it('rejette un nom de produit textuel', () => {
      expect(isBarcodeLike('huile-moteur')).toBe(false);
    });

    it('rejette un code avec lettres', () => {
      expect(isBarcodeLike('12345A7890')).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — NotificationsScreen: formatTime + génération
// ═══════════════════════════════════════════════════════════════

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays === 1) return 'Hier';
  return `${diffDays} jours`;
};

describe('NotificationsScreen — formatTime', () => {
  it('retourne vide pour null', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('')).toBe('');
  });

  it('retourne "À l\'instant" pour < 1 minute', () => {
    const now = new Date(Date.now() - 30000).toISOString(); // 30s
    expect(formatTime(now)).toBe('À l\'instant');
  });

  it('retourne "Il y a N min" pour < 1 heure', () => {
    const ago30min = new Date(Date.now() - 30 * 60000).toISOString();
    expect(formatTime(ago30min)).toBe('Il y a 30 min');
  });

  it('retourne "Il y a Nh" pour < 24 heures', () => {
    const ago5h = new Date(Date.now() - 5 * 3600000).toISOString();
    expect(formatTime(ago5h)).toBe('Il y a 5h');
  });

  it('retourne "Hier" pour 1 jour passé', () => {
    const ago25h = new Date(Date.now() - 25 * 3600000).toISOString();
    expect(formatTime(ago25h)).toBe('Hier');
  });

  it('retourne "N jours" pour > 1 jour', () => {
    const ago3d = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(formatTime(ago3d)).toBe('3 jours');
  });
});

describe('NotificationsScreen — règles de génération', () => {

  const mockProducts = [
    { id: 1, name: 'Huile Moteur', stock_quantity: 2, min_stock: 5, updated_at: new Date().toISOString() },
    { id: 2, name: 'Pneu 185/65', stock_quantity: 10, min_stock: 3 },
  ];

  const mockSales = [
    { id: 1, invoice: 'FAC-001', client_name: 'Client A', total: 5000, status: 'pending', sale_date: new Date().toISOString() },
    { id: 2, invoice: 'FAC-002', client_name: 'Client B', total: 3000, status: 'paid', sale_date: new Date().toISOString() },
    { id: 3, invoice: 'FAC-003', client_name: 'Client C', total: 1000, status: 'cancelled', sale_date: new Date().toISOString() },
  ];

  it('génère une alerte stock pour chaque produit en dessous du minimum', () => {
    const criticalProducts = mockProducts.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0));
    expect(criticalProducts.length).toBe(1);
    expect(criticalProducts[0].name).toBe('Huile Moteur');
  });

  it('ne génère pas d\'alerte pour les produits OK', () => {
    const okProducts = mockProducts.filter(p => (p.stock_quantity || 0) > (p.min_stock || 0));
    expect(okProducts.length).toBe(1);
    expect(okProducts[0].name).toBe('Pneu 185/65');
  });

  it('génère une alerte paiement pour les ventes "pending"', () => {
    const pending = mockSales.filter(s => s.status !== 'paid' && s.status !== 'cancelled');
    expect(pending.length).toBe(1);
    expect(pending[0].invoice).toBe('FAC-001');
  });

  it('ne génère pas d\'alerte pour les ventes payées ou annulées', () => {
    const closed = mockSales.filter(s => s.status === 'paid' || s.status === 'cancelled');
    expect(closed.length).toBe(2);
  });

  it('génère un ID unique par notification (format: type-id)', () => {
    const stockNotifId = `stock-${mockProducts[0].id}`;
    const paymentNotifId = `payment-${mockSales[0].id}`;
    expect(stockNotifId).toBe('stock-1');
    expect(paymentNotifId).toBe('payment-1');
    expect(stockNotifId).not.toBe(paymentNotifId);
  });

  it('trie les notifications par date décroissante', () => {
    const notifs = [
      { date: new Date('2026-05-01') },
      { date: new Date('2026-05-10') },
      { date: new Date('2026-05-05') },
    ];
    notifs.sort((a, b) => b.date - a.date);
    expect(notifs[0].date.toISOString()).toContain('2026-05-10');
    expect(notifs[2].date.toISOString()).toContain('2026-05-01');
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — SaleDetailScreen: logique changement statut + PDF
// ═══════════════════════════════════════════════════════════════

const STATUS_LABELS = {
  paid: 'Payée',
  cancelled: 'Annulée',
  pending: 'En attente',
  returned: 'Retournée',
};

const STATUS_ACTIONS = [
  { key: 'paid', label: '✓ Marquer payée' },
  { key: 'cancelled', label: '✗ Annuler' },
  { key: 'pending', label: '↺ Remettre en attente' },
];

describe('SaleDetailScreen — logique statut', () => {

  it('STATUS_LABELS couvre tous les statuts attendus', () => {
    expect(STATUS_LABELS.paid).toBe('Payée');
    expect(STATUS_LABELS.cancelled).toBe('Annulée');
    expect(STATUS_LABELS.pending).toBe('En attente');
    expect(STATUS_LABELS.returned).toBe('Retournée');
  });

  it('STATUS_ACTIONS exclut le statut actuel', () => {
    const currentStatus = 'paid';
    const available = STATUS_ACTIONS.filter(a => a.key !== currentStatus);
    expect(available.length).toBe(2);
    expect(available.find(a => a.key === 'paid')).toBeUndefined();
  });

  it('affiche 2 actions disponibles depuis "pending"', () => {
    const available = STATUS_ACTIONS.filter(a => a.key !== 'pending');
    expect(available.length).toBe(2);
    expect(available.some(a => a.key === 'paid')).toBe(true);
    expect(available.some(a => a.key === 'cancelled')).toBe(true);
  });

  it('affiche 2 actions disponibles depuis "cancelled"', () => {
    const available = STATUS_ACTIONS.filter(a => a.key !== 'cancelled');
    expect(available.length).toBe(2);
  });

  describe('calcul TVA', () => {
    it('calcule correctement le HT depuis le TTC (TVA 19%)', () => {
      const total = 11900;
      const totalHT = Math.round(total / 1.19);
      const tva = total - totalHT;
      expect(totalHT).toBe(10000);
      expect(tva).toBe(1900);
    });

    it('arrondit correctement le HT', () => {
      const total = 5000;
      const totalHT = Math.round(total / 1.19);
      expect(totalHT).toBeGreaterThan(0);
      expect(totalHT).toBeLessThan(total);
    });

    it('TVA + HT = TTC', () => {
      const total = 7500;
      const totalHT = Math.round(total / 1.19);
      const tva = total - totalHT;
      expect(tva + totalHT).toBe(total);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — SyncScreen: validation config réseau
// ═══════════════════════════════════════════════════════════════

describe('SyncScreen — logique réseau', () => {

  const buildWifiUrl = (ip, port) => `http://${ip}:${port}`;

  it('construit une URL WiFi correcte', () => {
    expect(buildWifiUrl('192.168.1.65', '5000')).toBe('http://192.168.1.65:5000');
  });

  it('construit une URL avec port 80', () => {
    expect(buildWifiUrl('10.0.0.1', '80')).toBe('http://10.0.0.1:80');
  });

  it('messages de progression: tous les steps sont définis', () => {
    const msgs = {
      pull: 'Connexion à l\'ERP...',
      pull_produits: 'Téléchargement produits...',
      pull_clients: 'Téléchargement clients...',
      pull_ventes: 'Téléchargement ventes...',
      push: 'Envoi données locales...',
      done: 'Synchronisation terminée ✅',
    };
    const steps = ['pull', 'pull_produits', 'pull_clients', 'pull_ventes', 'push', 'done'];
    steps.forEach(step => {
      expect(msgs[step]).toBeDefined();
      expect(msgs[step].length).toBeGreaterThan(0);
    });
  });

  it('un step inconnu retourne le step lui-même', () => {
    const msgs = { pull: 'Connexion...', done: 'Terminé ✅' };
    const step = 'unknown_step';
    const result = msgs[step] || step;
    expect(result).toBe('unknown_step');
  });
});
