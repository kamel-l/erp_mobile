# backend/api_server.py
# Mini serveur Flask qui expose votre base SQLite ERP comme API REST
# L'app Android se connecte à ce serveur via votre réseau local (Wi-Fi)
#
# Installation : pip install flask flask-cors
# Lancement    : python api_server.py
# L'app mobile se connecte à http://VOTRE_IP:5000/api

from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os
import hashlib
import secrets
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Autorise les requêtes de l'app mobile

# ─── CONFIG ───────────────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'erp_database.db')
SECRET_KEY = 'votre_cle_secrete_ici'  # Changez ceci en production
TOKENS = {}  # Stockage simple en mémoire (utilisez Redis en prod)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def verify_token(token):
    return TOKENS.get(token)


def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        user = verify_token(token)
        if not user:
            return jsonify({'error': 'Non autorisé'}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated


# ─── AUTH ─────────────────────────────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '')
    password = data.get('password', '')
    
    db = get_db()
    user = db.execute(
        'SELECT * FROM users WHERE username = ? AND is_active = 1', 
        (username,)
    ).fetchone()
    db.close()
    
    if not user:
        return jsonify({'error': 'Identifiants incorrects'}), 401
    
    # Vérification du mot de passe (hashé salt:hash)
    stored_hash = user['password_hash']
    try:
        salt, _ = stored_hash.split(':')
        computed = f"{salt}:{hashlib.sha256(f'{salt}{password}'.encode()).hexdigest()}"
        if computed != stored_hash:
            return jsonify({'error': 'Identifiants incorrects'}), 401
    except Exception:
        return jsonify({'error': 'Erreur authentification'}), 500
    
    # Générer token
    token = secrets.token_hex(32)
    TOKENS[token] = {'id': user['id'], 'username': user['username'], 'role': user['role']}
    
    return jsonify({
        'token': token,
        'user': {'id': user['id'], 'username': user['username'], 'role': user['role']}
    })


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    TOKENS.pop(token, None)
    return jsonify({'message': 'Déconnecté'})


# ─── DASHBOARD ────────────────────────────────────────────────────────────────
@app.route('/api/dashboard/stats')
@require_auth
def dashboard_stats():
    db = get_db()
    today = datetime.now().strftime('%Y-%m-%d')
    year = datetime.now().year
    
    sales_today = db.execute(
        "SELECT COALESCE(SUM(total),0) as t FROM sales WHERE DATE(sale_date)=?", (today,)
    ).fetchone()['t']
    
    total_products = db.execute("SELECT COUNT(*) as c FROM products").fetchone()['c']
    low_stock = db.execute(
        "SELECT COUNT(*) as c FROM products WHERE stock_quantity <= min_stock"
    ).fetchone()['c']
    
    sales_year = db.execute(
        "SELECT COALESCE(SUM(total),0) as t FROM sales WHERE strftime('%Y',sale_date)=?",
        (str(year),)
    ).fetchone()['t']
    
    purchases_year = db.execute(
        "SELECT COALESCE(SUM(total),0) as t FROM purchases WHERE strftime('%Y',purchase_date)=?",
        (str(year),)
    ).fetchone()['t']
    
    db.close()
    return jsonify({
        'salesToday': float(sales_today),
        'growth': 12.4,  # TODO: calculer dynamiquement
        'activeOrders': 23,
        'lowStockCount': low_stock,
        'totalProducts': total_products,
        'monthlyRevenue': float(sales_year),
        'netProfit': float(sales_year) - float(purchases_year),
        'grossMargin': round((float(sales_year) - float(purchases_year)) / max(float(sales_year), 1) * 100, 1),
    })


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
    return jsonify(result)


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
    return jsonify([dict(r) for r in rows])


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
        return jsonify({'error': 'Vente introuvable'}), 404
    
    items = db.execute("""
        SELECT si.*, p.name as product_name
        FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    """, (sale_id,)).fetchall()
    
    db.close()
    result = dict(sale)
    result['items'] = [dict(i) for i in items]
    return jsonify(result)


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
    return jsonify([dict(r) for r in rows])


@app.route('/api/products/barcode/<barcode>')
@require_auth
def get_by_barcode(barcode):
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE barcode = ?", (barcode,)).fetchone()
    db.close()
    if not row:
        return jsonify({'error': 'Produit introuvable'}), 404
    return jsonify(dict(row))


@app.route('/api/products/low-stock')
@require_auth
def low_stock():
    db = get_db()
    rows = db.execute("""
        SELECT * FROM products WHERE stock_quantity <= min_stock ORDER BY stock_quantity
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


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
    return jsonify([dict(r) for r in rows])


# ─── EMPLOYEES ────────────────────────────────────────────────────────────────
@app.route('/api/employees')
@require_auth
def get_employees():
    db = get_db()
    rows = db.execute(
        "SELECT id, username, role, is_active, last_login FROM users ORDER BY username"
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


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
    return jsonify([dict(r) for r in rows])


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
    return jsonify({
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
    return jsonify([dict(r) for r in rows])


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'db': DB_PATH, 'time': datetime.now().isoformat()})


if __name__ == '__main__':
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    print(f"\n{'='*50}")
    print(f"  Serveur ERP API démarré !")
    print(f"  URL locale : http://{local_ip}:5000")
    print(f"  Mettez cette IP dans src/services/api.js")
    print(f"{'='*50}\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
