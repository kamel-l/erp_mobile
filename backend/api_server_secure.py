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
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "*" if CORS_ORIGINS == "*" else [o.strip() for o in CORS_ORIGINS.split(',') if o.strip()]
        }
    }
)

# Configuration
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
DB_PATH = os.getenv('DB_PATH', '../erp_database.db')
RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development').lower()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    enabled=RATE_LIMIT_ENABLED
)


def maybe_limit(limit_value):
    if RATE_LIMIT_ENABLED:
        return limiter.limit(limit_value)
    return lambda f: f


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
@maybe_limit(os.getenv('RATE_LIMIT_AUTH', '10/minute'))
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
@maybe_limit(os.getenv('RATE_LIMIT_AUTH', '10/minute'))
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
@maybe_limit(os.getenv('RATE_LIMIT_API', '100/minute'))
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


@app.route('/api/dashboard/sales-week')
@require_auth
def sales_week():
    db = get_db()
    rows = db.execute("""
        SELECT DATE(sale_date) as day, SUM(total) as total
        FROM sales
        WHERE sale_date >= DATE('now', '-6 days')
        GROUP BY day ORDER BY day
    """).fetchall()
    db.close()
    
    days_map = {r['day']: float(r['total']) for r in rows}
    days_labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    result = []
    for i in range(7):
        from datetime import timedelta, date
        d = (date.today() - timedelta(days=6-i)).strftime('%Y-%m-%d')
        result.append({'day': days_labels[i], 'total': days_map.get(d, 0)})
    return db_response(True, data=result)


# ─── VENTES ───────────────────────────────────────────────────────────────────
@app.route('/api/sales')
@require_auth
def get_sales():
    db = get_db()
    limit = request.args.get('limit', 20, type=int)
    rows = db.execute("""
        SELECT s.*, c.name as client_name
        FROM sales s LEFT JOIN clients c ON s.client_id = c.id
        ORDER BY sale_date DESC LIMIT ?
    """, (limit,)).fetchall()
    db.close()
    return db_response(True, data=[dict(r) for r in rows])


@app.route('/api/sales/<int:sale_id>')
@require_auth
def get_sale(sale_id):
    db = get_db()
    sale = db.execute("""
        SELECT s.*, c.name as client_name, c.phone as client_phone
        FROM sales s LEFT JOIN clients c ON s.client_id = c.id
        WHERE s.id = ?
    """, (sale_id,)).fetchone()
    
    if not sale:
        db.close()
        return db_response(False, error='Vente introuvable', code='NOT_FOUND', status=404)
    
    items = db.execute("""
        SELECT si.*, p.name as product_name
        FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    """, (sale_id,)).fetchall()
    
    db.close()
    result = dict(sale)
    result['items'] = [dict(i) for i in items]
    return db_response(True, data=result)


# ─── PRODUCTS / STOCK ─────────────────────────────────────────────────────────
@app.route('/api/products')
@require_auth
def get_products():
    db = get_db()
    search = request.args.get('search', '')
    rows = db.execute("""
        SELECT p.*, c.name as category_name
        FROM products p LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.name LIKE ?
        ORDER BY p.name
    """, (f'%{search}%',)).fetchall()
    db.close()
    return db_response(True, data=[dict(r) for r in rows])


@app.route('/api/products/barcode/<barcode>')
@require_auth
def get_by_barcode(barcode):
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE barcode = ?", (barcode,)).fetchone()
    db.close()
    if not row:
        return db_response(False, error='Produit introuvable', code='NOT_FOUND', status=404)
    return db_response(True, data=dict(row))


@app.route('/api/products/low-stock')
@require_auth
def low_stock():
    db = get_db()
    rows = db.execute("""
        SELECT * FROM products WHERE stock_quantity <= min_stock ORDER BY stock_quantity
    """).fetchall()
    db.close()
    return db_response(True, data=[dict(r) for r in rows])


@app.route('/api/stock/movements')
@require_auth
def stock_movements():
    db = get_db()
    rows = db.execute("""
        SELECT sm.*, p.name as product_name
        FROM stock_movements sm LEFT JOIN products p ON sm.product_id = p.id
        ORDER BY created_at DESC LIMIT 50
    """).fetchall()
    db.close()
    return db_response(True, data=[dict(r) for r in rows])


# ─── EMPLOYEES ────────────────────────────────────────────────────────────────
@app.route('/api/employees')
@require_auth
def get_employees():
    db = get_db()
    rows = db.execute(
        "SELECT id, username, role, is_active, last_login FROM users ORDER BY username"
    ).fetchall()
    db.close()
    return db_response(True, data=[dict(r) for r in rows])


# ─── CLIENTS ──────────────────────────────────────────────────────────────────
@app.route('/api/clients')
@require_auth
def get_clients():
    db = get_db()
    search = request.args.get('search', '')
    rows = db.execute(
        "SELECT * FROM clients WHERE name LIKE ? ORDER BY name", (f'%{search}%',)
    ).fetchall()
    db.close()
    return db_response(True, data=[dict(r) for r in rows])


