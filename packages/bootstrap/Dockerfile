FROM node:20-alpine

WORKDIR /usr/src/app

# Copiar el package.json de la raíz y el lockfile de Yarn
COPY package.json yarn.lock ./

# Copiar el package.json del subproyecto bootstrap
COPY packages/bootstrap/package.json ./packages/bootstrap/

# Instalar las dependencias en el contenedor
RUN yarn install --frozen-lockfile || yarn install

# Copiar el resto del código del script de bootstrap
COPY packages/bootstrap ./packages/bootstrap

# Comando por defecto para correr el script
CMD ["node", "packages/bootstrap/index.js"]
