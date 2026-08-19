# ===============================================================================
# Fichier     : Dockerfile
# Rôle        : Recette de conteneurisation de l'interface utilisateur (React/Vite)
# Description :
#    Ce fichier prépare l'environnement d'exécution isolé pour le tableau de bord.
#    Il utilise une image de base Node.js ultra-légère (Alpine), installe les 
#    dépendances listées dans le package.json, copie le code source de l'interface, 
#    et expose le port 5173 pour rendre le serveur Vite accessible depuis 
#    la machine hôte.
# ===============================================================================

# On part d'un mini-serveur Linux avec Node.js
FROM node:20-alpine

# On se place dans le dossier de travail
WORKDIR /app 

# On copie d'abord les fichiers de configuration
COPY package*.json ./

# On installe les bibliothèques React
RUN npm install

# On copie le reste du code
COPY . .

# On ouvre le port standard de Vite
EXPOSE 5173

# Commande pour démarrer le serveur de développement
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]