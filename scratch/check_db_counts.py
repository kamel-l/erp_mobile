import sqlite3
import os

def check_db(path):
    print(f"\nChecking database: {path}")
    if not os.path.exists(path):
        print("File does not exist.")
        return
    
    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        
        # Get list of tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Tables: {tables}")
        
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"Table '{table}': {count} records")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

check_db("erp_database.db")
check_db("erp.db")
check_db(r"d:\Downloads\PycharmProjects\ERP_Simple_PyQt\erp_database.db")
