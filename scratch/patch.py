import sys
import os

filepath = r'd:\Downloads\PycharmProjects\ERP_Simple_PyQt\api_server_secure.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

injection = '''
import threading

_server_thread = None
_server_running = False

def start_api_server(port=5000, token=None):
    global _server_thread, _server_running
    if _server_running:
        print(f"✔️ Serveur API Sécurisé déjà en cours sur le port {port}")
        return

    def run():
        global _server_running
        _server_running = True
        print(f"[API] Serveur API Sécurisé démarré -> port {port}")
        app.run(host=os.getenv('HOST', '0.0.0.0'), port=port, debug=False, use_reloader=False, threaded=True)

    _server_thread = threading.Thread(target=run, daemon=True)
    _server_thread.start()

def is_running():
    return _server_running

'''

if 'def start_api_server' not in content:
    content = content.replace("if __name__ == '__main__':", injection + "if __name__ == '__main__':")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Successfully injected start_api_server')
else:
    print('start_api_server already exists')