# ─── REPORTS ──────────────────────────────────────────────────────────────────
@app.route('/api/reports/monthly')
@require_auth
def monthly_report():
    year = request.args.get('year', datetime.now().year, type=int)
    month = request.args.get('month', datetime.now().month, type=int)
    
    db = get_db()
    period = f"{year}-{month:02d}"
    
    sales = db.execute(
        "SELECT COALESCE(SUM(total),0) as t, COUNT(*) as c FROM sales WHERE strftime('%Y-%m', sale_date)=?",
        (period,)
    ).fetchone()
    
    top_products = db.execute("""
        SELECT p.name, SUM(si.quantity) as qty, SUM(si.total) as revenue
        FROM sale_items si JOIN sales s ON si.sale_id=s.id
        JOIN products p ON si.product_id=p.id
        WHERE strftime('%Y-%m', s.sale_date)=?
        GROUP BY si.product_id ORDER BY revenue DESC LIMIT 5
    """, (period,)).fetchall()
    
    db.close()
    return db_response(True, data={
            'period': period,
            'totalRevenue': float(sales['t']),
            'invoiceCount': sales['c'],
            'topProducts': [dict(r) for r in top_products],
        })


@app.route('/api/reports/top-products')
@require_auth
def top_products():
    db = get_db()
    rows = db.execute("""
        SELECT p.name, SUM(si.quantity) as total_qty, SUM(si.total) as total_revenue
        FROM sale_items si JOIN products p ON si.product_id=p.id
        GROUP BY si.product_id ORDER BY total_revenue DESC LIMIT 10
    """).fetchall()
    db.close()
    return db_response(True, data=[dict(r) for r in rows])


@app.route('/api/ping')
def ping():
    """Endpoint de test de connexion (utilisé par le mobile)"""
    return db_response(True, data={'status': 'online', 'time': datetime.now().isoformat()})


# ─── SYNCHRONISATION ──────────────────────────────────────────────────────────
@app.route('/api/sync')
@require_auth
def sync():
    """Endpoint principal de synchronisation pour l'app mobile
    
    Récupère tous les produits, clients et ventes depuis une date optionnelle.
    Retourne le format attendu par le frontend.
    """
    since = request.args.get('since', None)
    
    db = get_db()
    result = {
        'success': True,
        'data': {
            'produits': [],
            'clients': [],
            'ventes': []
        },
        'timestamp': datetime.now().isoformat()
    }
    
    # Récupérer les produits
    try:
        products_query = "SELECT * FROM products"
        if since:
            products_query += f" WHERE updated_at > ? OR created_at > ?"
            products = db.execute(products_query, (since, since)).fetchall()
        else:
            products = db.execute(products_query).fetchall()
        result['data']['produits'] = [dict(p) for p in products]
    except Exception as e:
        result['data']['produits'] = []
        print(f"Erreur lecture produits: {e}")
    
    # Récupérer les clients
    try:
        clients_query = "SELECT * FROM clients"
        if since:
            clients_query += f" WHERE updated_at > ? OR created_at > ?"
            clients = db.execute(clients_query, (since, since)).fetchall()
        else:
            clients = db.execute(clients_query).fetchall()
        result['data']['clients'] = [dict(c) for c in clients]
    except Exception as e:
        result['data']['clients'] = []
        print(f"Erreur lecture clients: {e}")
    
    # Récupérer les ventes avec les détails
    try:
        sales_query = """
            SELECT s.*, c.name as client_name 
            FROM sales s 
            LEFT JOIN clients c ON s.client_id = c.id
        """
        if since:
            sales_query += f" WHERE s.updated_at > ? OR s.created_at > ?"
            sales = db.execute(sales_query, (since, since)).fetchall()
        else:
            sales = db.execute(sales_query).fetchall()
        
        ventes = []
        for s in sales:
            vente = dict(s)
            # Récupérer les items de la vente
            items = db.execute("""
                SELECT si.*, p.name as product_name
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = ?
            """, (s['id'],)).fetchall()
            vente['items'] = [dict(i) for i in items]
            ventes.append(vente)
        
        result['data']['ventes'] = ventes
    except Exception as e:
        result['data']['ventes'] = []
        print(f"Erreur lecture ventes: {e}")
    
    db.close()
    return db_response(True, data=result.get('data'))




# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
@maybe_limit(os.getenv('RATE_LIMIT_GENERAL', '200/minute'))
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
    secret = os.getenv('SECRET_KEY', 'dev_secret_key_change_in_production')
    if ENVIRONMENT == 'production' and secret == 'dev_secret_key_change_in_production':
        raise RuntimeError('SECRET_KEY must be set in production')
    logger.info('Démarrage du serveur API ERP')
    app.run(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', '5000')),
        debug=DEBUG,
        threaded=True
    )
