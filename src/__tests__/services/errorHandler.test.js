// src/__tests__/services/errorHandler.test.js
import {
  AppError,
  handleNetworkError,
  formatErrorMessage,
  retryWithBackoff,
} from '../../services/errorHandler';

describe('Error Handler Service', () => {
  describe('AppError', () => {
    it('crée une erreur applicative', () => {
      const error = new AppError('Test error', 'TEST_CODE', 400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('formatErrorMessage', () => {
    it('formate un message AppError', () => {
      const error = new AppError('Une erreur est survenue');
      const formatted = formatErrorMessage(error);
      expect(formatted).toBe('Une erreur est survenue');
    });

    it('formate un message d\'erreur normal', () => {
      const error = new Error('Erreur standard');
      const formatted = formatErrorMessage(error);
      expect(formatted).toBe('Erreur standard');
    });

    it('retourne un message par défaut si pas de message', () => {
      const formatted = formatErrorMessage({});
      expect(formatted).toBe('Une erreur est survenue. Veuillez réessayer.');
    });
  });

  describe('retryWithBackoff', () => {
    it('réessaye une fonction échouée', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) throw new Error('Première tentative');
        return 'Succès';
      };

      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe('Succès');
      expect(callCount).toBe(2);
    });

    it('abandonne après trop d\'essais', async () => {
      const fn = async () => {
        throw new Error('Toujours en erreur');
      };

      await expect(
        retryWithBackoff(fn, 2, 10)
      ).rejects.toThrow('Toujours en erreur');
    });
  });
});
