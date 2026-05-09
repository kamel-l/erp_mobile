// src/services/errorHandler.js
// Gestion centralisée des erreurs

import { logger } from './logger';

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Traiter les erreurs réseau
 */
export const handleNetworkError = (error) => {
  if (error.response) {
    // Erreur HTTP réponse
    const { status, data } = error.response;
    const message = data?.error || data?.message || 'Erreur serveur';
    logger.error(`HTTP ${status}: ${message}`, error);
    
    if (status === 401) {
      return new AppError('Session expirée', 'UNAUTHORIZED', 401);
    }
    if (status === 403) {
      return new AppError('Accès refusé', 'FORBIDDEN', 403);
    }
    if (status === 404) {
      return new AppError('Ressource non trouvée', 'NOT_FOUND', 404);
    }
    if (status === 429) {
      return new AppError('Trop de requêtes. Réessayez plus tard', 'RATE_LIMITED', 429);
    }
    if (status >= 500) {
      return new AppError('Erreur serveur', 'SERVER_ERROR', status);
    }
    
    return new AppError(message, 'HTTP_ERROR', status);
  } else if (error.request) {
    // Pas de réponse
    logger.error('Pas de réponse serveur', error);
    return new AppError(
      'Impossible de joindre le serveur. Vérifiez votre connexion réseau.',
      'NETWORK_ERROR'
    );
  } else {
    // Erreur setup
    logger.error('Erreur requête', error);
    return new AppError('Erreur requête', 'REQUEST_ERROR');
  }
};

/**
 * Traiter les erreurs de base de données
 */
export const handleDatabaseError = (error) => {
  logger.error('Erreur base de données', error);
  
  if (error.message?.includes('UNIQUE')) {
    return new AppError('Données dupliquées', 'DUPLICATE_ERROR');
  }
  if (error.message?.includes('FOREIGN KEY')) {
    return new AppError('Référence invalide', 'FOREIGN_KEY_ERROR');
  }
  
  return new AppError('Erreur base de données', 'DATABASE_ERROR');
};

/**
 * Traiter les erreurs de validation
 */
export const handleValidationError = (errors) => {
  const message = Object.values(errors).join('\n');
  logger.warn('Erreur validation', errors);
  return new AppError(message, 'VALIDATION_ERROR', 400);
};

/**
 * Formatter une erreur pour l'utilisateur
 */
export const formatErrorMessage = (error) => {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'Une erreur est survenue. Veuillez réessayer.';
};

/**
 * Retry avec exponential backoff
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        logger.debug(`Retry ${i + 1}/${maxRetries} après ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};
