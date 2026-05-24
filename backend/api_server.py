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


def ensure_sync_tables(db):
    db.execute("""
        CREATE TABLE IF NOT EXISTS sync_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_id TEXT UNIQUE NOT NULL,
            type TEXT,
            created_at TEXT
        )
    """)
    db.commit()


def ensure_soft_delete_columns(db):
    for table in ('products', 'clients', 'sales'):
        cols = [r['name'] for r in db.execute(f"PRAGMA table_info({table})").fetchall()]
        if 'deleted_at' not in cols:
            db.execute(f"ALTER TABLE {table} ADD COLUMN deleted_at TEXT")
    db.commit()


def has_column(db, table, column):
    cols = [r['name'] for r in db.execute(f"PRAGMA table_info({table})").fetchall()]
    return column in cols


def ensure_updated_at_columns(db):
    # Ajoute updated_at si absent
    for table in ('products', 'clients', 'sales'):
        cols = [r['name'] for r in db.execute(f"PRAGMA table_info({table})").fetchall()]
        if 'updated_at' not in cols:
            db.execute(f"ALTER TABLE {table} ADD COLUMN updated_at TEXT")

    # Initialise updated_at pour les lignes existantes
    db.execute(
        "UPDATE products SET updated_at = COALESCE(updated_at, created_at, ?) WHERE updated_at IS NULL",
        (datetime.now().isoformat(),)
    )
    db.execute(
        "UPDATE clients SET updated_at = COALESCE(updated_at, created_at, ?) WHERE updated_at IS NULL",
        (datetime.now().isoformat(),)
    )
    db.execute(
        "UPDATE sales SET updated_at = COALESCE(updated_at, created_at, sale_date, ?) WHERE updated_at IS NULL",
        (datetime.now().isoformat(),)
    )
    db.commit()


def is_duplicate_operation(db, operation_id, op_type='unknown'):
    if not operation_id:
        return False

    ensure_sync_tables(db)
    existing = db.execute(
        "SELECT id FROM sync_operations WHERE operation_id = ?",
        (operation_id,)
    ).fetchone()
    if existing:
        return True

    db.execute(
        "INSERT INTO sync_operations (operation_id, type, created_at) VALUES (?, ?, ?)",
        (operation_id, op_type, datetime.now().isoformat())
    )
    db.commit()
    return False


def verify_token(token):
    return TOKENS.get(token)


def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        # Support pour les deux formats de token : Authorization Bearer ET X-API-Token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            token = request.headers.get('X-API-Token', '')
        
        user = verify_token(token)
        if not user:
            return jsonify({'error': 'Non autorisé', 'success': False}), 401
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
        'success': True,
        'data': {
            'token': token,
            'user': {'id': user['id'], 'username': user['username'], 'role': user['role']}
        }
    })


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        token = request.headers.get('X-API-Token', '')
    TOKENS.pop(token, None)
    return jsonify({'success': True, 'data': {'message': 'Déconnecté'}})


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
        'success': True,
        'data': {
            'salesToday': float(sales_today),
            'growth': 12.4,  # TODO: calculer dynamiquement
            'activeOrders': 23,
            'lowStockCount': low_stock,
            'totalProducts': total_products,
            'monthlyRevenue': float(sales_year),
            'netProfit': float(sales_year) - float(purchases_year),
            'grossMargin': round((float(sales_year) - float(purchases_year)) / max(float(sales_year), 1) * 100, 1),
        }
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
    return jsonify({'success': True, 'data': result})


# ─── VENTES ───────────────────────────────────────────────────────────────────
@app.route('/api/sales')
@require_auth
def get_sales():
    db = get_db()
    ensure_soft_delete_columns(db)
    limit = request.args.get('limit', 20, type=int)
    rows = db.execute("""
        SELECT s.*, c.name as client_name
        FROM sales s LEFT JOIN clients c ON s.client_id = c.id
        WHERE s.deleted_at IS NULL
        ORDER BY sale_date DESC LIMIT ?
    """, (limit,)).fetchall()
    db.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


