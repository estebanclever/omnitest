# Etapa 1: Compilación
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json yarn.lock tsconfig.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/frontend/package.json ./apps/frontend/

RUN yarn install --frozen-lockfile || yarn install

COPY packages/shared-types ./packages/shared-types
COPY apps/frontend ./apps/frontend

# Argumentos de compilación para que Next.js los grabe en el bundle estático del cliente
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_DIRECTUS_URL=http://localhost:8055

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DIRECTUS_URL=$NEXT_PUBLIC_DIRECTUS_URL

# Compilar tipos y Next.js
RUN yarn workspace @omnitest/shared-types build
RUN yarn workspace frontend build

# Etapa 2: Servidor final de producción
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/frontend/package.json ./apps/frontend/

RUN yarn install --production --frozen-lockfile || yarn install --production

# Copiar archivos compilados y estáticos
COPY --from=builder /usr/src/app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /usr/src/app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /usr/src/app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

CMD ["yarn", "workspace", "frontend", "start"]
