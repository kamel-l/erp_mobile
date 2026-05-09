#!/usr/bin/env python3
# backend/api_server_secure.py
# Serveur Flask sécurisé avec JWT, rate limiting et validation

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
import os
import logging
from dotenv import load_dotenv
from datetime import datetime

# Charger les variables d'environnement
load_dotenv()

from auth_utils import (
    generate_tokens, verify_token, hash_password, verify_password,
    require_auth, require_role
)
from validation import (
    validate_email, validate_username, validate_password,
    validate_product_data, validate_client_data, sanitize_string
)

# ─── CONFIGURATION ────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configuration
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
DB_PATH = os.getenv('DB_PATH', '../erp_database.db')
RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)


def get_db():
    """Ouvrir une connexion à la base de données"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def db_response(success, data=None, error=None, code=None, status=200):
    """Formatter une réponse JSON"""
    response = {
        'success': success,
        'data': data or {},
    }
    if error:
        response['error'] = error
    if code:
        response['code'] = code
    return jsonify(response), status


# ─── AUTH ─────────────────────────────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
@limiter.limit(os.getenv('RATE_LIMIT_AUTH', '10/minute'))
def login():
    """Connexion utilisateur"""
    try:
        data = request.json or {}
        username = sanitize_string(data.get('username', ''))
        password = data.get('password', '')
        
        # Validation
        if not username or not password:
            logger.warning(f'Login tentative sans credentials')
            return db_response(False, error='Identifiants requis', code='MISSING_CREDENTIALS', status=400)
        
        # Récupérer l'utilisateur
        db = get_db()
        user = db.execute(
            'SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?',
            (username,)
        ).fetchone()
        db.close()
        
        if not user or not user['is_active']:
            logger.warning(f'Login échoué: user "{username}" not found or inactive')
            return db_response(False, error='Identifiants incorrects', code='INVALID_CREDENTIALS', status=401)
        
        # Vérifier le mot de passe
        if not verify_password(user['password_hash'], password):
            logger.warning(f'Login échoué: invalid password for "{username}"')
            return db_response(False, error='Identifiants incorrects', code='INVALID_CREDENTIALS', status=401)
        
        # Générer les tokens
        tokens = generate_tokens(user['id'], user['username'], user['role'])
        
        logger.info(f'Login réussi: {username}')
        return db_response(True, data={
            **tokens,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
            }
        })
    
    except Exception as e:
        logger.error(f'Login error: {str(e)}')
        return db_response(False, error='Erreur serveur', code='SERVER_ERROR', status=500)


@app.route('/api/auth/refresh', methods=['POST'])
@limiter.limit(os.getenv('RATE_LIMIT_AUTH', '10/minute'))
def refresh_token():
    """Rafraîchir le access token"""
    try:
        data = request.json or {}
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            return db_response(False, error='Refresh token manquant', code='NO_REFRESH_TOKEN', status=400)
        
        payload = verify_token(refresh_token)
        if not payload or payload.get('type') != 'refresh':
            logger.warning(f'Invalid refresh token')
            return db_response(False, error='Refresh token invalide', code='INVALID_REFRESH_TOKEN', status=401)
        
        # Générer nouveau access token
        tokens = generate_tokens(payload['user_id'], payload['username'], payload.get('role', 'user'))
        
        logger.info(f'Token rafraîchi pour {payload["username"]}')
        return db_response(True, data=tokens)
    
    except Exception as e:
        logger.error(f'Refresh error: {str(e)}')
        return db_response(False, error='Erreur serveur', code='SERVER_ERROR', status=500)


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    """Déconnexion"""
    logger.info(f'Logout: {request.current_user.get("username")}')
    return db_response(True, data={'message': 'Déconnecté'})


# ─── DASHBOARD ────────────────────────────────────────────────────────────────
@app.route('/api/dashboard/stats', methods=['GET'])
@require_auth
@limiter.limit(os.getenv('RATE_LIMIT_API', '100/minute'))
def dashboard_stats():
    """Statistiques du tableau de bord"""
    try:
        db = get_db()
        today = datetime.now().strftime('%Y-%m-%d')
        year = datetime.now().year
        
        # Ventes du jour
        sales_today = db.execute(
            "SELECT COALESCE(SUM(total),0) as t FROM sales WHERE DATE(sale_date)=?", 
            (today,)
        ).fetchone()['t']
        
        # Produits
        total_products = db.execute("SELECT COUNT(*) as c FROM products").fetchone()['c']
        low_stock = db.execute(
            "SELECT COUNT(*) as c FROM products WHERE stock_quantity <= min_stock"
        ).fetchone()['c']
        
        # Ventes annuelles
        sales_year = db.execute(
            "SELECT COALESCE(SUM(total),0) as t FROM sales WHERE strftime('%Y',sale_date)=?",
            (str(year),)
        ).fetchone()['t']
        
        db.close()
        
        return db_response(True, data={
            'salesToday': float(sales_today),
            'totalProducts': total_products,
            'lowStockCount': low_stock,
            'salesYear': float(sales_year),
        })
    
    except Exception as e:
        logger.error(f'Dashboard error: {str(e)}')
        return db_response(False, error='Erreur serveur', code='SERVER_ERROR', status=500)


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
@limiter.limit(os.getenv('RATE_LIMIT_GENERAL', '200/minute'))
def health():
    """Vérifier la santé du serveur"""
    return db_response(True, data={
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
    })


# ─── GESTION DES ERREURS ──────────────────────────────────────────────────────
@app.errorhandler(429)
def ratelimit_handler(e):
    """Gérer le rate limiting"""
    return db_response(False, error='Trop de requêtes. Réessayez plus tard.', 
                      code='RATE_LIMITED', status=429)


@app.errorhandler(404)
def not_found(e):
    """Route non trouvée"""
    return db_response(False, error='Endpoint non trouvé', code='NOT_FOUND', status=404)


@app.errorhandler(500)
def server_error(e):
    """Erreur serveur"""
    logger.error(f'Server error: {str(e)}')
    return db_response(False, error='Erreur serveur interne', code='SERVER_ERROR', status=500)


# ─── DÉMARRAGE ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    logger.info('Démarrage du serveur API ERP')
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=DEBUG,
        threaded=True
    )