@app.route('/api/sales', methods=['POST'])
@require_auth
def create_sale():
    payload = request.json or {}
    sale = payload.get('sale') or {}
    items = payload.get('items') or []
    operation_id = payload.get('operation_id')

    db = get_db()
    ensure_updated_at_columns(db)
    try:
        if is_duplicate_operation(db, operation_id, 'sale'):
            return jsonify({'success': True, 'data': {'duplicate': True, 'operation_id': operation_id}})

        sale_date = sale.get('sale_date') or sale.get('date') or datetime.now().isoformat()
        invoice = sale.get('invoice') or sale.get('invoice_number') or f"MOB-{int(datetime.now().timestamp())}"
        status = sale.get('status') or 'paid'
        client_id = sale.get('client_id')
        total = float(sale.get('total') or 0)

        db.execute(
            """
            INSERT INTO sales (invoice, client_id, total, status, sale_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (invoice, client_id, total, status, sale_date, datetime.now().isoformat(), datetime.now().isoformat())
        )
        sale_id = db.execute("SELECT last_insert_rowid() AS id").fetchone()['id']

        for item in items:
            product_id = item.get('product_id')
            qty = int(item.get('quantity') or 0)
            unit_price = float(item.get('unit_price') or 0)
            item_total = float(item.get('total') or (qty * unit_price))

            db.execute(
                """
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
                VALUES (?, ?, ?, ?, ?)
                """,
                (sale_id, product_id, qty, unit_price, item_total)
            )
            if product_id:
                db.execute(
                    "UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) - ? WHERE id = ?",
                    (qty, product_id)
                )

        db.commit()
        return jsonify({'success': True, 'data': {'id': sale_id, 'invoice': invoice}})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': f'Erreur création vente: {e}'}), 400
    finally:
        db.close()


@app.route('/api/sales/<int:sale_id>')
@require_auth
def get_sale(sale_id):
    db = get_db()
    ensure_soft_delete_columns(db)
    sale = db.execute("""
        SELECT s.*, c.name as client_name, c.phone as client_phone
        FROM sales s LEFT JOIN clients c ON s.client_id = c.id
        WHERE s.id = ? AND s.deleted_at IS NULL
    """, (sale_id,)).fetchone()
    
    if not sale:
        db.close()
        return jsonify({'success': False, 'error': 'Vente introuvable'}), 404
    
    items = db.execute("""
        SELECT si.*, p.name as product_name
        FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    """, (sale_id,)).fetchall()
    
    db.close()
    result = dict(sale)
    result['items'] = [dict(i) for i in items]
    return jsonify({'success': True, 'data': result})


@app.route('/api/sales/<int:sale_id>', methods=['DELETE'])
@require_auth
def soft_delete_sale(sale_id):
    db = get_db()
    ensure_soft_delete_columns(db)
    ensure_updated_at_columns(db)
    try:
        now = datetime.now().isoformat()
        db.execute(
            "UPDATE sales SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            (now, now, sale_id)
        )
        db.commit()
        return jsonify({'success': True, 'data': {'id': sale_id, 'deleted_at': now}})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': f'Erreur suppression vente: {e}'}), 400
    finally:
        db.close()


# ─── PRODUCTS / STOCK ─────────────────────────────────────────────────────────
@app.route('/api/products')
@require_auth
def get_products():
    db = get_db()
    ensure_soft_delete_columns(db)
    search = request.args.get('search', '')
    rows = db.execute("""
        SELECT p.*, c.name as category_name
        FROM products p LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.name LIKE ? AND p.deleted_at IS NULL
        ORDER BY p.name
    """, (f'%{search}%',)).fetchall()
    db.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


@app.route('/api/products/barcode/<barcode>')
@require_auth
def get_by_barcode(barcode):
    db = get_db()
    ensure_soft_delete_columns(db)
    row = db.execute("SELECT * FROM products WHERE barcode = ? AND deleted_at IS NULL", (barcode,)).fetchone()
    db.close()
    if not row:
        return jsonify({'success': False, 'error': 'Produit introuvable'}), 404
    return jsonify({'success': True, 'data': dict(row)})


@app.route('/api/products/low-stock')
@require_auth
def low_stock():
    db = get_db()
    ensure_soft_delete_columns(db)
    rows = db.execute("""
        SELECT * FROM products WHERE stock_quantity <= min_stock AND deleted_at IS NULL ORDER BY stock_quantity
    """).fetchall()
    db.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@require_auth
def soft_delete_product(product_id):
    db = get_db()
    ensure_soft_delete_columns(db)
    ensure_updated_at_columns(db)
    try:
        now = datetime.now().isoformat()
        db.execute(
            "UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            (now, now, product_id)
        )
        db.commit()
        return jsonify({'success': True, 'data': {'id': product_id, 'deleted_at': now}})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': f'Erreur suppression produit: {e}'}), 400
    finally:
        db.close()


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
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


@app.route('/api/stock/update', methods=['POST'])
@require_auth
def update_stock():
    data = request.json or {}
    operation_id = data.get('operation_id')
    product_id = data.get('product_id')
    quantity = int(data.get('quantity') or 0)
    movement_type = (data.get('type') or 'in').lower()

    if not product_id:
        return jsonify({'success': False, 'error': 'product_id requis'}), 400

    db = get_db()
    ensure_updated_at_columns(db)
    try:
        if is_duplicate_operation(db, operation_id, 'stock_update'):
            return jsonify({'success': True, 'data': {'duplicate': True, 'operation_id': operation_id}})

        sign = -1 if movement_type in ('out', 'remove', 'decrease', 'sortie') else 1
        db.execute(
            "UPDATE products SET stock_quantity = COALESCE(stock_quantity, 0) + ?, updated_at = ? WHERE id = ?",
            (sign * quantity, datetime.now().isoformat(), product_id)
        )
        db.commit()
        return jsonify({'success': True, 'data': {'product_id': product_id}})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': f'Erreur update stock: {e}'}), 400
    finally:
        db.close()


# ─── EMPLOYEES ────────────────────────────────────────────────────────────────
@app.route('/api/employees')
@require_auth
def get_employees():
    db = get_db()
    rows = db.execute(
        "SELECT id, username, role, is_active, last_login FROM users ORDER BY username"
    ).fetchall()
    db.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


@app.route('/api/attendance', methods=['POST'])
@require_auth
def mark_attendance():
    data = request.json or {}
    operation_id = data.get('operation_id')
    employee_id = data.get('employee_id')
    status = data.get('status') or 'present'

    db = get_db()
    try:
        if is_duplicate_operation(db, operation_id, 'attendance'):
            return jsonify({'success': True, 'data': {'duplicate': True, 'operation_id': operation_id}})
        # Phase 1: endpoint d'acceptation pour ne plus bloquer la file offline.
        return jsonify({'success': True, 'data': {'employee_id': employee_id, 'status': status}})
    finally:
        db.close()


# ─── CLIENTS ──────────────────────────────────────────────────────────────────
@app.route('/api/clients')
@require_auth
def get_clients():
    db = get_db()
    ensure_soft_delete_columns(db)
    search = request.args.get('search', '')
    rows = db.execute(
        "SELECT * FROM clients WHERE name LIKE ? AND deleted_at IS NULL ORDER BY name", (f'%{search}%',)
    ).fetchall()
    db.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


@app.route('/api/clients/<int:client_id>', methods=['DELETE'])
@require_auth
def soft_delete_client(client_id):
    db = get_db()
    ensure_soft_delete_columns(db)
    ensure_updated_at_columns(db)
    try:
        now = datetime.now().isoformat()
        db.execute(
            "UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
            (now, now, client_id)
        )
        db.commit()
        return jsonify({'success': True, 'data': {'id': client_id, 'deleted_at': now}})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': f'Erreur suppression client: {e}'}), 400
    finally:
        db.close()


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
        'success': True,
        'data': {
            'period': period,
            'totalRevenue': float(sales['t']),
            'invoiceCount': sales['c'],
            'topProducts': [dict(r) for r in top_products],
        }
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
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


# ─── HEALTH CHECK / PING ──────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'db': DB_PATH, 'time': datetime.now().isoformat()})


@app.route('/api/ping')
def ping():
    """Endpoint de test de connexion (utilisé par le mobile)"""
    return jsonify({'success': True, 'status': 'online', 'time': datetime.now().isoformat()})


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
    ensure_soft_delete_columns(db)
    ensure_updated_at_columns(db)
    products_has_updated = has_column(db, 'products', 'updated_at')
    products_has_created = has_column(db, 'products', 'created_at')
    clients_has_updated = has_column(db, 'clients', 'updated_at')
    clients_has_created = has_column(db, 'clients', 'created_at')
    sales_has_updated = has_column(db, 'sales', 'updated_at')
    sales_has_created = has_column(db, 'sales', 'created_at')
    result = {
        'success': True,
        'data': {
            'produits': [],
            'clients': [],
            'ventes': [],
            'deleted': {
                'products': [],
                'clients': [],
                'sales': []
            }
        },
        'timestamp': datetime.now().isoformat()
    }
    
    # Récupérer les produits
    try:
        products_query = "SELECT * FROM products WHERE deleted_at IS NULL"
        if since:
            if products_has_updated:
                products_query += " AND (updated_at > ? OR created_at > ?)"
                products = db.execute(products_query, (since, since)).fetchall()
            elif products_has_created:
                products_query += " AND (created_at > ?)"
                products = db.execute(products_query, (since,)).fetchall()
            else:
                products = db.execute(products_query).fetchall()
        else:
            products = db.execute(products_query).fetchall()
        result['data']['produits'] = [dict(p) for p in products]
    except Exception as e:
        result['data']['produits'] = []
        print(f"Erreur lecture produits: {e}")
    
    # Récupérer les clients
    try:
        clients_query = "SELECT * FROM clients WHERE deleted_at IS NULL"
        if since:
            if clients_has_updated:
                clients_query += " AND (updated_at > ? OR created_at > ?)"
                clients = db.execute(clients_query, (since, since)).fetchall()
            elif clients_has_created:
                clients_query += " AND (created_at > ?)"
                clients = db.execute(clients_query, (since,)).fetchall()
            else:
                clients = db.execute(clients_query).fetchall()
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
            WHERE s.deleted_at IS NULL
        """
        if since:
            if sales_has_updated:
                sales_query += " AND (s.updated_at > ? OR s.created_at > ?)"
                sales = db.execute(sales_query, (since, since)).fetchall()
            elif sales_has_created:
                sales_query += " AND (s.created_at > ?)"
                sales = db.execute(sales_query, (since,)).fetchall()
            else:
                sales = db.execute(sales_query).fetchall()
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

    # Récupérer les suppressions logiques (soft delete)
    if since:
        try:
            deleted_products = db.execute(
                "SELECT id, deleted_at FROM products WHERE deleted_at IS NOT NULL AND deleted_at > ?",
                (since,)
            ).fetchall()
            deleted_clients = db.execute(
                "SELECT id, deleted_at FROM clients WHERE deleted_at IS NOT NULL AND deleted_at > ?",
                (since,)
            ).fetchall()
            deleted_sales = db.execute(
                "SELECT id, deleted_at FROM sales WHERE deleted_at IS NOT NULL AND deleted_at > ?",
                (since,)
            ).fetchall()

            result['data']['deleted']['products'] = [dict(r) for r in deleted_products]
            result['data']['deleted']['clients'] = [dict(r) for r in deleted_clients]
            result['data']['deleted']['sales'] = [dict(r) for r in deleted_sales]
        except Exception as e:
            print(f"Erreur lecture suppressions soft delete: {e}")
    
    db.close()
    return jsonify(result)


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
