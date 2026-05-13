// src/services/logger.js
// Service de logging centralisé
// Note: N'importe PAS config.js pour éviter la dépendance circulaire
// (config.js importe logger → logger ne doit PAS importer config)

// Valeurs par défaut indépendantes
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_DEBUG = __DEV__ || false;

class Logger {
  constructor() {
    this.logLevel = DEFAULT_LOG_LEVEL;
    this.debug_mode = DEFAULT_DEBUG;
    this.logs = [];
    this.maxLogs = 500; // Garder les 500 derniers logs en mémoire
  }

  /**
   * Permet à config.js de mettre à jour le niveau de log après initialisation
   */
  setLevel(level) {
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      this.logLevel = level;
    }
  }

  setDebug(enabled) {
    this.debug_mode = enabled;
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
    if (this.debug_mode) {
      const logFunc = console[level] || console.log;
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
   * Exporter les logs
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
