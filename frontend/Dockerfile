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