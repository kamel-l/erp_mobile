import sys

filepath = r'd:\Downloads\PycharmProjects\ERP_Simple_PyQt\api_server_secure.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("DB_PATH = os.getenv('DB_PATH', '../erp_database.db')", "DB_PATH = os.getenv('DB_PATH', 'erp_database.db')")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully updated DB_PATH')
