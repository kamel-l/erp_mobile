
import threading
import sys
import os

# Add the project path to sys.path
sys.path.append(r'd:\Downloads\PycharmProjects\ERP_Simple_PyQt')

from db_manager import get_database

# 1. Create in main thread
db_main = get_database()
print("Main thread: database initialized")

def test_ping():
    try:
        # 2. Try to use in another thread
        db = get_database()
        company = db.get_setting("company_name", "DAR ELSSALEM")
        print(f"SUCCESS in thread: {company}")
    except Exception as e:
        print(f"ERROR in thread: {type(e).__name__}: {e}")

# Run in a thread to simulate Flask
t = threading.Thread(target=test_ping)
t.start()
t.join()
