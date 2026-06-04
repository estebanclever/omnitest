# Sistema Mini de Órdenes de Producción - Desafío Senior Fullstack

Este proyecto es un mini-SaaS para gestionar y reprogramar Órdenes de Producción. Está estructurado como un monorepo usando **Yarn Workspaces** y orquestado de extremo a extremo con **Docker Compose**.

## Descripción de la Arquitectura

El monorepo contiene los siguientes componentes:
- **`apps/frontend`**: Aplicación cliente en Next.js (App Router) con estilos de **Ant Design**.
- **`apps/backend`**: Aplicación servidor en NestJS que contiene una librería dedicada de reprogramación y expone el endpoint de la API.
- **`packages/shared-types`**: Librería compartida que provee interfaces TypeScript unificadas (ej. `ProductionOrder`) para el frontend y el backend.
- **`packages/bootstrap`**: Script de inicio que provisiona automáticamente las colecciones, campos y permisos de Directus.
- **`docker-compose.yml`**: Orquestador principal que levanta la base de datos SQLite, Directus CMS, el backend NestJS, el frontend Next.js y el bootstrapper automático.

---

## Cómo Ejecutar el Proyecto

### Prerrequisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución.
- [Node.js](https://nodejs.org/) (v20+ recomendado) y [Yarn](https://yarnpkg.com/) (instalado globalmente) para ejecutar comandos del workspace o tests de forma local si es necesario.

### Ejecución con Docker Compose
Para construir e iniciar todos los servicios, simplemente ejecuta el siguiente comando en el directorio raíz:

```bash
docker-compose up --build
```

Una vez que todos los contenedores estén corriendo y saludables:
- **Dashboard Frontend**: Abre tu navegador en [http://localhost:3000](http://localhost:3000)
- **API Backend (NestJS)**: Expone sus servicios en [http://localhost:3001](http://localhost:3001)
- **Consola Directus CMS**: Accesible en [http://localhost:8055](http://localhost:8055) (Credenciales: `admin@example.com` / `password`)

---

## Algoritmo de Reprogramación y Casos Borde

La lógica de reprogramación se encuentra en el servicio NestJS en `apps/backend/libs/rescheduling/src/rescheduling.service.ts`. Funciona de la siguiente manera:

1. **Agrupación de Conflictos (Componentes Conectados)**:
   En lugar de ordenar y mover *todas* las órdenes planificadas de forma global, el algoritmo construye una lista de adyacencia (grafo) donde cada arista representa un solapamiento entre dos órdenes. Luego encuentra todos los **componentes conectados** usando Búsqueda en Anchura (BFS). Esto agrupa los conflictos de solapamiento juntos, garantizando que las órdenes sin conflictos no se vean afectadas en absoluto.

2. **Solapamiento de Límites (Exclusivo)**:
   La fórmula de solapamiento usa límites exclusivos: `inicioA < finB && inicioB < finA`. Por ejemplo, si la Orden A termina a las `12:00` y la Orden B comienza a las `12:00`, **no** se consideran solapadas.

3. **Prioridad y Planificación Secuencial**:
   Para cada grupo de conflicto (componentes con 2 o más órdenes):
   - Las órdenes se ordenan por `createdAt` de forma ascendente.
   - Se captura la fecha de inicio más temprana entre todas las órdenes del grupo como ancla de inicio.
   - Las órdenes se planifican secuencialmente (una tras otra) desde el ancla, conservando su duración original (`endDate - startDate`).

4. **Desempate Estable**:
   Si dos órdenes comparten exactamente el mismo timestamp de `createdAt`, el algoritmo recurre a ordenarlas alfabéticamente por su campo `reference`. Esto garantiza una salida determinista.

5. **Eficiencia en la Actualización Masiva**:
   Solo se actualizan las órdenes cuyas fechas de inicio/fin realmente cambian. Las actualizaciones se envían a Directus en una única solicitud `PATCH` masiva para minimizar los viajes de ida y vuelta HTTP.

---

## Ejecución de Tests

Para ejecutar las pruebas unitarias de la librería de reprogramación, ejecuta:

```bash
cd apps/backend
npm run test
```
