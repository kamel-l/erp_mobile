
import threading
import sys
import os

# Add the project path to sys.path
sys.path.append(r'd:\Downloads\PycharmProjects\ERP_Simple_PyQt')

from db_manager import get_database

def test_ping():
    try:
        db = get_database()
        company = db.get_setting("company_name", "DAR ELSSALEM")
        print(f"SUCCESS: {company}")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")

# Run in a thread to simulate Flask
t = threading.Thread(target=test_ping)
t.start()
t.join()
