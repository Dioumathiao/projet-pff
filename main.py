from flask import Flask, send_from_directory, request, jsonify
import subprocess
import threading
import time
import os
import signal
import requests

# Flask app pour servir les fichiers statiques et rediriger vers Node.js
app = Flask(__name__, static_folder='public')

# Variables globales pour le processus Node.js
node_process = None

def start_node_server():
    """Démarre le serveur Node.js en arrière-plan"""
    global node_process
    try:
        node_process = subprocess.Popen(
            ['node', 'server.js'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        print("Serveur Node.js démarré avec PID:", node_process.pid)
        # Attendre un peu pour que le serveur Node.js démarre
        time.sleep(2)
        return True
    except Exception as e:
        print(f"Erreur lors du démarrage du serveur Node.js: {e}")
        return False

def stop_node_server():
    """Arrête le serveur Node.js"""
    global node_process
    if node_process:
        try:
            os.killpg(os.getpgid(node_process.pid), signal.SIGTERM)
            node_process.wait(timeout=5)
        except:
            try:
                os.killpg(os.getpgid(node_process.pid), signal.SIGKILL)
            except:
                pass
        node_process = None

# Démarrer le serveur Node.js au démarrage
def init_app():
    """Initialise l'application"""
    if start_node_server():
        print("Application CycleFem initialisée avec succès")
    else:
        print("Erreur lors de l'initialisation")

# Routes pour servir l'application
@app.route('/')
def serve_index():
    """Sert la page principale"""
    return send_from_directory('public', 'index.html')

@app.route('/login.html')
def serve_login():
    """Sert la page de connexion"""
    return send_from_directory('public', 'login.html')

@app.route('/register.html')
def serve_register():
    """Sert la page d'inscription"""
    return send_from_directory('public', 'register.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Sert les fichiers statiques"""
    return send_from_directory('public', filename)

# Routes API - redirection vers le serveur Node.js
@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_api(path):
    """Redirige les appels API vers le serveur Node.js"""
    try:
        # URL du serveur Node.js (il écoute sur le port 3001 pour éviter les conflits)
        node_url = f'http://localhost:3001/api/{path}'
        
        # Préparer les données de la requête
        data = request.get_json() if request.is_json else None
        headers = {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization', '')
        }
        
        # Faire l'appel vers Node.js
        response = None
        if request.method == 'GET':
            response = requests.get(node_url, headers=headers, params=dict(request.args))
        elif request.method == 'POST':
            response = requests.post(node_url, json=data, headers=headers)
        elif request.method == 'PUT':
            response = requests.put(node_url, json=data, headers=headers)
        elif request.method == 'DELETE':
            response = requests.delete(node_url, headers=headers)
        
        # Retourner la réponse
        if response:
            try:
                return jsonify(response.json()), response.status_code
            except:
                return jsonify({'message': response.text}), response.status_code
        else:
            return jsonify({'error': 'Méthode non supportée'}), 405
        
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Service temporairement indisponible'}), 503
    except Exception as e:
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/health')
def health_check():
    """Vérification de santé de l'application"""
    try:
        # Vérifier si le serveur Node.js répond
        response = requests.get('http://localhost:3001/health', timeout=2)
        if response.status_code == 200:
            return jsonify({'status': 'OK', 'node_server': 'running'}), 200
        else:
            return jsonify({'status': 'ERROR', 'node_server': 'not responding'}), 500
    except:
        return jsonify({'status': 'ERROR', 'node_server': 'not running'}), 500

# Gérer l'arrêt propre
import atexit
atexit.register(stop_node_server)

# Initialiser l'application
init_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)