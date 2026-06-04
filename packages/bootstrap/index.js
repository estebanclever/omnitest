const axios = require('axios');

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'password';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDirectus() {
  console.log(`Esperando a que Directus esté listo en ${DIRECTUS_URL}...`);
  let attempts = 0;
  while (true) {
    try {
      const response = await axios.get(`${DIRECTUS_URL}/server/ping`);
      if (response.status === 200) {
        console.log('Directus está listo.');
        // Extra delay para asegurar que Directus terminó de inicializar el admin
        await delay(3000);
        break;
      }
    } catch (error) {
      // Ignorar errores de conexión y reintentar
    }
    attempts++;
    console.log(`Intento ${attempts}: Directus aún no está listo, reintentando en 3s...`);
    await delay(3000);
  }
}

async function login() {
  console.log('Iniciando sesión en Directus...');
  const loginRes = await axios.post(`${DIRECTUS_URL}/auth/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const token = loginRes.data.data.access_token;
  console.log('Sesión iniciada correctamente.');
  return axios.create({
    baseURL: DIRECTUS_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function collectionExists(client) {
  try {
    // Listar todas las colecciones y buscar 'production_orders'
    const res = await client.get('/collections');
    const collections = res.data.data || [];
    return collections.some(c => c.collection === 'production_orders');
  } catch (err) {
    console.error('Error al listar colecciones:', err.message);
    return false;
  }
}

async function createCollection(client) {
  console.log('Creando la colección "production_orders"...');
  await client.post('/collections', {
    collection: 'production_orders',
    schema: {},
    meta: {
      icon: 'inventory',
      display_template: '{{reference}} - {{product}}',
      show_in_navigation: true,
    },
    fields: [
      {
        field: 'id',
        type: 'uuid',
        schema: {
          is_primary_key: true,
          has_auto_increment: false,
        },
        meta: {
          interface: 'input',
          readonly: true,
          hidden: true,
          special: ['uuid'],
        },
      },
    ],
  });
  console.log('Colección creada.');
}

async function createFields(client) {
  console.log('Creando campos para "production_orders"...');
  const fields = [
    {
      field: 'reference',
      type: 'string',
      schema: { is_nullable: false },
      meta: { interface: 'input', required: true },
    },
    {
      field: 'product',
      type: 'string',
      schema: { is_nullable: false },
      meta: { interface: 'input', required: true },
    },
    {
      field: 'quantity',
      type: 'integer',
      schema: { is_nullable: false },
      meta: { interface: 'input', required: true },
    },
    {
      field: 'startDate',
      type: 'timestamp',
      schema: { is_nullable: false },
      meta: { interface: 'datetime', required: true },
    },
    {
      field: 'endDate',
      type: 'timestamp',
      schema: { is_nullable: false },
      meta: { interface: 'datetime', required: true },
    },
    {
      field: 'status',
      type: 'string',
      schema: {
        default_value: 'planned',
        is_nullable: false,
      },
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'Planned', value: 'planned' },
            { text: 'Scheduled', value: 'scheduled' },
            { text: 'In Progress', value: 'in_progress' },
            { text: 'Completed', value: 'completed' },
          ],
        },
      },
    },
    {
      field: 'createdAt',
      type: 'timestamp',
      schema: { is_nullable: true },
      meta: {
        interface: 'datetime',
        readonly: true,
        special: ['date-created'],
      },
    },
  ];

  for (const fieldData of fields) {
    try {
      await client.post('/fields/production_orders', fieldData);
      console.log(`  ✓ Campo "${fieldData.field}" creado.`);
    } catch (err) {
      // Si el campo ya existe (409), lo ignoramos
      if (err.response && err.response.status === 409) {
        console.log(`  - Campo "${fieldData.field}" ya existía.`);
      } else {
        throw err;
      }
    }
  }
}

async function createPermissions(client) {
  console.log('Configurando permisos públicos para "production_orders"...');
  const actions = ['create', 'read', 'update', 'delete'];
  for (const action of actions) {
    try {
      await client.post('/permissions', {
        collection: 'production_orders',
        role: null, // null = rol público
        action,
        fields: ['*'],
        permissions: {},
        validation: {},
      });
      console.log(`  ✓ Permiso "${action}" creado.`);
    } catch (err) {
      if (err.response && (err.response.status === 409 || err.response.status === 400)) {
        console.log(`  - Permiso "${action}" ya existía.`);
      } else {
        throw err;
      }
    }
  }
}

async function runBootstrap() {
  try {
    await waitForDirectus();

    const client = await login();

    const exists = await collectionExists(client);
    if (exists) {
      console.log('La colección "production_orders" ya existe. Verificando permisos...');
      await createPermissions(client);
    } else {
      await createCollection(client);
      await createFields(client);
      await createPermissions(client);
    }

    console.log('\n✅ Bootstrap completado con éxito.\n');
  } catch (error) {
    console.error('Error durante el bootstrap de Directus:', error.message);
    if (error.response && error.response.data) {
      console.error('Detalles del error:', JSON.stringify(error.response.data));
    }
    process.exit(1);
  }
}

runBootstrap();
