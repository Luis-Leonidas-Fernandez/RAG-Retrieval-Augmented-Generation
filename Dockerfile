FROM node:20-alpine

WORKDIR /app

# Instalar dependencias (incluye devDependencies para poder usar nodemon en desarrollo)
COPY package*.json ./
RUN npm install --production=false

# Copiar el resto del código
COPY . .

# Exponer el puerto donde levanta el backend
EXPOSE 3000

# Comando por defecto: modo desarrollo con nodemon (definido en package.json)
CMD ["npm", "run", "dev"]


