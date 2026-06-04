# Etapa 1: Compilación
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copiar archivos de dependencias de la raíz y subproyectos
COPY package.json yarn.lock tsconfig.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/

# Instalar todas las dependencias
RUN yarn install --frozen-lockfile || yarn install

# Copiar el código fuente de los proyectos necesarios
COPY packages/shared-types ./packages/shared-types
COPY apps/backend ./apps/backend

# Compilar tipos compartidos primero y luego el backend
RUN yarn workspace @omnitest/shared-types build
RUN yarn workspace backend build

# Etapa 2: Imagen final de producción
FROM node:20-alpine

WORKDIR /usr/src/app

# Copiar package.json y lockfile
COPY package.json yarn.lock ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/backend/package.json ./apps/backend/

# Instalar solo dependencias de producción
RUN yarn install --production --frozen-lockfile || yarn install --production

# Copiar el código compilado desde la etapa de construcción
COPY --from=builder /usr/src/app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /usr/src/app/apps/backend/dist ./apps/backend/dist

EXPOSE 3001

CMD ["node", "apps/backend/dist/main.js"]
