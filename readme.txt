# Agent IA

Ce dossier contient la logique des agents IA pour le profiling et les quiz.

## Configuration

Avant de lancer le serveur, crée un fichier `.env` à la racine du backend avec les informations suivantes :

api_key = "votre api key Gemini"
port = 3000


- **api_key** : la clé API de Gemini pour les agents IA.
- **port** : le port sur lequel vous voulez lancer le serveur (par défaut 3000).

## Lancer le serveur
1. Installer les dépendances :

npm install

2. Lancer le serveur :
cd backend
npx nodemon server.js
