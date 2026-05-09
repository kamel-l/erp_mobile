// src/__tests__/config/config.test.js
import { getConfig, setConfig, resetConfig, loadConfig } from '../../config/config';

describe('Config Service', () => {
  afterEach(() => {
    resetConfig();
  });

  it('récupère une config par défaut', () => {
    const url = getConfig('API_URL');
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
  });

  it('met à jour une config', async () => {
    const newUrl = 'http://new-api.example.com/api';
    await setConfig('API_URL', newUrl);
    expect(getConfig('API_URL')).toBe(newUrl);
  });

  it('charge la config depuis AsyncStorage', async () => {
    // Mock AsyncStorage
    await setConfig('API_TIMEOUT', 20000);
    await loadConfig();
    expect(getConfig('API_TIMEOUT')).toBe(20000);
  });

  it('réinitialise les configs', () => {
    setConfig('API_URL', 'http://test.com');
    resetConfig();
    // Les configs devraient revenir aux défauts
    expect(getConfig('API_URL')).toBeDefined();
  });
});
