# backend/auth_utils.py
# Utilitaires pour authentification JWT

import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
import hashlib
import secrets

# Configuration
SECRET_KEY = os.getenv('SECRET_KEY', 'dev_secret_key_change_in_production')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', 24))
JWT_REFRESH_EXPIRATION_DAYS = int(os.getenv('JWT_REFRESH_EXPIRATION_DAYS', 7))


def hash_password(password, salt=None):
    """Hasher un mot de passe avec salt"""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f'{salt}{password}'.encode()).hexdigest()
    return f"{salt}:{hashed}"


def verify_password(stored_hash, password):
    """Vérifier un mot de passe hashé"""
    try:
        salt, _ = stored_hash.split(':')
        computed = hash_password(password, salt)
        return computed == stored_hash
    except Exception:
        return False


def generate_tokens(user_id, username, role):
    """Générer les tokens JWT (access + refresh)"""
    now = datetime.utcnow()
    
    # Access token (court)
    access_token = jwt.encode({
        'user_id': user_id,
        'username': username,
        'role': role,
        'type': 'access',
        'iat': now,
        'exp': now + timedelta(hours=JWT_EXPIRATION_HOURS),
    }, SECRET_KEY, algorithm='HS256')
    
    # Refresh token (long)
    refresh_token = jwt.encode({
        'user_id': user_id,
        'username': username,
        'type': 'refresh',
        'iat': now,
        'exp': now + timedelta(days=JWT_REFRESH_EXPIRATION_DAYS),
    }, SECRET_KEY, algorithm='HS256')
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'expires_in': int(JWT_EXPIRATION_HOURS * 3600),
    }


def verify_token(token):
    """Vérifier et décoder un token JWT"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    """Décorateur pour protéger les routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not token:
            return jsonify({
                'success': False,
                'error': 'Token manquant',
                'code': 'NO_TOKEN'
            }), 401
        
        payload = verify_token(token)
        
        if not payload:
            return jsonify({
                'success': False,
                'error': 'Token invalide ou expiré',
                'code': 'INVALID_TOKEN'
            }), 401
        
        if payload.get('type') != 'access':
            return jsonify({
                'success': False,
                'error': 'Type de token invalide',
                'code': 'INVALID_TOKEN_TYPE'
            }), 401
        
        request.current_user = payload
        return f(*args, **kwargs)
    
    return decorated


def require_role(*roles):
    """Décorateur pour vérifier les rôles"""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.current_user.get('role') not in roles:
                return jsonify({
                    'success': False,
                    'error': 'Accès refusé',
                    'code': 'FORBIDDEN'
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
