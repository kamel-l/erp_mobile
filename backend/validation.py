# backend/validation.py
# Validation des inputs

import re
from typing import Dict, List, Tuple


def validate_email(email: str) -> Tuple[bool, str]:
    """Valider une adresse email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not email or not re.match(pattern, email):
        return False, 'Email invalide'
    return True, ''


def validate_phone(phone: str) -> Tuple[bool, str]:
    """Valider un numéro de téléphone"""
    # Simple: au moins 10 chiffres
    digits = re.sub(r'\D', '', phone)
    if len(digits) < 10:
        return False, 'Téléphone invalide (min 10 chiffres)'
    return True, ''


def validate_username(username: str) -> Tuple[bool, str]:
    """Valider un nom d'utilisateur"""
    if len(username) < 3:
        return False, 'Minimum 3 caractères'
    if len(username) > 50:
        return False, 'Maximum 50 caractères'
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, 'Caractères valides: a-z, A-Z, 0-9, _, -'
    return True, ''


def validate_password(password: str) -> Tuple[bool, str]:
    """Valider un mot de passe"""
    if len(password) < 6:
        return False, 'Minimum 6 caractères'
    if len(password) > 100:
        return False, 'Maximum 100 caractères'
    return True, ''


def validate_product_data(data: Dict) -> Tuple[bool, Dict]:
    """Valider les données d'un produit"""
    errors = {}
    
    # Nom
    name = data.get('name', '').strip()
    if not name or len(name) < 2 or len(name) > 100:
        errors['name'] = 'Nom: 2-100 caractères'
    
    # Code barre
    barcode = data.get('barcode', '').strip()
    if not barcode or len(barcode) > 50:
        errors['barcode'] = 'Code barre invalide'
    
    # Prix
    try:
        price = float(data.get('price', 0))
        if price <= 0:
            errors['price'] = 'Prix doit être positif'
    except (ValueError, TypeError):
        errors['price'] = 'Prix invalide'
    
    # Stock
    try:
        stock = int(data.get('stock_quantity', 0))
        if stock < 0:
            errors['stock_quantity'] = 'Stock ne peut être négatif'
    except (ValueError, TypeError):
        errors['stock_quantity'] = 'Stock invalide'
    
    return len(errors) == 0, errors


def validate_client_data(data: Dict) -> Tuple[bool, Dict]:
    """Valider les données d'un client"""
    errors = {}
    
    # Nom
    name = data.get('name', '').strip()
    if not name or len(name) < 2 or len(name) > 100:
        errors['name'] = 'Nom: 2-100 caractères'
    
    # Email
    email = data.get('email', '').strip()
    if email:
        is_valid, msg = validate_email(email)
        if not is_valid:
            errors['email'] = msg
    
    # Téléphone
    phone = data.get('phone', '').strip()
    if phone:
        is_valid, msg = validate_phone(phone)
        if not is_valid:
            errors['phone'] = msg
    
    return len(errors) == 0, errors


def sanitize_string(s: str, max_length: int = 255) -> str:
    """Nettoyer une chaîne"""
    if not isinstance(s, str):
        return ''
    return s.strip()[:max_length]
