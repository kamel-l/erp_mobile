// src/__tests__/services/validation.phase43.test.js
// Phase 5 — Tests des schémas Yup ajoutés en Phase 4.3
// Couvre: PasswordSchema, ConnectionSchema + schemas existants

import * as Yup from 'yup';

// ─── Re-définition des schémas (identiques aux screens) ────────
const PasswordSchema = Yup.object().shape({
  oldPassword: Yup.string().min(1, 'Requis').required('Ancien mot de passe requis'),
  newPassword: Yup.string()
    .min(6, 'Minimum 6 caractères')
    .max(100, 'Maximum 100 caractères')
    .required('Nouveau mot de passe requis'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Les mots de passe ne correspondent pas')
    .required('Confirmation requise'),
});

const ConnectionSchema = Yup.object().shape({
  wifiIp: Yup.string()
    .matches(/^(\d{1,3}\.){3}\d{1,3}$/, 'Adresse IP invalide')
    .required('Adresse IP requise'),
  wifiPort: Yup.string()
    .matches(/^\d{2,5}$/, 'Port invalide')
    .required('Port requis'),
  token: Yup.string()
    .min(4, 'Token trop court (min 4 caractères)')
    .required('Token requis'),
  internetUrl: Yup.string()
    .url('URL invalide')
    .nullable()
    .transform(v => v === '' ? null : v),
});

// ─── Helper pour extraire les erreurs ──────────────────────────
const getErrors = async (schema, values) => {
  try {
    await schema.validate(values, { abortEarly: false });
    return {};
  } catch (err) {
    const errors = {};
    if (err.inner) err.inner.forEach(e => { errors[e.path] = e.message; });
    return errors;
  }
};

const isValid = async (schema, values) => {
  try { await schema.validate(values, { abortEarly: false }); return true; }
  catch { return false; }
};

// ═══════════════════════════════════════════════════════════════
// TESTS — PasswordSchema
// ═══════════════════════════════════════════════════════════════
describe('PasswordSchema (ProfileScreen)', () => {

  const validData = {
    oldPassword: 'ancienMdp123',
    newPassword: 'nouveauMdp456',
    confirmPassword: 'nouveauMdp456',
  };

  describe('oldPassword', () => {
    it('accepte un ancien mot de passe non-vide', async () => {
      expect(await isValid(PasswordSchema, validData)).toBe(true);
    });

    it('rejette un ancien mot de passe vide', async () => {
      const errors = await getErrors(PasswordSchema, { ...validData, oldPassword: '' });
      expect(errors.oldPassword).toBeDefined();
    });

    it('rejette si oldPassword est absent', async () => {
      const { oldPassword, ...rest } = validData;
      const errors = await getErrors(PasswordSchema, rest);
      expect(errors.oldPassword).toBeDefined();
    });
  });

  describe('newPassword', () => {
    it('rejette un mot de passe de moins de 6 caractères', async () => {
      const errors = await getErrors(PasswordSchema, { ...validData, newPassword: '123', confirmPassword: '123' });
      expect(errors.newPassword).toMatch(/6 caractères/i);
    });

    it('rejette un mot de passe de plus de 100 caractères', async () => {
      const longPwd = 'a'.repeat(101);
      const errors = await getErrors(PasswordSchema, { ...validData, newPassword: longPwd, confirmPassword: longPwd });
      expect(errors.newPassword).toBeDefined();
    });

    it('accepte exactement 6 caractères', async () => {
      const data = { ...validData, newPassword: 'abc123', confirmPassword: 'abc123' };
      expect(await isValid(PasswordSchema, data)).toBe(true);
    });

    it('rejette si newPassword est absent', async () => {
      const errors = await getErrors(PasswordSchema, { ...validData, newPassword: undefined });
      expect(errors.newPassword).toBeDefined();
    });
  });

  describe('confirmPassword', () => {
    it('rejette si les mots de passe ne correspondent pas', async () => {
      const errors = await getErrors(PasswordSchema, { ...validData, confirmPassword: 'different' });
      expect(errors.confirmPassword).toMatch(/correspondent/i);
    });

    it('accepte si confirmPassword === newPassword', async () => {
      expect(await isValid(PasswordSchema, validData)).toBe(true);
    });

    it('rejette si confirmPassword est vide', async () => {
      const errors = await getErrors(PasswordSchema, { ...validData, confirmPassword: '' });
      expect(errors.confirmPassword).toBeDefined();
    });

    it('est sensible à la casse', async () => {
      const errors = await getErrors(PasswordSchema, { ...validData, confirmPassword: validData.newPassword.toUpperCase() });
      expect(errors.confirmPassword).toBeDefined();
    });
  });

  describe('cas complets', () => {
    it('retourne plusieurs erreurs en mode abortEarly:false', async () => {
      const errors = await getErrors(PasswordSchema, { oldPassword: '', newPassword: '123', confirmPassword: 'different' });
      // oldPassword vide, newPassword trop court, confirmPassword ne correspond pas
      expect(Object.keys(errors).length).toBeGreaterThanOrEqual(2);
    });

    it('valide un changement de mot de passe complet', async () => {
      const data = { oldPassword: 'monAncienMdp', newPassword: 'monNouveauMdp!2026', confirmPassword: 'monNouveauMdp!2026' };
      expect(await isValid(PasswordSchema, data)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS — ConnectionSchema
// ═══════════════════════════════════════════════════════════════
describe('ConnectionSchema (SyncScreen)', () => {

  const validData = {
    wifiIp: '192.168.1.65',
    wifiPort: '5000',
    token: 'DARELSSALEM2026',
    internetUrl: null,
  };

  describe('wifiIp', () => {
    it('accepte une IP valide (192.168.1.65)', async () => {
      expect(await isValid(ConnectionSchema, validData)).toBe(true);
    });

    it('accepte 10.0.0.1', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, wifiIp: '10.0.0.1' })).toBe(true);
    });

    it('rejette une IP invalide (texte)', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, wifiIp: 'mon-pc' });
      expect(errors.wifiIp).toBeDefined();
    });

    it('rejette une IP incomplète (192.168.1)', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, wifiIp: '192.168.1' });
      expect(errors.wifiIp).toBeDefined();
    });

    it('rejette une IP vide', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, wifiIp: '' });
      expect(errors.wifiIp).toBeDefined();
    });

    it('accepte 0.0.0.0', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, wifiIp: '0.0.0.0' })).toBe(true);
    });
  });

  describe('wifiPort', () => {
    it('accepte le port 5000', async () => {
      expect(await isValid(ConnectionSchema, validData)).toBe(true);
    });

    it('accepte le port 8080', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, wifiPort: '8080' })).toBe(true);
    });

    it('rejette un port alphabétique', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, wifiPort: 'abc' });
      expect(errors.wifiPort).toBeDefined();
    });

    it('rejette un port d\'un seul chiffre', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, wifiPort: '5' });
      expect(errors.wifiPort).toBeDefined();
    });

    it('rejette un port vide', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, wifiPort: '' });
      expect(errors.wifiPort).toBeDefined();
    });

    it('accepte le port 80 (2 chiffres)', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, wifiPort: '80' })).toBe(true);
    });
  });

  describe('token', () => {
    it('accepte un token valide', async () => {
      expect(await isValid(ConnectionSchema, validData)).toBe(true);
    });

    it('rejette un token de moins de 4 caractères', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, token: 'abc' });
      expect(errors.token).toMatch(/4 caractères/i);
    });

    it('rejette un token vide', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, token: '' });
      expect(errors.token).toBeDefined();
    });

    it('accepte exactement 4 caractères', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, token: 'abcd' })).toBe(true);
    });
  });

  describe('internetUrl (optionnel)', () => {
    it('accepte null (champ optionnel)', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, internetUrl: null })).toBe(true);
    });

    it('accepte une chaîne vide (transformée en null)', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, internetUrl: '' })).toBe(true);
    });

    it('accepte une URL ngrok valide', async () => {
      expect(await isValid(ConnectionSchema, { ...validData, internetUrl: 'https://abc123.ngrok.io' })).toBe(true);
    });

    it('rejette une URL invalide', async () => {
      const errors = await getErrors(ConnectionSchema, { ...validData, internetUrl: 'pas-une-url' });
      expect(errors.internetUrl).toBeDefined();
    });
  });

  describe('cas complets', () => {
    it('valide une config WiFi complète sans internet', async () => {
      const data = { wifiIp: '192.168.1.100', wifiPort: '5000', token: 'MON_TOKEN_2026', internetUrl: null };
      expect(await isValid(ConnectionSchema, data)).toBe(true);
    });

    it('valide une config avec URL internet', async () => {
      const data = { ...validData, internetUrl: 'https://mon-serveur.ngrok.io' };
      expect(await isValid(ConnectionSchema, data)).toBe(true);
    });

    it('retourne plusieurs erreurs simultanément', async () => {
      const errors = await getErrors(ConnectionSchema, { wifiIp: 'bad', wifiPort: 'x', token: 'ab' });
      expect(Object.keys(errors).length).toBeGreaterThanOrEqual(3);
    });
  });
});
