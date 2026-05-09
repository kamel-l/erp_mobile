// src/services/logger.js
// Service de logging centralisé

import { getConfig } from '../config/config';

class Logger {
  constructor() {
    this.logLevel = getConfig('LOG_LEVEL') || 'info';
    this.logs = [];
    this.maxLogs = 500; // Garder les 500 derniers logs en mémoire
  }

  /**
   * Logs internes
   */
  _addLog(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Aussi afficher en console
    const logFunc = console[level] || console.log;
    if (getConfig('DEBUG')) {
      logFunc(`[${level.toUpperCase()}] ${timestamp} ${message}`, data);
    }
  }

  debug(message, data = null) {
    if (this._shouldLog('debug')) {
      this._addLog('debug', message, data);
    }
  }

  info(message, data = null) {
    if (this._shouldLog('info')) {
      this._addLog('info', message, data);
    }
  }

  warn(message, data = null) {
    if (this._shouldLog('warn')) {
      this._addLog('warn', message, data);
    }
  }

  error(message, error = null) {
    this._addLog('error', message, error);
  }

  /**
   * Vérifier si on doit logger ce niveau
   */
  _shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Obtenir l'historique des logs
   */
  getLogs(filter = null) {
    if (!filter) return this.logs;
    return this.logs.filter(log => log.level === filter);
  }

  /**
   * Exporter les logs (pour envoi au serveur)
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Effacer les logs
   */
  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();
