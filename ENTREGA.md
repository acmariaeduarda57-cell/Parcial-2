# Voltio · Taller de Reparaciones — entrega de código

## 1. Estructura de carpetas

```text
Parcial-2/
├── backend/
│   ├── pb_migrations/
│   │   ├── 1782000000_esquema.js
│   │   ├── 1782000001_demostracion.js
│   │   └── 1782000002_sin_cuentas.js
│   └── pb_hooks/
│       ├── flujo.js
│       └── ordenes.pb.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── CambioEstado.jsx
│   │   │   ├── CampoFotos.jsx
│   │   │   ├── ClienteDialog.jsx
│   │   │   ├── Icono.jsx
│   │   │   ├── Monitor.jsx
│   │   │   ├── Presupuesto.jsx
│   │   │   ├── TablaOrdenes.jsx
│   │   │   └── UI.jsx
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   ├── taller.js
│   │   │   └── useLectura.js
│   │   ├── pages/
│   │   │   ├── Clientes.jsx
│   │   │   ├── Detalle.jsx
│   │   │   ├── NoEncontrada.jsx
│   │   │   ├── NuevaOrden.jsx
│   │   │   ├── Ordenes.jsx
│   │   │   └── Resumen.jsx
│   │   └── styles.css
│   ├── public/
│   │   ├── osciloscopio.svg
│   │   ├── voltio.svg
│   │   └── fonts/
│   │       ├── manrope-latin.woff2
│   │       └── OFL.txt
│   └── package-lock.json
├── tests/
│   └── api.test.mjs
├── scripts/
│   └── entrega.mjs
├── .gitignore
├── README.md
└── ENTREGA.md
```

El archivo **[README.md](./README.md)** incluye instalación desde cero, datos de prueba y comandos de verificación. El ejecutable de PocketBase, `pb_data`, `node_modules` y `dist` no se versionan.

## 2. Backend · PocketBase 0.40.6

Las migraciones definen el esquema, los permisos y los datos iniciales. Los hooks de modelo validan la transición y escriben el evento en la misma transacción; los hooks HTTP completan la validación del presupuesto y protegen el historial. Los diez casos de integración al final de esta sección se ejecutan sin pasar por React.

### `backend/pb_migrations/1782000000_esquema.js`

```javascript
// PocketBase >= 0.23: fields, no schema. Relacionamos por ID de colección, no por nombre.
migrate(
  (app) => {
    const texto = (name, max) => ({ name, type: 'text', required: true, pattern: '\\S', max })
    const relacion = (name, destino) => ({
      name,
      type: 'relation',
      collectionId: destino.id,
      required: true,
      maxSelect: 1,
      cascadeDelete: false,
    })
    // "" permite la operación sin sesión; null la reserva a la administración de PB.
    const permisos = {
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: null,
    }
    const clientes = new Collection({
      name: 'clientes',
      type: 'base',
      ...permisos,
      fields: [texto('nombre', 120), texto('telefono', 40)],
    })
    app.save(clientes)

    const ordenes = new Collection({
      name: 'ordenes',
      type: 'base',
      ...permisos,
      fields: [
        relacion('cliente', clientes),
        texto('equipo', 160),
        texto('problema', 4000),
        {
          name: 'estado',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'solicitada',
            'en_diagnostico',
            'presupuestada',
            'aprobada',
            'rechazada',
            'en_reparacion',
            'lista',
            'entregada',
            'cancelada',
          ],
        },
        { name: 'diagnostico', type: 'text', max: 4000 },
        { name: 'manoObra', type: 'number', min: 0 },
        { name: 'piezas', type: 'json', maxSize: 65536 },
        {
          name: 'fotos',
          type: 'file',
          maxSelect: 3,
          maxSize: 5 * 1024 * 1024,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
      ],
    })
    app.save(ordenes)

    app.save(
      new Collection({
        name: 'eventos',
        type: 'base',
        ...permisos,
        // Ni siquiera el alta es pública: solo el código de servidor escribe el historial.
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          relacion('orden', ordenes),
          { name: 'de', type: 'text' },
          texto('a', 32),
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE INDEX idx_eventos_orden ON eventos (orden, created)'],
      })
    )
  },
  (app) => {
    for (const nombre of ['eventos', 'ordenes', 'clientes']) {
      app.delete(app.findCollectionByNameOrId(nombre))
    }
  }
)
```


### `backend/pb_migrations/1782000001_demostracion.js`

```javascript
// Una migración se aplica una sola vez. Los ejemplos recorren los hooks reales;
// no inventamos eventos ni insertamos directamente una orden ya presupuestada.
migrate(
  (app) => {
    function insertar(coleccion, datos) {
      const r = new Record(app.findCollectionByNameOrId(coleccion))
      r.load(datos)
      app.save(r)
      return r.id
    }
    function avanzar(id, estado, presupuesto = {}) {
      const r = app.findRecordById('ordenes', id)
      r.load({ estado, ...presupuesto })
      app.save(r)
    }
    const lucia = insertar('clientes', {
      id: 'democt000000001',
      nombre: 'Lucía Torres',
      telefono: '600 000 101',
    })
    const mateo = insertar('clientes', {
      id: 'democt000000002',
      nombre: 'Mateo Ruiz',
      telefono: '600 000 102',
    })
    const monitor = insertar('ordenes', {
      id: 'demoot000000001',
      cliente: lucia,
      equipo: 'Dell UltraSharp 27″',
      problema: 'El monitor se apaga a los pocos segundos de encenderlo.',
    })
    avanzar(monitor, 'en_diagnostico')
    avanzar(monitor, 'presupuestada', {
      diagnostico: 'Dos condensadores de la fuente están deteriorados.',
      manoObra: 45,
      piezas: [{ descripcion: 'Condensador de la fuente', cantidad: 2, precio: 4.5 }],
    })
    avanzar(monitor, 'aprobada')
    avanzar(monitor, 'en_reparacion')
    const consola = insertar('ordenes', {
      id: 'demoot000000002',
      cliente: mateo,
      equipo: 'Sony PlayStation 5',
      problema: 'Se enciende, pero no muestra imagen por HDMI.',
    })
    avanzar(consola, 'en_diagnostico')
    avanzar(consola, 'presupuestada', {
      diagnostico: 'El conector HDMI está dañado. Es necesario sustituirlo.',
      manoObra: 65,
      piezas: [{ descripcion: 'Conector HDMI', cantidad: 1, precio: 12.5 }],
    })
    insertar('ordenes', {
      id: 'demoot000000003',
      cliente: lucia,
      equipo: 'MacBook Air M1',
      problema: 'No carga la batería al conectar el adaptador USB-C.',
    })
  },
  (app) => {
    for (const id of ['demoot000000003', 'demoot000000002', 'demoot000000001']) {
      for (const e of app.findAllRecords('eventos', $dbx.hashExp({ orden: id }))) app.delete(e)
      app.delete(app.findRecordById('ordenes', id))
    }
    for (const id of ['democt000000002', 'democt000000001'])
      app.delete(app.findRecordById('clientes', id))
  }
)
```


### `backend/pb_migrations/1782000002_sin_cuentas.js`

```javascript
// La distribución oficial incluye la plantilla «users» con registro público por defecto.
// En una instalación nueva de este taller no hay altas de usuarios ni login de aplicación.
migrate(
  (app) => {
    const plantilla = app.findCollectionByNameOrId('_pb_users_auth_')
    plantilla.createRule = null
    plantilla.authRule = null
    app.save(plantilla)
  },
  (app) => {
    const plantilla = app.findCollectionByNameOrId('_pb_users_auth_')
    plantilla.createRule = ''
    plantilla.authRule = ''
    app.save(plantilla)
  }
)
```


### `backend/pb_hooks/flujo.js`

```javascript
// Módulo de dominio para el motor JS de PocketBase. No depende del cuerpo HTTP ni de React.
const pasos = {
  solicitada: ['en_diagnostico', 'cancelada'],
  en_diagnostico: ['presupuestada'],
  presupuestada: ['aprobada', 'rechazada'],
  aprobada: ['en_reparacion'],
  en_reparacion: ['lista'],
  lista: ['entregada'],
  entregada: [],
  rechazada: [],
  cancelada: [],
}
const rechazar = (mensaje) => {
  throw new BadRequestError(mensaje)
}
const piezasDe = (r) => JSON.parse(r.getString('piezas') || 'null')
const importe = (v) =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= 0 &&
  Number.isSafeInteger(Math.round(v * 100)) &&
  Math.round(v * 100) / 100 === v

function validarPresupuesto(r) {
  if (!r.getString('diagnostico').trim()) rechazar('Escribe el diagnóstico antes de presupuestar.')
  const mano = r.getFloat('manoObra')
  if (!importe(mano))
    rechazar('La mano de obra debe ser un importe no negativo con hasta dos decimales.')
  const piezas = piezasDe(r)
  if (!Array.isArray(piezas)) rechazar('Piezas debe ser una lista, aunque esté vacía.')
  let centimos = Math.round(mano * 100)
  for (const p of piezas) {
    if (
      !p ||
      typeof p !== 'object' ||
      Array.isArray(p) ||
      Object.keys(p).length !== 3 ||
      typeof p.descripcion !== 'string' ||
      !p.descripcion.trim() ||
      !Number.isSafeInteger(p.cantidad) ||
      p.cantidad < 1 ||
      !importe(p.precio)
    ) {
      rechazar(
        'Cada pieza necesita descripción, cantidad entera positiva y precio válido en euros.'
      )
    }
    centimos += p.cantidad * Math.round(p.precio * 100)
  }
  if (!Number.isSafeInteger(centimos)) rechazar('El importe excede la precisión admitida.')
}

function prepararAlta(r) {
  const estado = r.getString('estado')
  if (estado && estado !== 'solicitada') rechazar('Una orden nueva solo puede estar solicitada.')
  const piezas = piezasDe(r)
  if (
    r.getString('diagnostico') ||
    r.getFloat('manoObra') !== 0 ||
    (piezas !== null && !(Array.isArray(piezas) && piezas.length === 0))
  ) {
    rechazar('No se admite un presupuesto al dar de alta la orden.')
  }
  r.set('estado', 'solicitada')
  r.set('piezas', [])
}

function validarCambio(actual, propuesta) {
  const de = actual.getString('estado'),
    a = propuesta.getString('estado')
  if (de !== propuesta.original().getString('estado')) {
    throw new ApiError(409, 'Otra operación cambió la etapa. Vuelve a leer la orden.')
  }
  if (!pasos[de].length) rechazar('La orden está cerrada y no admite cambios.')
  if (de !== a && !pasos[de].includes(a)) rechazar(`Transición no permitida: ${de} → ${a}.`)
  if (de !== a && a === 'presupuestada') {
    validarPresupuesto(propuesta)
  } else if (
    actual.getString('diagnostico') !== propuesta.getString('diagnostico') ||
    actual.getFloat('manoObra') !== propuesta.getFloat('manoObra') ||
    JSON.stringify(piezasDe(actual)) !== JSON.stringify(piezasDe(propuesta))
  ) {
    // Comparamos registros efectivos: también cubre PATCH parciales y modificadores de PB.
    rechazar('El presupuesto solo puede registrarse en el paso a presupuestada.')
  }
}

function guardar(e, esAlta) {
  const app = e.app
  try {
    // Leer, validar, persistir y auditar en la MISMA transacción. No usar $app aquí:
    // un after-success independiente dejaría la orden sin evento ante un fallo de escritura.
    app.runInTransaction((tx) => {
      e.app = tx
      let de = ''
      if (esAlta) prepararAlta(e.record)
      else {
        const actual = tx.findRecordById('ordenes', e.record.id)
        validarCambio(actual, e.record)
        de = actual.getString('estado')
      }
      const a = e.record.getString('estado')
      e.next() // Ejecuta las validaciones de campos y la escritura normal de PocketBase.
      if (de !== a) {
        const evento = new Record(tx.findCollectionByNameOrId('eventos'))
        evento.load({ orden: e.record.id, de, a })
        tx.save(evento)
      }
    })
  } finally {
    e.app = app
  }
}
module.exports = { guardar }
```


### `backend/pb_hooks/ordenes.pb.js`

```javascript
// Cada callback de JSVM tiene su propio contexto. Se carga el módulo DENTRO del hook.
onRecordCreate((e) => require(`${__hooks}/flujo.js`).guardar(e, true), 'ordenes')
onRecordUpdate((e) => require(`${__hooks}/flujo.js`).guardar(e, false), 'ordenes')

onRecordUpdateRequest((e) => {
  if (
    e.record.getString('estado') === 'presupuestada' &&
    e.record.original().getString('estado') === 'en_diagnostico'
  ) {
    // requestInfo().body ya contiene valores normalizados por PB. Volvemos a leer el
    // cuerpo tipado: una cadena inválida o null NO deben convertirse en trabajo gratuito.
    const b = new DynamicModel({ diagnostico: '', manoObra: nullFloat(), piezas: nullArray() })
    const mensaje = 'Envía diagnóstico, mano de obra numérica y lista de piezas juntos.'
    try {
      e.bindBody(b)
    } catch {
      throw new BadRequestError(mensaje)
    }
    if (!b.diagnostico.trim() || b.manoObra == null || b.piezas == null)
      throw new BadRequestError(mensaje)
  }
  e.next()
}, 'ordenes')

// Las reglas null ya cierran la API anónima. Estos candados HTTP también alcanzan
// una petición del panel administrativo, sin impedir la reversión de las migraciones.
const soloHistorialDelServidor = () => {
  throw new ForbiddenError('El historial solo lo escribe el servidor.')
}
onRecordCreateRequest(soloHistorialDelServidor, 'eventos')
onRecordUpdateRequest(soloHistorialDelServidor, 'eventos')
onRecordDeleteRequest(soloHistorialDelServidor, 'eventos')
onRecordDeleteRequest(() => {
  throw new ForbiddenError('Las órdenes se conservan y no se pueden borrar.')
}, 'ordenes')
```


### `tests/api.test.mjs`

```javascript
// Integración de caja negra: binario real, base temporal, fetch anónimo y ningún SDK.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = fileURLToPath(new URL('../backend/', import.meta.url))
const local = path.join(backend, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')
const bin = process.env.POCKETBASE_BIN || (existsSync(local) ? local : 'pocketbase')
let temporal, servidor, base
before(async () => {
  temporal = await mkdtemp(path.join(tmpdir(), 'voltio-test-'))
  const hooks = path.join(temporal, 'pb_hooks')
  await cp(path.join(backend, 'pb_hooks'), hooks, { recursive: true })
  // Fallo controlado EXCLUSIVO de la base desechable para demostrar el rollback de la orden.
  await writeFile(
    path.join(hooks, 'fallo.pb.js'),
    `onRecordCreate((e) => {
    if (e.record.getString('orden') === 'pruebarollback1' && e.record.getString('a') === 'cancelada') {
      throw new BadRequestError('Fallo de auditoría de prueba.');
    }
    e.next();
  }, 'eventos')`
  )
  const socket = createServer().listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const host = `127.0.0.1:${socket.address().port}`
  await new Promise((resolve) => socket.close(resolve))
  base = `http://${host}/api/collections/`
  servidor = spawn(
    bin,
    [
      'serve',
      `--http=${host}`,
      `--dir=${path.join(temporal, 'pb_data')}`,
      `--hooksDir=${hooks}`,
      `--migrationsDir=${path.join(backend, 'pb_migrations')}`,
      '--hooksWatch=false',
    ],
    { cwd: temporal, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('PocketBase no arrancó en 15 segundos.')),
      15000
    )
    servidor.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    servidor.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`PocketBase terminó (${code}).`))
    })
    servidor.stdout.on('data', (s) => {
      if (s.toString().includes('Server started at')) {
        clearTimeout(timer)
        resolve()
      }
    })
    servidor.stderr.on('data', (s) => process.stderr.write(s))
  })
})
after(async () => {
  if (servidor?.pid && servidor.exitCode === null) {
    const fin = once(servidor, 'exit')
    servidor.kill()
    await fin
  }
  if (temporal) await rm(temporal, { recursive: true, force: true })
})
async function api(col, method = 'GET', body, sufijo = '') {
  const json = body !== undefined && !(body instanceof FormData)
  const res = await fetch(`${base}${col}/records${sufijo}`, {
    method,
    headers: json ? { 'Content-Type': 'application/json' } : undefined,
    body: json ? JSON.stringify(body) : body,
  })
  return { status: res.status, data: await res.json() }
}
function exigir(r, status = 200) {
  assert.equal(r.status, status, JSON.stringify(r.data))
  return r.data
}
const datos = { cliente: 'democt000000001', equipo: 'Equipo de prueba', problema: 'No enciende.' }
const presupuesto = {
  diagnostico: 'Conector deteriorado.',
  manoObra: 28.5,
  piezas: [{ descripcion: 'Conector', cantidad: 2, precio: 4.25 }],
}
const crear = async (extra) => exigir(await api('ordenes', 'POST', { ...datos, ...extra }))
const patch = (id, data) => api('ordenes', 'PATCH', data, `/${id}`)
const avanzar = async (id, estado, extra) => exigir(await patch(id, { estado, ...extra }))
const leer = async (id) => exigir(await api('ordenes', 'GET', undefined, `/${id}`))
const eventos = async (id) =>
  exigir(
    await api(
      'eventos',
      'GET',
      undefined,
      '?' + new URLSearchParams({ filter: `orden="${id}"`, sort: 'created' })
    )
  ).items

test('la instalación limpia contiene dos clientes y tres órdenes con trazabilidad', async () => {
  assert.equal(exigir(await api('clientes')).totalItems, 2)
  const ordenes = exigir(await api('ordenes', 'GET', undefined, '?expand=cliente')).items
  assert.deepEqual(ordenes.map((o) => o.estado).sort(), [
    'en_reparacion',
    'presupuestada',
    'solicitada',
  ])
  for (const o of ordenes) {
    assert.ok(o.expand.cliente.nombre)
    assert.equal('total' in o, false)
    const h = await eventos(o.id)
    let de = ''
    for (let i = 0; i < h.length; i++) {
      const e = h.find((e) => e.de === de)
      assert.ok(e?.created)
      de = e.a
    }
    assert.equal(de, o.estado)
  }
})
test('los clientes son contactos, sin registro público de cuentas', async () => {
  exigir(await api('users', 'POST', {}), 403)
  const c = exigir(
    await api('clientes', 'POST', { nombre: 'Contacto de prueba', telefono: '600 000 103' })
  )
  exigir(await api('clientes', 'PATCH', { telefono: '600 000 104' }, `/${c.id}`))
  assert.equal(exigir(await api('clientes', 'GET', undefined, `/${c.id}`)).telefono, '600 000 104')
})
test('el alta valida la relación y no admite estados adelantados ni presupuesto', async () => {
  for (const extra of [
    { cliente: '' },
    { cliente: 'noexiste0000001' },
    { equipo: ' ' },
    { estado: 'aprobada' },
    { diagnostico: 'Prematuro' },
    { manoObra: 5 },
    { piezas: presupuesto.piezas },
  ]) {
    exigir(await api('ordenes', 'POST', { ...datos, ...extra }), 400)
  }
  const o = await crear()
  assert.equal(o.estado, 'solicitada')
  assert.deepEqual(o.piezas, [])
  exigir(await patch(o.id, { problema: 'No recibe alimentación.' }))
  assert.equal((await eventos(o.id)).length, 1, 'Un cambio sin transición no inventa eventos.')
})
test('flujo completo; presupuesto indivisible, validado y congelado tras su registro', async () => {
  const { id } = await crear()
  exigir(await patch(id, { estado: 'lista' }), 400)
  exigir(await patch(id, { manoObra: 7 }), 400)
  await avanzar(id, 'en_diagnostico')
  exigir(await patch(id, { estado: 'cancelada' }), 400)
  exigir(await patch(id, { estado: 'presupuestada', diagnostico: 'Sin importes' }), 400)
  for (const extra of [
    { diagnostico: ' ' },
    { manoObra: -1 },
    { manoObra: 'abc' },
    { manoObra: null },
    { piezas: {} },
    { piezas: [null] },
    ...[
      { descripcion: '' },
      { cantidad: 0 },
      { cantidad: 1.5 },
      { precio: -1 },
      { precio: '5' },
    ].map((c) => ({ piezas: [{ ...presupuesto.piezas[0], ...c }] })),
  ]) {
    exigir(await patch(id, { estado: 'presupuestada', ...presupuesto, ...extra }), 400)
  }
  assert.equal((await leer(id)).estado, 'en_diagnostico')
  assert.equal((await eventos(id)).length, 2)
  await avanzar(id, 'presupuestada', presupuesto)
  for (const campos of [
    { diagnostico: 'Cambio' },
    { manoObra: 0 },
    { piezas: [] },
    { estado: 'aprobada', 'manoObra+': 1 },
  ])
    exigir(await patch(id, campos), 400)
  for (const s of ['aprobada', 'en_reparacion', 'lista', 'entregada']) await avanzar(id, s)
  exigir(await patch(id, { estado: 'lista' }), 400)
  exigir(await patch(id, { equipo: 'Otro' }), 400)
  const final = await leer(id)
  assert.equal(final.manoObra, presupuesto.manoObra)
  assert.deepEqual(final.piezas, presupuesto.piezas)
  const camino = [
    '',
    'solicitada',
    'en_diagnostico',
    'presupuestada',
    'aprobada',
    'en_reparacion',
    'lista',
    'entregada',
  ]
  const h = await eventos(id)
  assert.equal(h.length, camino.length - 1)
  for (const [i, a] of camino.slice(1).entries())
    assert.ok(h.some((e) => e.de === camino[i] && e.a === a && e.orden === id && e.created))
})
test('cancelación solo antes del diagnóstico; rechazo y cancelación son terminales', async () => {
  const a = await crear(),
    b = await crear()
  await avanzar(a.id, 'cancelada')
  exigir(await patch(a.id, { estado: 'en_diagnostico' }), 400)
  await avanzar(b.id, 'en_diagnostico')
  await avanzar(b.id, 'presupuestada', { ...presupuesto, manoObra: 0, piezas: [] })
  await avanzar(b.id, 'rechazada')
  exigir(await patch(b.id, { estado: 'aprobada' }), 400)
  assert.equal((await eventos(a.id)).length, 2)
  assert.equal((await eventos(b.id)).length, 4)
})
test('API pública: historial de solo lectura y órdenes sin DELETE', async () => {
  const { id } = await crear(),
    [alta] = await eventos(id)
  exigir(await api('eventos', 'POST', { orden: id, de: 'solicitada', a: 'lista' }), 403)
  exigir(await api('eventos', 'PATCH', { a: 'lista' }, `/${alta.id}`), 403)
  exigir(await api('eventos', 'DELETE', undefined, `/${alta.id}`), 403)
  exigir(await api('ordenes', 'DELETE', undefined, `/${id}`), 403)
  assert.equal((await eventos(id)).length, 1)
  assert.equal((await leer(id)).estado, 'solicitada')
})
test('dos cambios simultáneos desde solicitada no bifurcan el historial', async () => {
  const { id } = await crear()
  const rs = await Promise.all([
    patch(id, { estado: 'en_diagnostico' }),
    patch(id, { estado: 'cancelada' }),
  ])
  assert.equal(rs.filter((r) => r.status === 200).length, 1)
  assert.ok(rs.some((r) => [400, 409].includes(r.status)))
  const h = await eventos(id)
  assert.equal(h.length, 2)
  assert.equal(h.find((e) => e.de === 'solicitada').a, (await leer(id)).estado)
})
test('si el evento no se guarda, tampoco cambia la orden', async () => {
  const { id } = await crear({ id: 'pruebarollback1' })
  exigir(await patch(id, { estado: 'cancelada' }), 400)
  assert.equal((await leer(id)).estado, 'solicitada')
  assert.equal((await eventos(id)).length, 1)
})
test('PocketBase limita a tres imágenes y valida el tipo de archivo', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4z8AAAAASUVORK5CYII=',
    'base64'
  )
  function form(n, valido = true) {
    const f = new FormData()
    for (const [k, v] of Object.entries(datos)) f.set(k, v)
    for (let i = 0; i < n; i++)
      f.append('fotos', new Blob([valido ? png : 'texto plano']), `foto${i}.png`)
    return f
  }
  exigir(await api('ordenes', 'POST', form(4)), 400)
  exigir(await api('ordenes', 'POST', form(1, false)), 400)
  const o = exigir(await api('ordenes', 'POST', form(3)))
  assert.equal(o.fotos.length, 3)
  assert.equal((await eventos(o.id)).length, 1)
})

test('la matriz completa rechaza todos los destinos no permitidos en cada etapa', async () => {
  // Oráculo del enunciado, no se importa la implementación que estamos evaluando.
  const destinos = {
    solicitada: ['en_diagnostico', 'cancelada'],
    en_diagnostico: ['presupuestada'],
    presupuestada: ['aprobada', 'rechazada'],
    aprobada: ['en_reparacion'],
    en_reparacion: ['lista'],
    lista: ['entregada'],
    entregada: [],
    rechazada: [],
    cancelada: [],
  }
  // El grafo es un árbol: cada estado salvo el inicial tiene un único predecesor.
  async function enEstado(s) {
    if (s === 'solicitada') return (await crear()).id
    const previo = Object.keys(destinos).find((k) => destinos[k].includes(s))
    const id = await enEstado(previo)
    await avanzar(id, s, s === 'presupuestada' ? presupuesto : {})
    return id
  }
  for (const [de, permitidos] of Object.entries(destinos)) {
    const id = await enEstado(de),
      antes = (await eventos(id)).length
    for (const a of Object.keys(destinos)) {
      if (a !== de && !permitidos.includes(a)) {
        exigir(await patch(id, { estado: a, ...(a === 'presupuestada' ? presupuesto : {}) }), 400)
      }
    }
    assert.equal((await leer(id)).estado, de)
    assert.equal((await eventos(id)).length, antes)
  }
})
```


## 3. Frontend · React, Vite y react-router

El menú conserva su layout y cada página lee datos reales con `fetch`. El detalle usa `/ordenes/:id`; tras escribir vuelve a pedir la orden con sus relaciones, sin deducir el estado desde la respuesta del formulario.

### `frontend/package.json`

```json
{
  "name": "voltio-taller",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "19.2.9",
    "react-dom": "19.2.9",
    "react-router": "7.18.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "5.2.0",
    "vite": "7.3.8"
  }
}
```


### `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El navegador siempre usa /api en su propio origen. Solo Vite conoce el puerto interno.
const proxy = {
  '/api': { target: process.env.PB_ORIGIN || 'http://127.0.0.1:8090', changeOrigin: true },
}
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], proxy },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], proxy },
})
```


### `frontend/index.html`

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f7f7f3" />
    <meta
      name="description"
      content="Voltio: órdenes de trabajo y seguimiento del taller de reparaciones electrónicas."
    />
    <link rel="icon" href="/voltio.svg" type="image/svg+xml" />
    <title>Voltio · Gestión de taller</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```


### `frontend/src/main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```


### `frontend/src/App.jsx`

```jsx
import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.jsx'
import Ordenes from './pages/Ordenes.jsx'
import Detalle from './pages/Detalle.jsx'
import NuevaOrden from './pages/NuevaOrden.jsx'
import Resumen from './pages/Resumen.jsx'
import Clientes from './pages/Clientes.jsx'
import NoEncontrada from './pages/NoEncontrada.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/ordenes" replace />} />
        <Route path="ordenes" element={<Ordenes />} />
        <Route path="ordenes/nueva" element={<NuevaOrden />} />
        <Route path="ordenes/:id" element={<Detalle />} />
        <Route path="resumen" element={<Resumen />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  )
}
```


### `frontend/src/components/Layout.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useLectura } from '../lib/useLectura.js'
import { leerSalud } from '../lib/api.js'
import Icono from './Icono.jsx'

const grupos = [
  [
    'Operaciones',
    [
      ['/ordenes', 'ordenes', 'Órdenes de trabajo'],
      ['/ordenes/nueva', 'nueva', 'Nueva orden'],
      ['/resumen', 'resumen', 'Resumen por etapa'],
    ],
  ],
  ['Directorio', [['/clientes', 'clientes', 'Clientes']]],
]
function Marca({ alNavegar }) {
  return (
    <Link className="marca" onClick={alNavegar} to="/ordenes" aria-label="Voltio, inicio">
      <img src="/voltio.svg" alt="" width="40" height="40" />
      <span>
        <strong>
          Voltio<span>.</span>
        </strong>
        <small>GESTIÓN DE TALLER</small>
      </span>
    </Link>
  )
}
function Conexion() {
  const salud = useLectura(leerSalud)
  return (
    <div className="terminal">
      <span className="terminal-icono">
        <Icono nombre="terminal" size={19} />
      </span>
      <span>
        <b>Terminal del taller</b>
        <small>
          <i className={`led ${salud.datos ? 'online' : ''}`} />
          {salud.datos ? 'Sistema en línea' : salud.cargando ? 'Conectando…' : 'Sin conexión'}
        </small>
      </span>
    </div>
  )
}
function Menu({ ruta, cerrar }) {
  return (
    <>
      {grupos.map(([nombre, items]) => (
        <div className="grupo-nav" key={nombre}>
          <p className="micro">{nombre}</p>
          <nav aria-label={nombre}>
            {items.map(([to, icono, etiqueta]) => (
              <NavLink
                end
                key={to}
                to={to}
                onClick={cerrar}
                className={({ isActive }) =>
                  `nav-item ${isActive || (to === '/ordenes' && /^\/ordenes\/(?!nueva$)[^/]+$/.test(ruta)) ? 'actual' : ''}`
                }
              >
                <Icono nombre={icono} />
                {etiqueta}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </>
  )
}
export default function Layout() {
  const { pathname } = useLocation()
  const pagina =
    grupos.flatMap((g) => g[1]).find(([to]) => to === pathname)?.[2] ||
    (pathname.startsWith('/ordenes/') ? 'Detalle de orden' : 'Página no encontrada')
  const [abierto, setAbierto] = useState(false)
  const cerrar = () => setAbierto(false)
  const movil = useRef(null)
  useEffect(() => {
    document.title = `${pagina} · Voltio`
    window.scrollTo(0, 0)
  }, [pagina, pathname])
  useEffect(() => {
    const d = movil.current
    if (abierto) d.showModal()
    return () => {
      if (d.open) d.close()
    }
  }, [abierto])
  return (
    <div className="shell">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Marca />
        <Menu ruta={pathname} cerrar={cerrar} />
        <Conexion />
      </aside>
      <dialog ref={movil} aria-label="Menú del taller" className="menu-movil" onCancel={cerrar}>
        <div className="menu-cabeza">
          <Marca alNavegar={cerrar} />
          <button className="boton-icono" aria-label="Cerrar menú" onClick={cerrar}>
            <Icono nombre="x" />
          </button>
        </div>
        <Menu ruta={pathname} cerrar={cerrar} />
      </dialog>
      <div className="espacio">
        <header className="barra">
          <div className="migas">
            <button
              className="boton-icono abrir-menu"
              onClick={() => setAbierto(true)}
              aria-label="Abrir menú"
            >
              <Icono nombre="menu" />
            </button>
            <Link className="marca-movil" to="/ordenes" aria-label="Voltio, inicio">
              <img src="/voltio.svg" width="23" height="23" alt="" />
              Voltio.
            </Link>
            <Icono nombre="grid" size={15} className="miga-icono" />
            <span className="miga-raiz">Espacio de trabajo</span>
            <span className="slash">/</span>
            <b>{pagina}</b>
          </div>
          <span className="fecha-barra">
            <Icono nombre="calendario" size={15} />
            {new Intl.DateTimeFormat('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }).format(new Date())}
          </span>
        </header>
        <main id="contenido" tabIndex="-1">
          <Outlet />
        </main>
        <footer className="pie">
          <span>
            <Icono nombre="pulso" size={15} />
            Voltio <i>/</i> Gestión de taller
          </span>
          <span className="micro">SISTEMA V1.0</span>
        </footer>
      </div>
    </div>
  )
}
```


### `frontend/src/lib/api.js`

```javascript
const registros = (coleccion) => `/api/collections/${coleccion}/records`
const expand = 'cliente,eventos_via_orden'

async function peticion(url, { method = 'GET', body, signal } = {}) {
  const json = body !== undefined && !(body instanceof FormData)
  let res
  try {
    res = await fetch(url, {
      method,
      signal,
      cache: 'no-store',
      headers: json ? { 'Content-Type': 'application/json' } : undefined,
      body: json ? JSON.stringify(body) : body,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new Error('No se pudo conectar con PocketBase. Comprueba la conexión al taller.')
  }
  const datos = await res.json().catch(() => null)
  if (!res.ok || !datos) {
    const campos = Object.entries(datos?.data || {}).map(([k, v]) => `${k}: ${v.message || v}`)
    const e = new Error(
      [
        datos?.message || `No se pudo leer la respuesta del servidor (HTTP ${res.status}).`,
        ...campos,
      ].join(' ')
    )
    e.status = res.status
    throw e
  }
  return datos
}
async function todos(coleccion, parametros, signal) {
  const items = []
  // El taller es pequeño, pero no suponemos que quepa en la primera página de PB.
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ sort: 'id', ...parametros, page, perPage: 100 })
    const lote = await peticion(`${registros(coleccion)}?${q}`, { signal })
    items.push(...lote.items)
    if (page >= lote.totalPages) return items
  }
}
export const leerOrdenes = (signal) =>
  todos(
    'ordenes',
    {
      expand,
      fields:
        'id,equipo,estado,cliente,expand.cliente.nombre,expand.eventos_via_orden.a,expand.eventos_via_orden.created',
    },
    signal
  )
export const leerOrden = (signal, id) =>
  peticion(`${registros('ordenes')}/${encodeURIComponent(id)}?expand=${expand}`, { signal })
export const leerEtapas = (signal) => todos('ordenes', { fields: 'id,estado' }, signal)
export const leerClientes = (signal) => todos('clientes', { sort: 'nombre,id' }, signal)
export const leerSalud = (signal) => peticion('/api/health', { signal })
export const guardar = (coleccion, body, id) =>
  peticion(registros(coleccion) + (id ? `/${encodeURIComponent(id)}` : ''), {
    method: id ? 'PATCH' : 'POST',
    body,
  })
export const fotoURL = (orden, archivo) =>
  `/api/files/ordenes/${encodeURIComponent(orden.id)}/${encodeURIComponent(archivo)}`
```


### `frontend/src/lib/taller.js`

```javascript
// Copia de presentación, nunca una autorización. El servidor revalida el destino.
export const etapas = {
  solicitada: { nombre: 'Solicitada', tono: 'azul', sigue: ['en_diagnostico', 'cancelada'] },
  en_diagnostico: { nombre: 'En diagnóstico', tono: 'violeta', sigue: ['presupuestada'] },
  presupuestada: { nombre: 'Presupuestada', tono: 'ambar', sigue: ['aprobada', 'rechazada'] },
  aprobada: { nombre: 'Aprobada', tono: 'verde', sigue: ['en_reparacion'] },
  en_reparacion: { nombre: 'En reparación', tono: 'naranja', sigue: ['lista'] },
  lista: { nombre: 'Lista', tono: 'turquesa', sigue: ['entregada'] },
  entregada: { nombre: 'Entregada', tono: 'verde', sigue: [] },
  rechazada: { nombre: 'Rechazada', tono: 'rojo', sigue: [] },
  cancelada: { nombre: 'Cancelada', tono: 'gris', sigue: [] },
}
export const acciones = {
  en_diagnostico: 'Iniciar diagnóstico',
  cancelada: 'Cancelar orden',
  presupuestada: 'Registrar presupuesto',
  aprobada: 'Aprobar presupuesto',
  rechazada: 'Rechazar presupuesto',
  en_reparacion: 'Iniciar reparación',
  lista: 'Marcar como lista',
  entregada: 'Registrar entrega',
}
export const referencia = (id) => `OT-${id.slice(-4).toUpperCase()}`
export const normalizar = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
export const numero = (n) => String(n).padStart(2, '0')
export const iniciales = (s) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase()
export const fecha = (s, hora = false) =>
  s
    ? new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        ...(hora ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' }),
      }).format(new Date(s.replace(' ', 'T')))
    : '—'
export const moneda = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
// Sumar céntimos enteros evita que el redondeo binario se acumule en las líneas.
export const totalDe = (mano, piezas) =>
  (Math.round(Number(mano) * 100) +
    piezas.reduce((n, p) => n + Number(p.cantidad) * Math.round(Number(p.precio) * 100), 0)) /
  100
// Dos eventos pueden compartir milisegundo. El orden topológico deshace ese empate.
export const historial = (orden) =>
  [...(orden.expand?.eventos_via_orden || [])].sort(
    (a, b) =>
      a.created.localeCompare(b.created) ||
      Object.keys(etapas).indexOf(a.a) - Object.keys(etapas).indexOf(b.a)
  )
export const ingreso = (orden) =>
  orden.expand?.eventos_via_orden?.find((e) => e.a === 'solicitada')?.created || ''
export function tipoEquipo(nombre) {
  if (/macbook|laptop|portátil|notebook|thinkpad/i.test(nombre)) return ['laptop', 'Portátil']
  if (/playstation|consola|switch|xbox/i.test(nombre)) return ['gamepad', 'Consola']
  if (/monitor|ultrasharp|pantalla|televisor/i.test(nombre)) return ['monitor', 'Pantalla']
  if (/móvil|iphone|teléfono|smartphone/i.test(nombre)) return ['phone', 'Teléfono']
  return ['cpu', 'Electrónica']
}
```


### `frontend/src/lib/useLectura.js`

```javascript
import { useCallback, useEffect, useState } from 'react'

// «leer» es una función de módulo estable. «clave» distingue, por ejemplo, dos /ordenes/:id.
export function useLectura(leer, clave = '') {
  const [revision, setRevision] = useState(0)
  const [respuesta, setRespuesta] = useState(null)
  // Identidad estable: así no reinstalamos el listener de foco en cada render.
  const recargar = useCallback(() => setRevision((n) => n + 1), [])
  useEffect(() => {
    window.addEventListener('focus', recargar)
    return () => window.removeEventListener('focus', recargar)
  }, [recargar])
  useEffect(() => {
    const c = new AbortController()
    const publicar = (datos, error) => {
      if (!c.signal.aborted) setRespuesta({ leer, clave, revision, datos, error })
    }
    leer(c.signal, clave)
      .then((datos) => publicar(datos, null))
      .catch((error) => publicar(null, error))
    // Una respuesta lenta de la ruta anterior no puede reemplazar la orden actual.
    return () => c.abort()
  }, [leer, clave, revision])
  const misma = respuesta?.leer === leer && respuesta.clave === clave
  return {
    datos: misma ? respuesta.datos : null,
    error: misma ? respuesta.error : null,
    cargando: !misma || respuesta.revision !== revision,
    recargar,
  }
}
```


### `frontend/src/components/CambioEstado.jsx`

```jsx
import { useState } from 'react'
import { acciones, etapas } from '../lib/taller.js'
import Icono from './Icono.jsx'
import { FormPresupuesto } from './Presupuesto.jsx'

export default function CambioEstado({ estado, enviar, ocupado }) {
  const [confirmar, setConfirmar] = useState(null)
  if (estado === 'en_diagnostico') return <FormPresupuesto enviar={enviar} ocupado={ocupado} />
  if (!etapas[estado].sigue.length)
    return (
      <p className="nota">
        <Icono nombre="check" />
        Esta orden está cerrada. Sus datos e historial se conservan para consulta.
      </p>
    )
  if (confirmar)
    return (
      <div className="confirmacion">
        <b>¿{acciones[confirmar]}?</b>
        <p>Esta acción cierra la orden de forma definitiva.</p>
        <div className="acciones">
          <button
            className="boton secundario"
            disabled={ocupado}
            onClick={() => setConfirmar(null)}
          >
            Volver
          </button>
          <button className="boton primario" disabled={ocupado} onClick={() => enviar(confirmar)}>
            {ocupado ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    )
  return (
    <>
      <p className="nota nota-accion">Selecciona el siguiente paso de la orden.</p>
      <div className="acciones">
        {etapas[estado].sigue.map((s, i) => (
          <button
            key={s}
            disabled={ocupado}
            className={`boton ${i === 0 ? 'primario' : 'secundario'}`}
            onClick={() => (etapas[s].sigue.length ? enviar(s) : setConfirmar(s))}
          >
            {acciones[s]}
            {i === 0 && <Icono nombre="flecha" size={15} />}
          </button>
        ))}
      </div>
    </>
  )
}
```


### `frontend/src/components/CampoFotos.jsx`

```jsx
import { useRef } from 'react'
import Icono from './Icono.jsx'

export default function CampoFotos({ fotos, cambiar, avisar }) {
  // El navegador no permite asignar archivos al input. La lista visible y el envío
  // se controlan con «fotos»; la ref solo abre el selector nativo.
  const input = useRef(null)
  function agregar(files) {
    const nuevas = [...fotos, ...files]
    if (nuevas.length > 3) return avisar(new Error('Solo puedes adjuntar tres imágenes.'))
    if (
      nuevas.some(
        (f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5242880
      )
    ) {
      return avisar(new Error('Usa archivos JPG, PNG o WebP de hasta 5 MB cada uno.'))
    }
    avisar(null)
    cambiar(nuevas)
  }
  return (
    <div>
      <span className="label">
        Fotos del equipo <small>Opcional</small>
      </span>
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          agregar([...e.target.files])
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="subir"
        onClick={() => input.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          agregar([...e.dataTransfer.files])
        }}
      >
        <Icono nombre="subir" size={24} />
        <b>Seleccionar imágenes</b>
        <small>Hasta 3 fotos · JPG, PNG o WebP · 5 MB por foto</small>
      </button>
      {fotos.length > 0 && (
        <ul className="archivos">
          {fotos.map((f, i) => (
            <li key={`${i}-${f.name}`}>
              <Icono nombre="foto" size={16} />
              <span>{f.name}</span>
              <button
                type="button"
                className="boton-icono"
                aria-label={`Quitar ${f.name}`}
                onClick={() => cambiar(fotos.filter((_, j) => j !== i))}
              >
                <Icono nombre="x" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```


### `frontend/src/components/ClienteDialog.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'
import { guardar } from '../lib/api.js'
import { Aviso } from './UI.jsx'
import Icono from './Icono.jsx'

export default function ClienteDialog({ cliente, cerrar, guardado }) {
  const dialog = useRef(null),
    nombreInput = useRef(null)
  const [nombre, setNombre] = useState(cliente?.nombre || ''),
    [telefono, setTelefono] = useState(cliente?.telefono || '')
  const [error, setError] = useState(null),
    [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    const d = dialog.current
    d.showModal()
    nombreInput.current.focus()
    return () => d.close()
  }, [])
  async function enviar(e) {
    e.preventDefault()
    setError(null)
    setOcupado(true)
    try {
      const registro = await guardar(
        'clientes',
        { nombre: nombre.trim(), telefono: telefono.trim() },
        cliente?.id
      )
      guardado(registro.id) // El padre relee la lista; no inserta una copia local optimista.
    } catch (err) {
      setError(err)
      setOcupado(false)
    }
  }
  return (
    <dialog
      className="dialogo"
      ref={dialog}
      aria-labelledby="cliente-titulo"
      onCancel={(e) => {
        e.preventDefault()
        if (!ocupado) cerrar()
      }}
    >
      <header>
        <div>
          <span className="ceja">Directorio</span>
          <h2 id="cliente-titulo">{cliente ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        </div>
        <button
          type="button"
          className="boton-icono"
          aria-label="Cerrar"
          onClick={cerrar}
          disabled={ocupado}
        >
          <Icono nombre="x" />
        </button>
      </header>
      <form onSubmit={enviar}>
        <fieldset disabled={ocupado} className="campos">
          <label>
            Nombre completo
            <input
              ref={nombreInput}
              required
              maxLength="120"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Teléfono
            <input
              type="tel"
              required
              maxLength="40"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
            />
          </label>
        </fieldset>
        <Aviso error={error} />
        <div className="acciones-form">
          <button className="boton secundario" type="button" onClick={cerrar} disabled={ocupado}>
            Volver
          </button>
          <button className="boton primario" disabled={ocupado}>
            {ocupado ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
```


### `frontend/src/components/Icono.jsx`

```jsx
// Pictogramas SVG locales: sin paquete de iconos, fuentes remotas ni controles opacos.
const trazos = {
  ordenes: 'M8 5H5v16h14V5h-3 M9 3h6v4H9z M8 12h8m-8 4h5',
  nueva: 'M14 3H5v18h14V8z M14 3v5h5 M8 14h8m-4-4v8',
  resumen: 'M3 3v17h18 M7 16v-5m5 5V6m5 10V9',
  clientes:
    'M15.5 20v-2a5 5 0 0 0-5-5h-2a5 5 0 0 0-5 5v2 M13.5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M16 4a3.5 3.5 0 0 1 0 6.8m1 3a4.5 4.5 0 0 1 3.5 4.4V20',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  terminal: 'M3 4h18v14H3z M8 21h8m-4-3v3 M7 8l3 3-3 3m5 0h4',
  calendario: 'M4 6h16v15H4z M8 3v6m8-6v6M4 11h16m-12 4h3',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  pulso: 'M2 13h5l3-9 4 16 3-10h5',
  buscar: 'M16.6 10.3a6.3 6.3 0 1 1-12.6 0 6.3 6.3 0 0 1 12.6 0z M15 15l5 5',
  filtro:
    'M3 7h6m4 0h8M3 17h10m4 0h4 M13 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M17 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  ordenar: 'M8 4v16m-4-4 4 4 4-4 M16 20V4m-4 4 4-4 4 4',
  abajo: 'm6 9 6 6 6-6',
  derecha: 'm9 6 6 6-6 6',
  izquierda: 'm15 6-6 6 6 6',
  flecha: 'M4 12h15m-6-6 6 6-6 6',
  volver: 'M20 12H5m6-6-6 6 6 6',
  externo: 'M6 18 18 6M7 6h11v11',
  menu: 'M3 6h18M3 12h18M3 18h18',
  x: 'm6 6 12 12M18 6 6 18',
  laptop: 'M5 5h14v12H5z M5 17l-3 3h20l-3-3M9 17h6',
  gamepad:
    'M8 7h8c3 0 4 2 5 7 1 5-1 6-4 3l-2-2H9l-2 2c-3 3-5 2-4-3 1-5 2-7 5-7z M6 11.5h4m-2-2v4 M15 11h.1m2.5 2h.1',
  monitor: 'M3 4h18v13H3z M8 21h8m-4-4v4',
  phone: 'M7 2h10v20H7z M11 18h2',
  cpu: 'M6 6h12v12H6z M9 9h6v6H9z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z M12 11v5m0-9v.1',
  foto: 'M3 4h18v16H3z M3 17l5-5 4 4 3-3 6 6 M16 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
  subir: 'M4 15v5h16v-5M12 16V3m-5 5 5-5 5 5',
  tiempo: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z M12 6v6l4 2',
  editar: 'm4 16 12-12 4 4L8 20l-5 1z M14 6l4 4',
  check: 'm4 12 5 5L20 6',
  llamar: 'm6 3 4 4-2 3c1 3 3 5 6 6l3-2 4 4-2 3c-8 1-17-8-16-16z',
  llave: 'M14 5a6 6 0 0 0-7 7l-5 5 4 4 6-6a6 6 0 0 0 7-8l-4 4-3-3 4-4z',
  lista: 'M4 6h2m3 0h11M4 12h2m3 0h11M4 18h2m3 0h11',
}
export default function Icono({ nombre, size = 18, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={trazos[nombre]} />
    </svg>
  )
}
```


### `frontend/src/components/Monitor.jsx`

```jsx
import { numero } from '../lib/taller.js'
import Icono from './Icono.jsx'

export default function Monitor({ ordenes }) {
  const valores = [
    ordenes.length,
    ordenes.filter((o) => o.estado === 'en_reparacion').length,
    ordenes.filter((o) => o.estado === 'lista').length,
  ]
  return (
    <section className="monitor" aria-label="Indicadores del taller">
      <div className="monitor-info">
        <div className="monitor-titulo">
          <Icono nombre="pulso" size={18} />
          <h2>Monitor del taller</h2>
        </div>
        <dl className="metricas">
          {['Órdenes totales', 'En reparación', 'Listas para entrega'].map((s, i) => (
            <div key={s}>
              <dt>{s}</dt>
              <dd>{numero(valores[i])}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figure className="plano" aria-hidden="true">
        <img src="/osciloscopio.svg" alt="" />
        <figcaption>
          FIG. 01 <i /> OSCILOSCOPIO
        </figcaption>
      </figure>
    </section>
  )
}
```


### `frontend/src/components/Presupuesto.jsx`

```jsx
import { useMemo, useRef, useState } from 'react'
import { moneda, totalDe } from '../lib/taller.js'
import Icono from './Icono.jsx'

function Total({ mano, piezas }) {
  // Editar el diagnóstico no modifica ningún importe; evitamos recorrer las piezas otra vez.
  const total = useMemo(() => totalDe(mano, piezas), [mano, piezas])
  return (
    <div className="total">
      <span>Total del presupuesto</span>
      <strong>{moneda(total)}</strong>
    </div>
  )
}
function FilaPieza({ pieza, cambiar, quitar }) {
  return (
    <div className="linea-pieza">
      <label>
        Descripción
        <input
          required
          value={pieza.descripcion}
          onChange={(e) => cambiar('descripcion', e.target.value)}
        />
      </label>
      <label>
        Cantidad
        <input
          required
          type="number"
          min="1"
          step="1"
          value={pieza.cantidad}
          onChange={(e) => cambiar('cantidad', e.target.value)}
        />
      </label>
      <label>
        Precio (€)
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={pieza.precio}
          onChange={(e) => cambiar('precio', e.target.value)}
        />
      </label>
      <button className="boton-icono" type="button" aria-label="Quitar pieza" onClick={quitar}>
        <Icono nombre="x" size={16} />
      </button>
    </div>
  )
}
export function FormPresupuesto({ enviar, ocupado }) {
  const [diagnostico, setDiagnostico] = useState(''),
    [mano, setMano] = useState(''),
    [piezas, setPiezas] = useState([])
  const secuencia = useRef(0)
  function guardar(e) {
    e.preventDefault()
    enviar('presupuestada', {
      diagnostico: diagnostico.trim(),
      manoObra: Number(mano),
      piezas: piezas.map((p) => ({
        descripcion: p.descripcion.trim(),
        cantidad: Number(p.cantidad),
        precio: Number(p.precio),
      })),
    })
  }
  return (
    <form onSubmit={guardar}>
      <fieldset className="campos" disabled={ocupado}>
        <label>
          Diagnóstico
          <textarea
            required
            maxLength="4000"
            rows="3"
            placeholder="Hallazgos de la revisión"
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
          />
        </label>
        <label>
          Mano de obra (€)
          <input
            type="number"
            required
            min="0"
            step="0.01"
            placeholder="0,00"
            value={mano}
            onChange={(e) => setMano(e.target.value)}
          />
        </label>
        <div className="piezas">
          <div className="label-fila">
            <b>Piezas</b>
            <button
              className="enlace"
              type="button"
              onClick={() => {
                const key = ++secuencia.current
                setPiezas((ps) => [...ps, { key, descripcion: '', cantidad: '1', precio: '' }])
              }}
            >
              <Icono nombre="mas" size={14} />
              Añadir pieza
            </button>
          </div>
          {piezas.length === 0 && (
            <p className="nota">Sin piezas añadidas. Puedes presupuestar solo mano de obra.</p>
          )}
          {piezas.map((p) => (
            <FilaPieza
              key={p.key}
              pieza={p}
              cambiar={(k, v) =>
                setPiezas((ps) => ps.map((x) => (x.key === p.key ? { ...x, [k]: v } : x)))
              }
              quitar={() => setPiezas((ps) => ps.filter((x) => p.key !== x.key))}
            />
          ))}
        </div>
        <Total mano={mano} piezas={piezas} />
        <p className="nota">
          <Icono nombre="info" size={15} />
          Una vez registrado, el presupuesto no se podrá modificar.
        </p>
        <button className="boton primario auto-ancho" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Registrar presupuesto'}
          <Icono nombre="flecha" size={16} />
        </button>
      </fieldset>
    </form>
  )
}
export function PresupuestoEmitido({ orden }) {
  return (
    <div className="presupuesto">
      <p className="micro">Diagnóstico</p>
      <p className="texto-largo">{orden.diagnostico}</p>
      <div className="renglon">
        <span>Mano de obra</span>
        <b>{moneda(orden.manoObra)}</b>
      </div>
      {orden.piezas.map((p, i) => (
        <div className="renglon" key={`${i}-${p.descripcion}`}>
          <span>
            {p.descripcion}
            <small>
              {p.cantidad} × {moneda(p.precio)}
            </small>
          </span>
          <b>{moneda(p.cantidad * p.precio)}</b>
        </div>
      ))}
      <Total mano={orden.manoObra} piezas={orden.piezas} />
    </div>
  )
}
```


### `frontend/src/components/TablaOrdenes.jsx`

```jsx
import { Link } from 'react-router'
import { fecha, ingreso, referencia, tipoEquipo } from '../lib/taller.js'
import Icono from './Icono.jsx'
import { Estado } from './UI.jsx'

export default function TablaOrdenes({ ordenes }) {
  return (
    <div className="tabla-scroll">
      <table className="tabla-ordenes">
        <thead>
          <tr>
            <th scope="col">Orden</th>
            <th scope="col">Equipo</th>
            <th scope="col">Cliente</th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="sr">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenes.map((o) => {
            const [icono, tipo] = tipoEquipo(o.equipo),
              url = `/ordenes/${o.id}`
            return (
              <tr key={o.id}>
                <td>
                  <Link className="codigo" to={url}>
                    {referencia(o.id)}
                  </Link>
                  <small>{fecha(ingreso(o))}</small>
                </td>
                <td>
                  <div className="celda-equipo">
                    <span className="equipo-icono">
                      <Icono nombre={icono} size={21} />
                    </span>
                    <div>
                      <Link to={url} className="nombre-equipo">
                        {o.equipo}
                      </Link>
                      <small>{tipo}</small>
                    </div>
                  </div>
                </td>
                <td>{o.expand.cliente.nombre}</td>
                <td>
                  <Estado valor={o.estado} />
                </td>
                <td className="celda-ir">
                  <Link className="ir" to={url} aria-label={`Ver detalle de ${o.equipo}`}>
                    <Icono nombre="derecha" size={16} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
export function Paginacion({ pagina, porPagina, total, cambiar }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  return (
    <div className="paginacion">
      <span>
        {total ? (
          <>
            <b>
              {(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, total)}
            </b>{' '}
            de {total} {total === 1 ? 'orden' : 'órdenes'}
          </>
        ) : (
          '0 órdenes'
        )}
      </span>
      <div>
        <button
          className="boton-pagina"
          disabled={pagina <= 1}
          onClick={() => cambiar(pagina - 1)}
          aria-label="Página anterior"
        >
          <Icono nombre="izquierda" size={14} />
        </button>
        <span className="pagina-num" aria-label={`Página ${pagina} de ${paginas}`}>
          {pagina}
        </span>
        <button
          className="boton-pagina"
          disabled={pagina >= paginas}
          onClick={() => cambiar(pagina + 1)}
          aria-label="Página siguiente"
        >
          <Icono nombre="derecha" size={14} />
        </button>
      </div>
    </div>
  )
}
```


### `frontend/src/components/UI.jsx`

```jsx
import { etapas } from '../lib/taller.js'
import Icono from './Icono.jsx'

export function Cabecera({ seccion, titulo, descripcion, accion }) {
  return (
    <header className="cabecera">
      <div>
        <div className="ceja">
          <i className="marcas" />
          {seccion}
        </div>
        <h1>{titulo}</h1>
        <p>{descripcion}</p>
      </div>
      {accion}
    </header>
  )
}
export function Estado({ valor }) {
  const { tono, nombre } = etapas[valor]
  return (
    <span className={`estado ${tono}`}>
      <i />
      {nombre}
    </span>
  )
}
export function Aviso({ error, reintentar }) {
  if (!error) return null
  return (
    <div className="aviso" role="alert">
      <Icono nombre="info" />
      <span>{error.message || String(error)}</span>
      {reintentar && (
        <button type="button" className="enlace" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}
export function Cargando() {
  return (
    <div className="cargando" role="status">
      <i className="spinner" />
      Leyendo del taller…
    </div>
  )
}
export function Vacio({ titulo, texto, children }) {
  return (
    <div className="vacio">
      <span className="icono-vacio">
        <Icono nombre="buscar" size={24} />
      </span>
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {children}
    </div>
  )
}
export function Buscar({ valor, cambiar, texto }) {
  return (
    <label className="busqueda">
      <Icono nombre="buscar" size={17} />
      <input
        type="search"
        aria-label={texto}
        placeholder={texto}
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
      />
    </label>
  )
}
export function TituloPanel({ icono, children, extra }) {
  return (
    <div className="titulo-panel">
      <div>
        {icono && <Icono nombre={icono} />}
        <h2>{children}</h2>
      </div>
      {extra}
    </div>
  )
}
```


### `frontend/src/pages/Clientes.jsx`

```jsx
import { useState } from 'react'
import { leerClientes } from '../lib/api.js'
import { iniciales, normalizar } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import { Aviso, Buscar, Cabecera, Cargando, TituloPanel, Vacio } from '../components/UI.jsx'
import ClienteDialog from '../components/ClienteDialog.jsx'
import Icono from '../components/Icono.jsx'

export default function Clientes() {
  const r = useLectura(leerClientes),
    [buscar, setBuscar] = useState(''),
    [editor, setEditor] = useState(null)
  const lista = r.datos?.filter((c) =>
    normalizar(`${c.nombre} ${c.telefono}`).includes(normalizar(buscar))
  )
  return (
    <>
      <Cabecera
        seccion="Directorio del taller"
        titulo="Clientes"
        descripcion="Consulta y actualiza los datos de contacto de los titulares de equipos."
        accion={
          <button className="boton primario" onClick={() => setEditor({})}>
            <Icono nombre="mas" size={17} />
            Nuevo cliente
          </button>
        }
      />
      <Aviso error={r.error} reintentar={r.recargar} />
      {lista ? (
        <section className="panel">
          <TituloPanel icono="clientes" extra={<span className="contador">{r.datos.length}</span>}>
            Directorio de clientes
          </TituloPanel>
          <div className="herramientas">
            <Buscar texto="Buscar por nombre o teléfono…" valor={buscar} cambiar={setBuscar} />
          </div>
          {lista.length ? (
            <ul className="directorio">
              {lista.map((c) => (
                <li key={c.id}>
                  <span className="avatar">{iniciales(c.nombre)}</span>
                  <div>
                    <b>{c.nombre}</b>
                    <small>{c.telefono}</small>
                  </div>
                  <button
                    className="boton secundario compacto"
                    aria-label={`Editar a ${c.nombre}`}
                    onClick={() => setEditor(c)}
                  >
                    <Icono nombre="editar" size={14} />
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio
              titulo="Sin clientes en esta vista"
              texto="Cambia la búsqueda o registra un nuevo cliente."
            />
          )}
        </section>
      ) : (
        r.cargando && <Cargando />
      )}
      {editor && (
        <ClienteDialog
          cliente={editor.id ? editor : null}
          cerrar={() => setEditor(null)}
          guardado={() => {
            r.recargar()
            setEditor(null)
          }}
        />
      )}
    </>
  )
}
```


### `frontend/src/pages/Detalle.jsx`

```jsx
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { fotoURL, guardar, leerOrden } from '../lib/api.js'
import { etapas, fecha, historial, referencia } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import { Aviso, Cabecera, Cargando, Estado, TituloPanel } from '../components/UI.jsx'
import Icono from '../components/Icono.jsx'
import { PresupuestoEmitido } from '../components/Presupuesto.jsx'
import CambioEstado from '../components/CambioEstado.jsx'
import NoEncontrada from './NoEncontrada.jsx'

function Historial({ orden }) {
  return (
    <section className="panel">
      <TituloPanel icono="tiempo">Historial</TituloPanel>
      <ol className="historial">
        {historial(orden)
          .reverse()
          .map((e) => (
            <li key={e.id}>
              <b>{etapas[e.a].nombre}</b>
              <span>
                {e.de ? `Desde ${etapas[e.de].nombre.toLowerCase()}` : 'Ingreso al taller'}
              </span>
              <time dateTime={e.created.replace(' ', 'T')}>{fecha(e.created, true)}</time>
            </li>
          ))}
      </ol>
    </section>
  )
}
function Ficha({ orden }) {
  const c = orden.expand.cliente
  return (
    <section className="panel">
      <TituloPanel icono="cpu" extra={<Estado valor={orden.estado} />}>
        Ficha del equipo
      </TituloPanel>
      <div className="cuerpo-panel ficha">
        <div className="datos-cliente">
          <div>
            <p className="micro">Cliente</p>
            <b>{c.nombre}</b>
          </div>
          <div>
            <p className="micro">Teléfono</p>
            <a href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`}>{c.telefono}</a>
          </div>
        </div>
        <p className="micro">Problema informado</p>
        <p className="texto-largo">{orden.problema}</p>
        <p className="micro">Fotografías · {orden.fotos.length}/3</p>
        {orden.fotos.length ? (
          <div className="galeria">
            {orden.fotos.map((f) => (
              <a key={f} href={fotoURL(orden, f)} target="_blank" rel="noreferrer">
                <img src={fotoURL(orden, f)} alt={`Foto del equipo: ${f}`} />
              </a>
            ))}
          </div>
        ) : (
          <p className="nota">No se adjuntaron imágenes.</p>
        )}
      </div>
    </section>
  )
}
function FichaOrden({ id }) {
  const r = useLectura(leerOrden, id),
    [ocupado, setOcupado] = useState(false),
    [error, setError] = useState(null)
  async function avanzar(estado, campos = {}) {
    setOcupado(true)
    setError(null)
    try {
      await guardar('ordenes', { estado, ...campos }, id)
    } catch (err) {
      setError(err)
    } finally {
      r.recargar()
      setOcupado(false)
    } // También releer tras un rechazo por concurrencia.
  }
  if (r.error?.status === 404) return <NoEncontrada orden />
  if (!r.datos) return r.error ? <Aviso error={r.error} reintentar={r.recargar} /> : <Cargando />
  const o = r.datos
  return (
    <>
      <Cabecera
        seccion={`Ficha de servicio / ${referencia(o.id)}`}
        titulo={o.equipo}
        descripcion="Recepción, presupuesto y trazabilidad de la reparación."
        accion={
          <Link to="/ordenes" className="boton secundario">
            <Icono nombre="volver" size={15} />
            Volver al registro
          </Link>
        }
      />
      <div className="dos-columnas">
        <div className="pila">
          <Ficha orden={o} />
          {o.diagnostico && (
            <section className="panel">
              <TituloPanel icono="lista">Presupuesto registrado</TituloPanel>
              <div className="cuerpo-panel">
                <PresupuestoEmitido orden={o} />
              </div>
            </section>
          )}
          <section className="panel">
            <TituloPanel icono="llave">
              {o.estado === 'en_diagnostico' ? 'Preparar presupuesto' : 'Control de etapa'}
            </TituloPanel>
            <div className="cuerpo-panel">
              <Aviso error={error} />
              <CambioEstado
                key={o.estado}
                estado={o.estado}
                ocupado={ocupado || r.cargando}
                enviar={avanzar}
              />
            </div>
          </section>
        </div>
        <Historial orden={o} />
      </div>
    </>
  )
}
export default function Detalle() {
  const { id } = useParams()
  return <FichaOrden key={id} id={id} />
}
```


### `frontend/src/pages/NoEncontrada.jsx`

```jsx
import { Link } from 'react-router'
import Icono from '../components/Icono.jsx'

export default function NoEncontrada({ orden = false }) {
  return (
    <section className="panel no-encontrada">
      <span className="etiqueta-tecnica">VOL / ERROR 404</span>
      <strong>404</strong>
      <h1>{orden ? 'Orden no encontrada' : 'Página no encontrada'}</h1>
      <p>
        {orden
          ? 'No hay una orden con ese identificador en el taller.'
          : 'Esta ruta no pertenece al sistema del taller.'}
      </p>
      <Link className="boton primario" to="/ordenes">
        <Icono nombre="volver" size={16} />
        Ir a órdenes de trabajo
      </Link>
    </section>
  )
}
```


### `frontend/src/pages/NuevaOrden.jsx`

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { guardar, leerClientes } from '../lib/api.js'
import { useLectura } from '../lib/useLectura.js'
import { Aviso, Cabecera, Cargando, Estado, TituloPanel } from '../components/UI.jsx'
import ClienteDialog from '../components/ClienteDialog.jsx'
import CampoFotos from '../components/CampoFotos.jsx'
import Icono from '../components/Icono.jsx'

export default function NuevaOrden() {
  const nav = useNavigate(),
    clientes = useLectura(leerClientes)
  const [cliente, setCliente] = useState(''),
    [equipo, setEquipo] = useState(''),
    [problema, setProblema] = useState('')
  const [fotos, setFotos] = useState([]),
    [nuevo, setNuevo] = useState(false)
  const [error, setError] = useState(null),
    [ocupado, setOcupado] = useState(false)
  async function enviar(e) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    const datos = new FormData()
    datos.set('cliente', cliente)
    datos.set('equipo', equipo.trim())
    datos.set('problema', problema.trim())
    fotos.forEach((f) => datos.append('fotos', f))
    try {
      const o = await guardar('ordenes', datos)
      nav(`/ordenes/${o.id}`, { replace: true }) // El detalle hace GET con las relaciones y el evento de alta.
    } catch (err) {
      setError(err)
      setOcupado(false)
    }
  }
  return (
    <>
      <Cabecera
        seccion="Recepción de equipos"
        titulo="Nueva orden"
        descripcion="Registra el equipo, su titular y el problema informado."
      />
      <div className="dos-columnas">
        <section className="panel">
          <TituloPanel icono="nueva">Datos de recepción</TituloPanel>
          <form className="cuerpo-panel" onSubmit={enviar}>
            <fieldset className="campos" disabled={ocupado}>
              <div>
                <div className="label-fila">
                  <label htmlFor="cliente">Cliente</label>
                  <button type="button" className="enlace" onClick={() => setNuevo(true)}>
                    <Icono nombre="mas" size={14} />
                    Nuevo cliente
                  </button>
                </div>
                <select
                  id="cliente"
                  required
                  value={cliente}
                  disabled={!clientes.datos || clientes.cargando}
                  onChange={(e) => setCliente(e.target.value)}
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.datos?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} · {c.telefono}
                    </option>
                  ))}
                </select>
                {clientes.cargando && <Cargando />}
                <Aviso error={clientes.error} reintentar={clientes.recargar} />
              </div>
              <label>
                Equipo
                <input
                  value={equipo}
                  required
                  maxLength="160"
                  onChange={(e) => setEquipo(e.target.value)}
                  placeholder="Marca y modelo del equipo"
                />
              </label>
              <label>
                Problema informado
                <textarea
                  value={problema}
                  required
                  maxLength="4000"
                  onChange={(e) => setProblema(e.target.value)}
                  rows="4"
                  placeholder="¿Qué falla describe el cliente?"
                />
              </label>
              <CampoFotos fotos={fotos} cambiar={setFotos} avisar={setError} />
            </fieldset>
            <Aviso error={error} />
            <div className="acciones-form">
              <Link className="boton secundario" to="/ordenes">
                Volver
              </Link>
              <button
                className="boton primario"
                disabled={!clientes.datos || clientes.cargando || ocupado}
              >
                <Icono nombre="check" size={16} />
                {ocupado ? 'Registrando…' : 'Registrar orden'}
              </button>
            </div>
          </form>
        </section>
        <aside className="panel ayuda">
          <span className="etiqueta-tecnica">PROTOCOLO / 01</span>
          <h2>Ingreso al taller</h2>
          <Estado valor="solicitada" />
          <p>
            Toda orden comienza como <b>solicitada</b>. El sistema registrará el ingreso en su
            historial.
          </p>
          <hr />
          <p>El diagnóstico y los costes se completan más adelante, al emitir el presupuesto.</p>
        </aside>
      </div>
      {nuevo && (
        <ClienteDialog
          cerrar={() => setNuevo(false)}
          guardado={(id) => {
            setCliente(id)
            clientes.recargar()
            setNuevo(false)
          }}
        />
      )}
    </>
  )
}
```


### `frontend/src/pages/Ordenes.jsx`

```jsx
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { leerOrdenes } from '../lib/api.js'
import { etapas, ingreso, normalizar, numero, referencia } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import Icono from '../components/Icono.jsx'
import { Aviso, Buscar, Cabecera, Cargando, Vacio } from '../components/UI.jsx'
import Monitor from '../components/Monitor.jsx'
import TablaOrdenes, { Paginacion } from '../components/TablaOrdenes.jsx'

function Registro({ ordenes }) {
  const [params, setParams] = useSearchParams()
  const filtro = Object.hasOwn(etapas, params.get('estado')) ? params.get('estado') : ''
  const [buscar, setBuscar] = useState(''),
    [recientes, setRecientes] = useState(true),
    [pagina, setPagina] = useState(1)
  // Al paginar no volvemos a normalizar nombres ni ordenar todo el registro.
  const lista = useMemo(
    () =>
      ordenes
        .filter(
          (o) =>
            (!filtro || o.estado === filtro) &&
            normalizar(`${referencia(o.id)} ${o.equipo} ${o.expand.cliente.nombre}`).includes(
              normalizar(buscar)
            )
        )
        .sort(
          (a, b) =>
            (ingreso(b).localeCompare(ingreso(a)) || b.id.localeCompare(a.id)) *
            (recientes ? 1 : -1)
        ),
    [ordenes, buscar, filtro, recientes]
  )
  const n = 8,
    actual = Math.min(pagina, Math.max(1, Math.ceil(lista.length / n)))
  return (
    <section className="panel registro">
      <div className="registro-titulo">
        <div>
          <h2>Registro de órdenes</h2>
          <span className="contador">{numero(ordenes.length)}</span>
        </div>
        <button
          className="ordenar"
          onClick={() => {
            setRecientes(!recientes)
            setPagina(1)
          }}
          aria-label={`Cambiar orden: ${recientes ? 'más antiguas' : 'más recientes'} primero`}
        >
          <Icono nombre="ordenar" size={14} />
          {recientes ? 'Más recientes' : 'Más antiguas'}
        </button>
      </div>
      <div className="herramientas">
        <Buscar
          texto="Buscar por orden, equipo o cliente…"
          valor={buscar}
          cambiar={(s) => {
            setBuscar(s)
            setPagina(1)
          }}
        />
        <label className="select-filtro">
          <Icono nombre="filtro" size={16} />
          <select
            aria-label="Filtrar por estado"
            value={filtro}
            onChange={(e) => {
              setParams(e.target.value ? { estado: e.target.value } : {})
              setPagina(1)
            }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(etapas).map(([id, e]) => (
              <option key={id} value={id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <Icono nombre="abajo" size={13} />
        </label>
      </div>
      {lista.length ? (
        <TablaOrdenes ordenes={lista.slice((actual - 1) * n, actual * n)} />
      ) : (
        <Vacio
          titulo="No hay órdenes que mostrar"
          texto={
            ordenes.length
              ? 'Prueba con otro término o cambia el filtro de estado.'
              : 'Registra el primer equipo para iniciar el seguimiento.'
          }
        >
          {ordenes.length ? (
            <button
              className="enlace"
              onClick={() => {
                setBuscar('')
                setParams({})
                setPagina(1)
              }}
            >
              Limpiar filtros
            </button>
          ) : (
            <Link className="enlace" to="/ordenes/nueva">
              Crear una orden
            </Link>
          )}
        </Vacio>
      )}
      <Paginacion pagina={actual} porPagina={n} total={lista.length} cambiar={setPagina} />
    </section>
  )
}
export default function Ordenes() {
  const r = useLectura(leerOrdenes)
  return (
    <>
      <Cabecera
        seccion="Panel de operaciones"
        titulo="Órdenes de trabajo"
        descripcion="Supervisa los equipos y el avance de cada reparación."
        accion={
          <Link className="boton primario" to="/ordenes/nueva">
            <Icono nombre="mas" size={17} />
            Nueva orden
          </Link>
        }
      />
      <Aviso error={r.error} reintentar={r.recargar} />
      {r.datos ? (
        <>
          <Monitor ordenes={r.datos} />
          <Registro ordenes={r.datos} />
        </>
      ) : (
        r.cargando && <Cargando />
      )}
    </>
  )
}
```


### `frontend/src/pages/Resumen.jsx`

```jsx
import { Link } from 'react-router'
import { leerEtapas } from '../lib/api.js'
import { etapas, numero } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import { Aviso, Cabecera, Cargando, Estado } from '../components/UI.jsx'
import Icono from '../components/Icono.jsx'
import Monitor from '../components/Monitor.jsx'

function Distribucion({ ordenes }) {
  const conteo = ordenes.reduce((c, o) => {
    c[o.estado] = (c[o.estado] || 0) + 1
    return c
  }, {})
  return (
    <section className="resumen-seccion">
      <div className="subtitulo">
        <h2>Distribución de órdenes</h2>
        <span className="micro">09 etapas</span>
      </div>
      <div className="cuadricula">
        {Object.keys(etapas).map((s) => {
          const n = conteo[s] || 0,
            p = ordenes.length ? Math.round((100 * n) / ordenes.length) : 0
          return (
            <Link
              key={s}
              to={`/ordenes?estado=${s}`}
              className="panel tarjeta-etapa"
              aria-label={`Ver ${n} ${n === 1 ? 'orden' : 'órdenes'} en estado ${etapas[s].nombre}`}
            >
              <div>
                <Estado valor={s} />
                <Icono nombre="externo" size={16} />
              </div>
              <strong>{numero(n)}</strong>
              <small>{p}% del total</small>
              <div className="medidor">
                <i style={{ width: `${p}%` }} />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
export default function Resumen() {
  const r = useLectura(leerEtapas)
  return (
    <>
      <Cabecera
        seccion="Análisis del taller"
        titulo="Resumen por etapa"
        descripcion="Consulta la carga de trabajo y abre las órdenes de cada estado."
      />
      <Aviso error={r.error} reintentar={r.recargar} />
      {r.datos ? (
        <>
          <Monitor ordenes={r.datos} />
          <Distribucion ordenes={r.datos} />
        </>
      ) : (
        r.cargando && <Cargando />
      )}
    </>
  )
}
```


### `frontend/src/styles.css`

```css
@font-face {
  font-family: Manrope;
  src: url('/fonts/manrope-latin.woff2') format('woff2');
  font-style: normal;
  font-weight: 200 800;
  font-display: swap;
}
:root {
  font-family: Manrope, system-ui, sans-serif;
  color: #242823;
  background: #f7f7f3;
  font-synthesis: none;
  --ink: #242823;
  --muted: #656a63;
  --line: #dfe1d9;
  --paper: #f7f7f3;
  --surface: #fff;
  --accent: #c94c1c;
  --hot: #ee6734;
  --tint: #fcece2;
  --mono: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  --rail: 224px;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  min-width: 320px;
}
button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}
button,
select {
  cursor: pointer;
}
button:disabled,
select:disabled {
  cursor: not-allowed;
}
button {
  border: 0;
  background: none;
}
a {
  color: inherit;
  text-decoration: none;
}
button,
a,
input,
textarea,
select {
  outline-offset: 3px;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
}
h1,
h2,
h3,
p,
figure,
dl,
dd,
ul,
ol {
  margin: 0;
}
fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
fieldset:disabled {
  opacity: 0.75;
}
img {
  max-width: 100%;
}
svg {
  flex-shrink: 0;
  vertical-align: middle;
}
button:disabled {
  opacity: 0.5;
}
b,
strong {
  font-weight: 750;
}
h2 {
  font-size: 19px;
  line-height: 1.4;
  font-weight: 800;
  letter-spacing: -0.65px;
}
h3 {
  font-size: 16px;
}
hr {
  height: 1px;
  border: 0;
  background: var(--line);
  margin: 18px 0;
}
.micro,
.ceja,
.etiqueta-tecnica {
  font: 600 10px/1.5 var(--mono);
  text-transform: uppercase;
  letter-spacing: 1.45px;
}
.micro {
  color: var(--muted);
}
.sr,
.saltar:not(:focus) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.saltar:focus {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 100;
  background: #fff;
  padding: 12px;
}
/* Navegación persistente y superficies del puesto de trabajo. */
.shell {
  display: flex;
  min-height: 100dvh;
}
.sidebar {
  width: var(--rail);
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  background: #fcfcf9;
  border-right: 1px solid var(--line);
}
.marca {
  display: flex;
  align-items: center;
  gap: 11px;
  width: max-content;
  margin: 30px 25px 35px;
}
.marca > span {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.marca strong {
  font-size: 30px;
  line-height: 1;
  letter-spacing: -1.9px;
  font-weight: 800;
}
.marca strong span {
  color: var(--hot);
}
.marca small {
  margin-top: 5px;
  color: #62675e;
  font: 600 8.2px/1.2 var(--mono);
  letter-spacing: 1.48px;
}
.marca img {
  display: block;
}
.grupo-nav {
  padding: 0 14px;
}
.grupo-nav + .grupo-nav {
  margin-top: 31px;
}
.grupo-nav p {
  font-size: 9.5px;
  letter-spacing: 1.65px;
  margin: 0 13px 10px;
  color: #777c72;
}
.grupo-nav nav {
  display: grid;
  gap: 4px;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 13px;
  min-height: 42px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 640;
  color: #53594f;
}
.nav-item:hover {
  background: #f1f2ec;
  color: var(--ink);
}
.nav-item.actual {
  background: var(--tint);
  color: #ab4119;
  font-weight: 760;
}
.nav-item.actual:after {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d85a28;
  margin-left: auto;
}
.terminal {
  margin: auto 18px 20px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f6f7f1;
  padding: 13px 11px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.terminal-icono {
  display: grid;
  place-items: center;
  width: 33px;
  height: 33px;
  flex: none;
  border: 1px solid #dbdfd5;
  background: #fff;
  border-radius: 7px;
  color: #5b6257;
}
.terminal b {
  font-size: 11.6px;
  display: block;
}
.terminal small {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: #68715f;
  font-size: 10.5px;
}
.led,
.estado i {
  width: 6px;
  height: 6px;
  display: inline-block;
  border-radius: 50%;
  background: #9c9e98;
}
.led.online {
  background: #389467;
  box-shadow: 0 0 0 2px #dfece0;
}
.espacio {
  margin-left: var(--rail);
  width: calc(100% - var(--rail));
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.barra {
  height: 63px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 clamp(24px, 3.1vw, 54px);
  border-bottom: 1px solid var(--line);
  background: #fbfbf8;
}
.migas,
.fecha-barra {
  display: flex;
  align-items: center;
  gap: 11px;
  color: var(--muted);
  font-size: 11.6px;
}
.migas b {
  color: #42483e;
  font-weight: 680;
}
.slash {
  color: #a3a69c;
  padding: 0 2px;
}
.miga-icono {
  color: #787f73;
}
.fecha-barra {
  font: 11px var(--mono);
  gap: 8px;
  color: #656c60;
}
.migas .abrir-menu,
.menu-movil,
.marca-movil {
  display: none;
}
.espacio main {
  width: 100%;
  max-width: 1520px;
  margin: 0 auto;
  padding: 34px clamp(24px, 3.1vw, 54px) 32px;
  outline: none;
}
.pie {
  margin: auto clamp(24px, 3.1vw, 54px) 0;
  padding: 16px 0 20px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #73796e;
  font-size: 10.6px;
}
.pie span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pie i {
  font-style: normal;
  color: #b3b7ad;
}
.pie .micro {
  font-size: 8.8px;
  letter-spacing: 1.1px;
  color: #777e72;
}
/* Jerarquía tipográfica, mandos y señalización. */
.cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 25px;
}
.ceja {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #896348;
  font-size: 9.7px;
  letter-spacing: 1.65px;
}
.marcas {
  display: inline-block;
  width: 14px;
  height: 10px;
  transform: skew(-23deg);
  background: repeating-linear-gradient(90deg, #d15b2a 0 2.4px, transparent 2.4px 4.9px);
}
h1 {
  font-size: clamp(30px, 2.85vw, 48px);
  line-height: 1.16;
  letter-spacing: -1.75px;
  font-weight: 800;
  margin: 8px 0;
}
.cabecera > div {
  min-width: 0;
}
.cabecera h1 {
  overflow-wrap: anywhere;
}
.cabecera p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}
.boton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 10px 16px;
  min-height: 40px;
  border-radius: 6px;
  font-size: 12.7px;
  font-weight: 720;
  line-height: 1.4;
  white-space: nowrap;
  border: 1px solid transparent;
  transition:
    background 0.15s,
    color 0.15s;
}
.boton.primario {
  background: #c94d1d;
  color: #fff;
  border-color: #bb481b;
  box-shadow: 0 1px 2px #30200912;
}
.boton.primario:hover:not(:disabled) {
  background: #b14015;
}
.boton.secundario {
  background: white;
  border-color: #d8dcd2;
  color: #495043;
}
.boton.secundario:hover:not(:disabled) {
  background: #f5f5f0;
}
.boton.compacto {
  min-height: 32px;
  font-size: 11.7px;
  padding: 6px 11px;
}
.cabecera > .boton {
  margin-top: 11px;
}
.boton-icono,
.ir,
.boton-pagina,
.pagina-num {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 5px;
  color: #646b60;
}
.boton-icono:hover,
.ir:hover {
  background: #f2f3ed;
  color: var(--accent);
}
.enlace {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: #a94118;
  font-size: 12.5px;
  font-weight: 760;
  line-height: 1.5;
}
.enlace:hover {
  text-decoration: underline;
}
.estado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  font-size: 10.8px;
  line-height: 1.3;
  white-space: nowrap;
  border: 1px solid var(--borde);
  border-radius: 6px;
  background: var(--fondo);
  color: var(--texto);
  font-weight: 740;
}
.estado i {
  background: var(--punto);
  width: 5px;
  height: 5px;
}
.azul {
  --fondo: #edf3fc;
  --borde: #d3e1f4;
  --texto: #3a6195;
  --punto: #5585bf;
}
.ambar {
  --fondo: #fff6de;
  --borde: #f0e0b1;
  --texto: #856015;
  --punto: #c09629;
}
.naranja {
  --fondo: #fff0e6;
  --borde: #efcfb8;
  --texto: #a35922;
  --punto: #cf7835;
}
.turquesa,
.verde {
  --fondo: #ecf5ed;
  --borde: #cce2cd;
  --texto: #3c744b;
  --punto: #5f9a6c;
}
.violeta {
  --fondo: #f2eef8;
  --borde: #ded4ec;
  --texto: #72559a;
  --punto: #9577b3;
}
.rojo {
  --fondo: #fbefef;
  --borde: #efd3d3;
  --texto: #954c4c;
  --punto: #b86d6d;
}
.gris {
  --fondo: #f2f3ef;
  --borde: #dbded5;
  --texto: #626a5b;
  --punto: #838b7c;
}
.contador,
.codigo,
.etiqueta-tecnica {
  font-family: var(--mono);
}
.contador {
  padding: 3px 6px;
  background: #f2f3ed;
  border: 1px solid #dfe2d8;
  border-radius: 4px;
  color: #676d60;
  font-size: 10.5px;
  font-weight: 600;
}
/* Monitor: ilustración vectorial propia, retícula y cotas de instrumentación. */
.monitor {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  min-height: 171px;
  border-radius: 10px;
  border: 1px solid #303833;
  background: #252d29;
  color: #f8faf3;
  margin-bottom: 25px;
  background-image:
    linear-gradient(92deg, #252a26 8%, #272d28f0 45%, #2d373200 100%),
    linear-gradient(#c1d0be0c 1px, transparent 1px),
    linear-gradient(90deg, #c1d0be0c 1px, transparent 1px);
  background-size:
    auto,
    17px 17px,
    17px 17px;
}
.monitor:before,
.monitor:after {
  content: '+';
  position: absolute;
  color: #879287;
  font: 13px var(--mono);
  right: 11px;
  top: 5px;
}
.monitor:after {
  top: auto;
  bottom: 6px;
}
.monitor-info {
  flex: 1;
  padding: 22px 26px 24px;
  align-self: center;
  position: relative;
  z-index: 1;
}
.monitor-titulo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.monitor-titulo svg {
  color: #ff915b;
}
.monitor-titulo h2 {
  font: 600 10.3px/1.3 var(--mono);
  letter-spacing: 1.8px;
  text-transform: uppercase;
  color: #d3d9ce;
}
.metricas {
  display: flex;
  margin-top: 19px;
}
.metricas > div {
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-start;
  gap: 3px;
  padding: 0 clamp(15px, 2.15vw, 39px);
  border-left: 1px solid #ffffff29;
}
.metricas > div:first-child {
  padding-left: 0;
  border-left: 0;
}
.metricas dd {
  font: 500 clamp(35px, 3.1vw, 49px)/1 var(--mono);
  letter-spacing: -2px;
}
.metricas > div:nth-child(2) dd {
  color: #ffa36a;
}
.metricas dt {
  font-size: 11.3px;
  color: #ccd3c7;
  white-space: nowrap;
}
.plano {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  flex: 0 0 35%;
  margin: 0 12px 0 -2%;
  min-width: 190px;
}
.plano img {
  position: absolute;
  inset: 3px 0 13px;
  width: 100%;
  height: calc(100% - 21px);
  object-fit: contain;
}
.plano figcaption {
  position: absolute;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #b5bfb2;
  font: 8px/1.2 var(--mono);
  letter-spacing: 1.4px;
}
.plano figcaption i {
  width: 15px;
  height: 1px;
  background: #a0ab9b;
}
/* Registro y controles de consulta. */
.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 9px;
  min-width: 0;
  box-shadow: 0 1px 2px #28342004;
}
.registro-titulo,
.titulo-panel,
.subtitulo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.registro-titulo {
  padding: 20px 22px 16px;
}
.registro-titulo > div,
.titulo-panel > div,
.subtitulo > div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ordenar {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #676e62;
  font-size: 11.5px;
  font-weight: 630;
  padding: 5px 0 5px 6px;
}
.ordenar:hover {
  color: var(--accent);
}
.herramientas {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 22px 18px;
}
.busqueda,
.select-filtro {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid #dce0d5;
  border-radius: 6px;
  background: #fdfefb;
  height: 38px;
  position: relative;
  color: #7d8377;
}
.busqueda {
  flex: 1;
  min-width: 0;
  padding: 0 12px;
}
.busqueda input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  min-width: 0;
  height: 100%;
  padding: 0;
  color: var(--ink);
}
.busqueda:focus-within,
.select-filtro:focus-within {
  outline: 2px solid #d67348;
  outline-offset: 1px;
}
.busqueda input::placeholder {
  color: #7b8076;
}
.select-filtro {
  width: 177px;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 0 11px;
  color: #61685b;
}
.select-filtro select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 6px;
  appearance: none;
  outline: 0;
  background: transparent;
  font-size: 11.9px;
  font-weight: 650;
  padding: 0 25px 0 35px;
}
.select-filtro svg {
  pointer-events: none;
}
.tabla-scroll {
  overflow: auto;
}
.tabla-ordenes {
  border-collapse: collapse;
  width: 100%;
  text-align: left;
  font-size: 13px;
}
.tabla-ordenes th {
  background: #f6f7f2;
  padding: 10px 9px;
  border-block: 1px solid var(--line);
  color: #747a6d;
  font: 600 9.5px/1.3 var(--mono);
  letter-spacing: 1.1px;
  text-transform: uppercase;
}
.tabla-ordenes td {
  border-bottom: 1px solid #e9ebe4;
  padding: 15px 9px;
  line-height: 1.45;
  font-weight: 560;
}
.tabla-ordenes th:first-child,
.tabla-ordenes td:first-child {
  padding-left: 22px;
}
.tabla-ordenes th:last-child,
.tabla-ordenes td:last-child {
  padding-right: 18px;
}
.tabla-ordenes tr:hover td {
  background: #fdfdf9;
}
.tabla-ordenes td small,
.directorio small {
  display: block;
  color: var(--muted);
  font-size: 11.2px;
  font-weight: 500;
  margin-top: 3px;
}
.codigo {
  font-size: 11.9px;
  font-weight: 650;
  letter-spacing: 0.1px;
  color: #4b5047;
}
.codigo:hover,
.nombre-equipo:hover {
  color: var(--accent);
  text-decoration: underline;
}
.celda-equipo {
  display: flex;
  align-items: center;
  gap: 11px;
}
.equipo-icono {
  flex: none;
  width: 36px;
  height: 36px;
  border: 1px solid #dee2d6;
  background: #f3f5ee;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: #5c6557;
}
.nombre-equipo {
  font-weight: 760;
  font-size: 13.8px;
}
.celda-ir {
  text-align: right;
}
.ir {
  width: 26px;
  height: 26px;
  border: 1px solid #e1e4da;
  background: #fff;
  color: #666e5e;
}
.paginacion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 21px;
  color: var(--muted);
  font-size: 11px;
}
.paginacion > div {
  display: flex;
  align-items: center;
  gap: 5px;
}
.boton-pagina,
.pagina-num {
  width: 25px;
  height: 25px;
  border: 1px solid #e1e4db;
  background: #fff;
  font: 600 11px var(--mono);
}
.boton-pagina:disabled {
  opacity: 0.44;
}
.pagina-num {
  background: #f2f3ed;
  border-color: #d9ddd3;
  color: #4d5546;
}
.boton-pagina:not(:disabled):hover {
  border-color: #d67348;
}
/* Formularios y detalle. */
.dos-columnas {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 0.9fr);
  align-items: start;
  gap: 19px;
}
.pila,
.campos {
  display: grid;
  gap: 18px;
}
.titulo-panel {
  padding: 17px 21px;
  border-bottom: 1px solid var(--line);
}
.titulo-panel h2 {
  font-size: 16px;
  letter-spacing: -0.4px;
}
.titulo-panel svg {
  color: #6b7564;
}
.cuerpo-panel {
  padding: 21px;
}
.campos label,
.label,
.label-fila {
  display: block;
  font-size: 12.6px;
  font-weight: 730;
}
.campos label > input,
.campos label > textarea,
.campos label > select,
.label-fila + select {
  display: block;
  width: 100%;
  margin-top: 7px;
  padding: 10px 12px;
  border: 1px solid #d4d9cd;
  background: #fdfefb;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
}
.campos input::placeholder,
.campos textarea::placeholder {
  color: #7b8076;
}
.campos textarea {
  resize: vertical;
  min-height: 70px;
}
.campos select {
  min-height: 40px;
}
.label-fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.label small {
  margin-left: 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
}
.acciones-form,
.acciones {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
}
.acciones-form {
  border-top: 1px solid var(--line);
  margin-top: 21px;
  padding-top: 17px;
  justify-content: flex-end;
}
.subir {
  width: 100%;
  margin-top: 8px;
  display: grid;
  justify-items: center;
  gap: 5px;
  background: #fafbf7;
  border: 1px dashed #bdc5b5;
  border-radius: 6px;
  padding: 18px 10px;
  color: #616b58;
  font-size: 12px;
}
.subir:hover {
  border-color: var(--accent);
}
.subir svg {
  margin-bottom: 4px;
}
.subir small,
.nota,
.ayuda p,
.confirmacion p {
  color: var(--muted);
  line-height: 1.65;
  font-size: 12.5px;
}
.archivos,
.directorio {
  list-style: none;
  padding: 0;
}
.archivos li {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
  padding: 6px 0;
  overflow-wrap: anywhere;
}
.archivos button {
  margin-left: auto;
  flex-shrink: 0;
}
.ayuda {
  padding: 21px;
  background: #f0f2e9;
}
.ayuda h2 {
  margin: 7px 0 12px;
}
.ayuda .estado {
  margin-bottom: 13px;
}
.etiqueta-tecnica {
  color: #767f6a;
  font-size: 9px;
}
.nota {
  display: flex;
  align-items: flex-start;
  gap: 7px;
}
.nota svg {
  margin-top: 3px;
}
.nota-accion {
  margin-bottom: 14px;
}
.confirmacion p {
  margin: 5px 0 13px;
}
.datos-cliente {
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--line);
  padding-bottom: 16px;
  margin-bottom: 17px;
  font-size: 13px;
}
.datos-cliente p {
  margin-bottom: 5px;
}
.datos-cliente a:hover {
  text-decoration: underline;
}
.ficha > .micro,
.presupuesto > .micro {
  margin-bottom: 7px;
}
.ficha > .texto-largo {
  margin-bottom: 18px;
}
.texto-largo {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.7;
}
.galeria {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.galeria img {
  display: block;
  width: 76px;
  height: 76px;
  object-fit: cover;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.historial {
  padding: 21px;
  list-style: none;
}
.historial li {
  position: relative;
  padding: 0 0 20px 19px;
  border-left: 1px solid #d9dfd2;
  margin-left: 4px;
}
.historial li:last-child {
  padding-bottom: 0;
  border-left-color: transparent;
}
.historial li:before {
  content: '';
  position: absolute;
  left: -4px;
  top: 5px;
  background: #b7c1aa;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px #fff;
}
.historial li:first-child:before {
  background: var(--hot);
}
.historial b,
.historial span,
.historial time {
  display: block;
  font-size: 12.7px;
}
.historial span {
  color: var(--muted);
  font-size: 11.6px;
  margin: 2px 0 4px;
}
.historial time {
  font: 10px var(--mono);
  color: #747c6c;
}
.linea-pieza {
  display: grid;
  align-items: end;
  grid-template-columns: minmax(80px, 1fr) 65px 75px 24px;
  gap: 8px;
  margin-top: 12px;
}
.linea-pieza label {
  font-size: 11px;
}
.linea-pieza label > input {
  padding: 8px;
}
.linea-pieza button {
  margin-bottom: 3px;
  width: 24px;
}
.piezas > .nota {
  margin-top: 9px;
}
.total {
  background: #f2f4ec;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border-radius: 6px;
  padding: 15px;
  font-size: 13px;
}
.total strong {
  font: 650 19px var(--mono);
  letter-spacing: -0.7px;
}
.renglon {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12.8px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
}
.renglon small {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-top: 3px;
}
.presupuesto .total {
  margin-top: 15px;
}
.presupuesto .texto-largo {
  margin-bottom: 9px;
}
.auto-ancho {
  justify-self: start;
}
/* Vistas auxiliares y estados explícitos de la API. */
.resumen-seccion {
  margin-top: 24px;
}
.subtitulo {
  margin-bottom: 14px;
}
.cuadricula {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 13px;
}
.tarjeta-etapa {
  padding: 16px;
}
.tarjeta-etapa:hover {
  border-color: #cba98d;
  background: #fffefa;
}
.tarjeta-etapa > div:first-child {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #848c7c;
}
.tarjeta-etapa strong {
  font: 550 29px var(--mono);
  display: inline-block;
  margin: 17px 8px 8px 0;
  letter-spacing: -1.4px;
}
.tarjeta-etapa small {
  font-size: 10.5px;
  color: var(--muted);
}
.medidor {
  height: 3px;
  background: #ebeee5;
  border-radius: 2px;
}
.medidor i {
  display: block;
  height: 100%;
  background: #d97848;
  border-radius: inherit;
}
.directorio li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 21px;
  font-size: 14px;
  border-top: 1px solid var(--line);
}
.directorio .boton {
  margin-left: auto;
}
.avatar,
.icono-vacio {
  width: 36px;
  height: 36px;
  border: 1px solid #dbe1d0;
  background: #f1f4e9;
  display: grid;
  place-items: center;
  border-radius: 7px;
  font: 600 13px var(--mono);
  color: #5b6b4b;
}
.panel > .titulo-panel + .herramientas {
  padding-top: 16px;
}
.dialogo,
.menu-movil {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 10px;
  padding: 22px;
  box-shadow: 0 18px 80px #13190c26;
}
.dialogo {
  width: min(435px, calc(100% - 26px));
}
.dialogo::backdrop,
.menu-movil::backdrop {
  background: #1d241d69;
}
.dialogo header,
.menu-cabeza {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.dialogo header {
  margin-bottom: 20px;
}
.dialogo h2 {
  font-size: 23px;
  margin-top: 3px;
}
.cargando,
.vacio,
.no-encontrada {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--muted);
  text-align: center;
  padding: 38px 15px;
  gap: 10px;
}
.cargando {
  font-size: 12px;
}
.campos .cargando {
  padding: 5px;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #dedfd6;
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: giro 0.8s linear infinite;
}
@keyframes giro {
  to {
    transform: rotate(360deg);
  }
}
.aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #fff1e9;
  color: #954222;
  border: 1px solid #eac2ae;
  border-radius: 6px;
  padding: 13px;
  margin: 10px 0;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.aviso .enlace {
  margin-left: auto;
}
.vacio,
.no-encontrada {
  flex-direction: column;
}
.vacio h3,
.no-encontrada h1 {
  color: var(--ink);
}
.vacio p,
.no-encontrada p {
  font-size: 13px;
}
.no-encontrada {
  padding: 50px 15px;
}
.no-encontrada > strong {
  font: 550 68px var(--mono);
  letter-spacing: -6px;
  color: var(--accent);
}
.no-encontrada .boton {
  margin-top: 12px;
}
.vacio .enlace {
  margin-top: 5px;
}
@media (min-width: 1600px) {
  :root {
    --rail: 248px;
  }
  .monitor {
    min-height: 194px;
  }
  .tabla-ordenes td {
    padding-block: 19px;
  }
}
@media (max-width: 1160px) {
  :root {
    --rail: 200px;
  }
  .espacio main {
    padding-inline: 26px;
  }
  .barra {
    padding-inline: 26px;
  }
  .grupo-nav {
    padding-inline: 10px;
  }
  .nav-item {
    gap: 9px;
    font-size: 12.3px;
  }
  .marca {
    margin-left: 23px;
  }
  .metricas > div {
    padding-inline: 17px;
  }
  .plano {
    flex-basis: 33%;
  }
  .tabla-ordenes td {
    padding-inline: 7px;
  }
  .celda-equipo {
    gap: 8px;
  }
  .equipo-icono {
    width: 32px;
    height: 32px;
  }
  .tabla-ordenes th:first-child,
  .tabla-ordenes td:first-child {
    padding-left: 16px;
  }
  .tabla-ordenes td:last-child {
    padding-right: 12px;
  }
  .dos-columnas {
    grid-template-columns: minmax(0, 1.7fr) minmax(195px, 0.85fr);
    gap: 13px;
  }
}
@media (max-width: 960px) {
  :root {
    --rail: 183px;
  }
  .marca {
    margin-left: 18px;
  }
  .terminal {
    margin-inline: 10px;
  }
  .nav-item {
    padding-inline: 10px;
  }
  .espacio main {
    padding-inline: 20px;
  }
  .barra {
    padding-inline: 20px;
  }
  .cabecera p {
    font-size: 12px;
  }
  .monitor-info {
    padding-left: 18px;
    padding-right: 5px;
  }
  .metricas > div {
    padding-inline: 12px;
  }
  .metricas dt {
    font-size: 10.3px;
  }
  .plano {
    min-width: 150px;
  }
  .tabla-ordenes td,
  .nombre-equipo {
    font-size: 11.7px;
  }
  .equipo-icono {
    display: none;
  }
  .registro-titulo {
    padding-inline: 16px;
  }
  .herramientas {
    padding-inline: 16px;
  }
  .dos-columnas {
    grid-template-columns: 1fr;
  }
  .ayuda {
    max-width: none;
  }
}
@media (max-width: 760px) {
  .sidebar {
    display: none;
  }
  .espacio {
    margin: 0;
    width: 100%;
  }
  .migas .abrir-menu {
    display: inline-grid;
  }
  .miga-icono {
    display: none;
  }
  .menu-movil[open] {
    display: block;
    width: min(295px, 86vw);
    height: 100dvh;
    max-height: none;
    max-width: none;
    margin: 0 auto 0 0;
    border-radius: 0;
    padding: 8px 12px;
  }
  .menu-cabeza .marca {
    margin: 17px 6px 25px;
  }
  .menu-cabeza > .boton-icono {
    align-self: flex-start;
    margin-top: 16px;
  }
  .barra {
    height: 54px;
    padding-inline: 16px;
  }
  .espacio main {
    padding: 25px 18px;
  }
  .pie {
    margin-inline: 18px;
  }
  .cabecera {
    margin-bottom: 18px;
  }
  .cabecera h1 {
    font-size: 31px;
  }
  .monitor {
    min-height: 150px;
    margin-bottom: 18px;
  }
  .plano {
    flex-basis: 32%;
  }
  .registro-titulo h2 {
    font-size: 17px;
  }
  .equipo-icono {
    display: grid;
  }
  .terminal {
    display: none;
  }
  .tabla-ordenes {
    min-width: 572px;
  }
  .tabla-ordenes td {
    padding-block: 13px;
  }
  .cuadricula {
    grid-template-columns: repeat(2, 1fr);
  }
  .migas,
  .fecha-barra {
    font-size: 10.5px;
    gap: 7px;
  }
  .dos-columnas {
    gap: 15px;
  }
}
@media (max-width: 540px) {
  .espacio main {
    padding: 22px 14px;
  }
  .miga-raiz,
  .migas .slash,
  .migas > b {
    display: none;
  }
  .marca-movil {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.9px;
    color: var(--ink);
  }
  .cabecera {
    flex-wrap: wrap;
    gap: 8px;
  }
  .cabecera > .boton {
    margin-top: 4px;
  }
  .cabecera h1 {
    font-size: 30px;
    margin-block: 6px;
  }
  .cabecera p {
    font-size: 12.4px;
  }
  .monitor {
    min-height: 140px;
  }
  .monitor-info {
    padding: 18px 14px;
    align-self: end;
  }
  .monitor-titulo h2 {
    font-size: 9px;
  }
  .metricas {
    margin-top: 14px;
    justify-content: flex-start;
  }
  .metricas > div {
    align-items: flex-start;
    flex: 1;
    gap: 4px;
    padding-inline: 10px;
  }
  .metricas > div:first-child {
    padding-left: 0;
  }
  .metricas > div:last-child {
    padding-right: 0;
  }
  .metricas dd {
    font-size: 32px;
  }
  .metricas dt {
    font-size: 9.6px;
  }
  .plano {
    position: absolute;
    right: 19px;
    top: -7px;
    width: 91px;
    height: 64px;
    min-width: 0;
    opacity: 0.72;
  }
  .plano img {
    inset: 0;
    height: 100%;
  }
  .plano figcaption {
    display: none;
  }
  .registro-titulo {
    padding: 15px 13px 13px;
  }
  .registro-titulo > div {
    gap: 6px;
  }
  .registro-titulo h2 {
    font-size: 16px;
  }
  .ordenar {
    font-size: 10px;
    gap: 3px;
  }
  .herramientas {
    flex-wrap: wrap;
    gap: 7px;
    padding: 0 13px 12px;
  }
  .busqueda {
    flex-basis: 100%;
  }
  .select-filtro {
    height: 33px;
    width: 100%;
  }
  .paginacion {
    padding: 10px 13px;
  }
  .cabecera .boton,
  .acciones .boton {
    min-height: 38px;
  }
  .titulo-panel,
  .cuerpo-panel,
  .ayuda {
    padding: 15px;
  }
  .linea-pieza {
    grid-template-columns: 1fr 62px 67px 20px;
    gap: 4px;
  }
  .pila,
  .campos {
    gap: 14px;
  }
  .cuadricula {
    gap: 8px;
  }
  .tarjeta-etapa {
    padding: 11px;
  }
  .tarjeta-etapa > div > svg {
    width: 12px;
  }
  .pie {
    margin-inline: 14px;
  }
  .estado {
    font-size: 10px;
  }
  .aviso {
    flex-wrap: wrap;
  }
  .tabla-ordenes {
    min-width: 0;
  }
  .tabla-ordenes thead {
    position: absolute;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    overflow: hidden;
  }
  .tabla-ordenes tbody {
    display: block;
    border-top: 1px solid var(--line);
  }
  .tabla-ordenes tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 23px;
    gap: 5px 7px;
    align-items: center;
    padding: 13px;
    border-bottom: 1px solid var(--line);
  }
  .tabla-ordenes td,
  .tabla-ordenes td:first-child,
  .tabla-ordenes td:last-child {
    padding: 0;
    border: 0;
  }
  .tabla-ordenes td:first-child {
    grid-column: 1;
    grid-row: 1;
  }
  .tabla-ordenes td:first-child small {
    display: none;
  }
  .tabla-ordenes td:nth-child(2) {
    grid-column: 1;
    grid-row: 2;
  }
  .tabla-ordenes td:nth-child(3) {
    grid-column: 1;
    grid-row: 3;
    color: var(--muted);
    font-size: 11px;
  }
  .tabla-ordenes td:nth-child(4) {
    grid-column: 2;
    grid-row: 2;
  }
  .tabla-ordenes td:last-child {
    grid-column: 3;
    grid-row: 2;
  }
  .tabla-ordenes .codigo {
    font-size: 10px;
  }
  .tabla-ordenes .nombre-equipo {
    font-size: 13px;
  }
  .tabla-ordenes .equipo-icono,
  .tabla-ordenes .celda-equipo small {
    display: none;
  }
  .ir {
    width: 23px;
    height: 23px;
  }
  .paginacion .boton-pagina {
    width: 30px;
    height: 30px;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0s !important;
    transition: none !important;
  }
}
```


### `frontend/public/osciloscopio.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <pattern id="reticula" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 9V0h9" stroke="#82918c" stroke-width=".45"/></pattern>
    <pattern id="ranuras" width="5" height="4" patternUnits="userSpaceOnUse" patternTransform="skewY(-32)"><path d="M1 1v1.5" stroke="#a0a9a3" stroke-width="1.1"/></pattern>
  </defs>
  <g stroke="#a7b5ad" opacity=".45" stroke-width=".65"><path d="M14 88h34M31 80v16m247-89v23m-8-12h16m41 89v24m-10-12h22M39 128l-14 8m17 5-14 8m103 8v10m106-5v10"/><path d="m34 145 93 7m8 .5 122 10m-226-21 8 8m211 9 8 8m60-119 8 67m-6-69 8 3m-5 65 8 3"/></g>
  <g transform="matrix(1,.08,0,1,57,39)" stroke="#c3cec5" stroke-width="1.1">
    <path d="m-4 17-6 4v65l8 7 8-4m-12-65 3 2v53l4 3" fill="#303937"/>
    <path d="M3 99v7l9 1 5-5m146-4v9l12 1 8-7m46-27v7l5 1 6-6" fill="#25322e"/>
    <path d="m1 0 34-24q3-2 7-2h176q5 0 6 5l4 92q0 4-3 6l-34 24" fill="#38423f"/>
    <path d="m2 3 35-24q3-2 7-2l171 1M188 5l34-24m-28 26 33-22M196 89l30-21m-27-57 24-16 2 56-25 18z"/>
    <path d="m200 14 21-15 2 50-22 17z" fill="url(#ranuras)" stroke-width=".45"/>
    <path d="M63-14v-7q0-5 5-8l6-4q2-1 5-1h60q4 0 4 4l1 15-7 5-1-14H79v11l-7 5-9-1Zm10 4-1-14q0-4 4-6m-12 9 8 1m62-12 7 2m-72 20 7 1m60-1 8-5" fill="#333d39"/>
    <rect x="0" y="0" width="194" height="102" rx="6" fill="#303936" stroke-width="1.6"/>
    <rect x="3.5" y="3.5" width="187" height="95" rx="4" stroke-width=".65"/>
    <rect x="10" y="10" width="111" height="68" rx="4" fill="#29322f"/>
    <rect x="14" y="14" width="103" height="60" rx="2" fill="url(#reticula)" stroke-width=".65"/>
    <path d="M15 45h101M65 16v57" stroke-width=".5" stroke-dasharray="2 2"/>
    <path d="M16 46c5 0 6-15 12-15s6 28 12 28 6-32 13-32 7 36 14 36 7-39 14-39 6 34 13 34 7-21 13-21q5 0 8 7" stroke="#ff9260" stroke-width="2"/>
    <g fill="#65726a" stroke-width=".65"><rect x="12" y="84" width="13" height="6" rx="1.2"/><rect x="30" y="84" width="13" height="6" rx="1.2"/><rect x="48" y="84" width="13" height="6" rx="1.2"/><rect x="66" y="84" width="13" height="6" rx="1.2"/><rect x="84" y="84" width="13" height="6" rx="1.2"/></g>
    <g stroke-width=".8"><path d="M128 12h18m5 0h14m5 0h13M129 43h54M129 73h54"/><circle cx="137" cy="27" r="8"/><circle cx="137" cy="27" r="6"/><path d="m137 27 3-4"/><circle cx="169" cy="28" r="10"/><circle cx="169" cy="28" r="7.5"/><path d="m169 28-3-5m-11 5h2m2-10 2 2m8-6v2m8 3 2-2m2 11h2"/><circle cx="137" cy="57" r="7"/><circle cx="137" cy="57" r="4.7"/><path d="m137 57 3-2"/><circle cx="169" cy="57" r="8"/><circle cx="169" cy="57" r="5.6"/><path d="m169 57 2-4"/><circle cx="135" cy="86" r="5"/><circle cx="135" cy="86" r="2.5"/><circle cx="151" cy="86" r="5"/><circle cx="151" cy="86" r="2.5"/><path d="M167 83h13v5h-13z"/></g>
    <g fill="#e6aa7f" stroke="none"><circle cx="108" cy="87" r="1.8"/><rect x="17" y="18" width="7" height="1.5"/><rect x="27" y="18" width="4" height="1.5"/></g>
  </g>
  <g stroke="#c99572" stroke-width=".7" opacity=".9"><path d="m242 47 37-27h38"/><circle cx="242" cy="47" r="2"/><path d="m58 106-20 13H14"/></g>
  <g fill="#b7bdb4" font-family="monospace" font-size="7" letter-spacing="1.1"><text x="289" y="16">CH.01</text><text x="9" y="129">X–Y</text></g>
</svg>
```


### `frontend/public/voltio.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#ed632e"/><path d="M5 23h8l5-12 4 18 5-12h8" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
```


### `frontend/public/fonts/manrope-latin.woff2`

[Fuente variable Manrope, archivo binario incluido en el proyecto](./frontend/public/fonts/manrope-latin.woff2). Se sirve localmente; no depende de un CDN.

### `frontend/public/fonts/OFL.txt`

```text
Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```


<details><summary><strong>frontend/package-lock.json</strong> · manifiesto completo de dependencias reproducibles</summary>

### `frontend/package-lock.json`

```json
{
  "name": "voltio-taller",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "voltio-taller",
      "version": "1.0.0",
      "dependencies": {
        "react": "19.2.9",
        "react-dom": "19.2.9",
        "react-router": "7.18.5"
      },
      "devDependencies": {
        "@vitejs/plugin-react": "5.2.0",
        "vite": "7.3.8"
      },
      "engines": {
        "node": ">=22.12.0"
      }
    },
    "node_modules/@babel/code-frame": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-validator-identifier": "^7.29.7",
        "js-tokens": "^4.0.0",
        "picocolors": "^1.1.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/compat-data": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/core": {
      "version": "7.29.13",
      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.13.tgz",
      "integrity": "sha512-j1nvOQCZYSgp7HLmisnCXFTpVvFODiijQ9QHkORfGKWH6YDtskTEeCJS7eV545GZ9UBzrq0e2xsOd5QQ5PjIqw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.29.7",
        "@babel/generator": "^7.29.13",
        "@babel/helper-compilation-targets": "^7.29.13",
        "@babel/helper-module-transforms": "^7.29.13",
        "@babel/helpers": "^7.29.13",
        "@babel/parser": "^7.29.13",
        "@babel/template": "^7.29.7",
        "@babel/traverse": "^7.29.13",
        "@babel/types": "^7.29.11",
        "@jridgewell/remapping": "^2.3.5",
        "convert-source-map": "^2.0.0",
        "debug": "^4.1.0",
        "gensync": "^1.0.0-beta.2",
        "json5": "^2.2.3",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/babel"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.29.14",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.14.tgz",
      "integrity": "sha512-qSY56jgW5JnSXzuekLVil6zaOQxOCtOHidr65KkaMBw772IuAY28Qx4ZykAcDn8+FRF15qk80XzKwgSc/RYW6g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.29.14",
        "@babel/types": "^7.29.14",
        "@jridgewell/gen-mapping": "^0.3.12",
        "@jridgewell/trace-mapping": "^0.3.28",
        "jsesc": "^3.0.2"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-compilation-targets": {
      "version": "7.29.13",
      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.29.13.tgz",
      "integrity": "sha512-8WxJ4/Vmes3ghacj8VOJy3NW8eyHiFY/4thU/LSBuBE470+igjR/j1ZTNn8fV5VdNrLx6iXUwig526UdOvfP0w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/compat-data": "^7.29.7",
        "@babel/helper-validator-option": "^7.29.7",
        "browserslist": "^4.24.0",
        "lru-cache": "^5.1.1",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-globals": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.29.7.tgz",
      "integrity": "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-imports": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.29.7.tgz",
      "integrity": "sha512-ejHwrQQYcm9xnTivShn2IDOlIzInN34AXskvq9QicvCtEzq1Vzclu/tKF8Jq1Cg8JG2GL6/EmjgsCT7lXepE3g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/traverse": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-transforms": {
      "version": "7.29.14",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.29.14.tgz",
      "integrity": "sha512-2XDvQVd9JESaOgGc4jT2/jquTAO7ppA5noTZQqH+MmZ89yjCzScLwtCPbWtkPZylL+TLWR49IwWmk+QkRR4GsA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-imports": "^7.29.7",
        "@babel/helper-validator-identifier": "^7.29.7",
        "@babel/traverse": "^7.29.14"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-plugin-utils": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-plugin-utils/-/helper-plugin-utils-7.29.7.tgz",
      "integrity": "sha512-G7sHYigPY17oO5SYWnfD/0MTBwVR781S/JI643e/JhUYgVgWE/61SoW3NH9KWUKyKq5LVh3npif99Wkt6j86Jw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.29.14",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.29.14.tgz",
      "integrity": "sha512-CXvKMFvM80ihI7Vox9jb+kQjnyjESQNPM+vB7U0Zz6TWuZA+Z/FL0QPMH300h33qJtIx+REeBhXqWOPW48TcAQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.29.7.tgz",
      "integrity": "sha512-qehxGkRj55h/ff8EMaJ+cYhyaKlHIxqYDn682wQD7RNp9UujOQsHog2uS0r2vzr4pW+sXf90NeeayjcNaX3fFg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-option": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-option/-/helper-validator-option-7.29.7.tgz",
      "integrity": "sha512-N9ZErrD+yW5geCDtBqnOoxmR8+tNKiGuxKlDpuJxfsqpa2dFcexaziGAE/qoHLiDDreVNMupxGmSoNlyvsA3gw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helpers": {
      "version": "7.29.14",
      "resolved": "https://registry.npmjs.org/@babel/helpers/-/helpers-7.29.14.tgz",
      "integrity": "sha512-6E3Mi1r0B0umq6vmZa4/78q+64fqO2YY0THUdjDPKUCKhNb0yQy5NQIaPHCSD3ryTgiTss//P4JsWS80AsZ6LQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/template": "^7.29.7",
        "@babel/types": "^7.29.14"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.29.14",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.29.14.tgz",
      "integrity": "sha512-VL220vXuyO2z3rNIQwY7ftj9UwpqOt+33sH+sBWkOekbsSR2g7EEMnOx24ZlCH0xOA3DM/33SifVFGbnJD8r/w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.29.14"
      },
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/plugin-transform-react-jsx-self": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-react-jsx-self/-/plugin-transform-react-jsx-self-7.29.7.tgz",
      "integrity": "sha512-TL0hMc9xzy86VD31nUiwzd5otRAcyEPcsegCxolO0PvcXuH1v0kECe/UIznYFihpkvU5wg/jk4v0TTEFfm53fw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-react-jsx-source": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-react-jsx-source/-/plugin-transform-react-jsx-source-7.29.7.tgz",
      "integrity": "sha512-06IyK09H3wi4cGbhDBwp5gUGo0IKtnYa8tyTiephirPCK6fbobVGiXMMI5zLQ4aKEYP3wZ3ArU44o+8KMrSG/Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/template": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/template/-/template-7.29.7.tgz",
      "integrity": "sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.29.7",
        "@babel/parser": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/traverse": {
      "version": "7.29.14",
      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-7.29.14.tgz",
      "integrity": "sha512-RAdQJrBgmIH1FWvN0X+1hoDxzMzlP4cv/1Zi4dn4tG1H0cTb+rw7CzUxQJhp1f4ANd8j5vH3fy8BAWFGkBDEsA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.29.7",
        "@babel/generator": "^7.29.14",
        "@babel/helper-globals": "^7.29.7",
        "@babel/parser": "^7.29.14",
        "@babel/template": "^7.29.7",
        "@babel/types": "^7.29.14",
        "debug": "^4.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.29.14",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.29.14.tgz",
      "integrity": "sha512-UjI/dKmwJwT9pOszJitq2G6EObZPnsZUfdCr92z2TlF3EZK9J3EdfOKUrCzHl6wFthbzwhzl1Soc/UIwxRiq6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.29.14",
        "@babel/helper-validator-identifier": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@esbuild/aix-ppc64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.28.2.tgz",
      "integrity": "sha512-XExcO+dvLKvVtNTibSTBej1NCAbaGhWn9Ww1ZPx80qsahhPFe/8jgWP0IchNe0F3HwkU7n8ejhH8bjonqht8mQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "aix"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm/-/android-arm-0.28.2.tgz",
      "integrity": "sha512-kXXoiPVVGQcnIYGOeaovwOURpniDBpSq4A03qkQ+BMQqtGG6HYap3xne9C1O1yo4TR3qxlCX5IqqmX6fFo2Lqg==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-arm64/-/android-arm64-0.28.2.tgz",
      "integrity": "sha512-5YfKeeI8qWfBZIX+u2xZC3Zlb3Os/gLS2sbEKM+I4ZOcsWmHS2WLysCcQZDAFRslDUU5Oiq44gf6PYN1vGwG5A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/android-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/android-x64/-/android-x64-0.28.2.tgz",
      "integrity": "sha512-O387ite7SzUyCcy3JQX4P4bLtEA7bLLkx+esve5JHnyYfNTxcVpXZo9jhdB0lTKN44gztELTdU7nS8Nr16Fs1Q==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.28.2.tgz",
      "integrity": "sha512-n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/darwin-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.28.2.tgz",
      "integrity": "sha512-uq6suIWYP37qzGddBKPw5QEQPi6HiLGsO7UmkpfyaYNQ3D+rN6w6WfwH+nuqcGXWvawGwxOEroO4YGnFh95azw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-arm64/-/freebsd-arm64-0.28.2.tgz",
      "integrity": "sha512-n+I0BTSRIoy+d6RPKnEVwql5UwBJolytvY4mAOIEJorKlqgPII8ix6slVVrfZ5Tnj7glIZvloylbB/EJPMWEXw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/freebsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-x64/-/freebsd-x64-0.28.2.tgz",
      "integrity": "sha512-78XJTJkvPs0kz2w61301PJjXl4g7q3JqiYMZ/M/yVI73EHBrCRTgkhu9oqG7vPqq+a/yadEW8aD+agKlk5xrmg==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm/-/linux-arm-0.28.2.tgz",
      "integrity": "sha512-XlDnu2q5yoqems+xay6wSAcg9DDD7K9RLKZEBOMZm3ckNpJBvOX20tSfby8KfrrhINDyv9V2YVZKY/SpoGJI8w==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.28.2.tgz",
      "integrity": "sha512-pW4AC0P3it8c7do9MVM4p51FzHzdM/TZrerurgRcHJ2WTa1VQ1CIq18xncfpBJw4ojkiZZrKW2yIBWBP92j6Ug==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ia32": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ia32/-/linux-ia32-0.28.2.tgz",
      "integrity": "sha512-CYbnj78HsIeA+DhgUKgFCfvNsTHFhMMrinUrMZpDXJXKN8T3XViTZ/+wtHeVxEWY8ewSzTFN+nRmSwO2tZaLUQ==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-loong64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-loong64/-/linux-loong64-0.28.2.tgz",
      "integrity": "sha512-buwkd8nsph4R+ajRvw0qM5Hja/TXQow3ptzWO2EbG/cqcIkHloRrdlBtQlshyYGTNFvfkfJ5tpPLVkY4DtsPfQ==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-mips64el": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-mips64el/-/linux-mips64el-0.28.2.tgz",
      "integrity": "sha512-ZVykbDyk7519VwiNb9Lcj9m8XM6v5V9uKPvrEMkkEedVewf+0itkhahp4HDpgERXhwLRpWFypsGbG/J8s0QjJA==",
      "cpu": [
        "mips64el"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-ppc64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-ppc64/-/linux-ppc64-0.28.2.tgz",
      "integrity": "sha512-CAXl+Dtd9UUuJd8pKKdwh6MLm3MUMiqMPmhZ3tTSXPqfyQ3vDl6R5hZdZ/kYojK4ofXtdfSv1tFq8XzWx3heNQ==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-riscv64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-riscv64/-/linux-riscv64-0.28.2.tgz",
      "integrity": "sha512-GeXCej4IQtU1B+QlDV8W/RRvbzI3O/Stss+/bCXv4lZls5WGRtu2a+3JkA3i4qIUlMXpcHebWpF8AkJhATowuA==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-s390x": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-s390x/-/linux-s390x-0.28.2.tgz",
      "integrity": "sha512-3H1weTYZPxt/WOhByszQZybS9w5lKzUn1FDMsgEChbHWQwHYQQRfBxgCcZvPhjHfKyJjIievvMmEUawJrdY9Dg==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/linux-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.28.2.tgz",
      "integrity": "sha512-4xTZr1FUmSoQW4XIWmit3tzQrUTZM+N3P0XV8xROKYF50XfI7xeO90+1bZvNwxIufQ9hDQVRJH5YhgPVF8A/HQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-arm64/-/netbsd-arm64-0.28.2.tgz",
      "integrity": "sha512-sSATRjPeDBg3pdgHoQfoYBob11Kk1FGa9lui5RIHZCoCkJa9QKlvl3/vKz2usCmYYjs7ymJR/2Nnsqe+Hjt5nw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/netbsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-x64/-/netbsd-x64-0.28.2.tgz",
      "integrity": "sha512-lqnzCV+mM0gIADaKihiCg6ifgfU2L3h5E33rNQBN1Y4MaVGnzryzmvvf7UHxprpQdE8hpqLolJ9Rl+SkIRDpyw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "netbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-arm64/-/openbsd-arm64-0.28.2.tgz",
      "integrity": "sha512-AL2qJILH7lNjrDmCQDvdxMfAUIv8KMNZOvrwAQ8i8//ntL9FflhOyMJ8OZSMBb8/AWXe3/5v5S20y3zCoZWKoQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openbsd-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-x64/-/openbsd-x64-0.28.2.tgz",
      "integrity": "sha512-QtiuPytchRyC4rwUKhexJdQKvDuZ6hWloi3igqPQNUJCS1/v9EiO3UTOXR6A3FoMo4fnAKbWJdqaIwhOzh8qEw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/openharmony-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/openharmony-arm64/-/openharmony-arm64-0.28.2.tgz",
      "integrity": "sha512-WkhYDmpTjLvGlScA1rwjRUmhl4k8oXR3cIbtqWmELgU/dFeHHlEllxDvdWcNJV9rbzCexB5vz8gtNewWLgCT7Q==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/sunos-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/sunos-x64/-/sunos-x64-0.28.2.tgz",
      "integrity": "sha512-GPMSkTOtMnv2U2F8gxe4Io6qmVs+YKyp832Etqqxr0hFngmXQ3rzwytelm3GIn7T4VviRUlf3sOgBOiTdvaf7g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "sunos"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-arm64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.28.2.tgz",
      "integrity": "sha512-PIhhEkE9uPBleRBrQEJpUn7MBnibZzbGzYWPmY3x+YoVg/95zbjB4CxPPOQ8l5tYYM4mMaCthF8/1DIfBQQyWQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-ia32": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-ia32/-/win32-ia32-0.28.2.tgz",
      "integrity": "sha512-YmJbfTlvU7Sdn9BB+4PRES4oB6pxgS37MAONj+hBr/cpXS1aBPKXxNnDbu+QCWPj0o9dgyxeq79g6c5P8KeuYA==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@esbuild/win32-x64": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.28.2.tgz",
      "integrity": "sha512-5ebpxr3nWMzrL/rnUI755Jkuee0bHL/Gq0WTF9lvcpv73wAp5eu8MfBUgWK9bhWvZjj7yX8etf/8tI8Ney695g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/remapping": {
      "version": "2.3.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/remapping/-/remapping-2.3.5.tgz",
      "integrity": "sha512-LI9u/+laYG4Ds1TDKSJW2YPrIlcVYOwi2fUC6xB43lueCjgxV4lffOCZCtYFiH6TNOX+tQKXx97T4IKHbhyHEQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.5",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.3.tgz",
      "integrity": "sha512-lhTtjtoEArWBjismtfS761S9Hlyn+nIZqOZVYoZ1Xn82PMNMVnk+jj/NhC4fAXGTs7ydONcJiR5vyQBTMDu27g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.6.0.tgz",
      "integrity": "sha512-T7jf+5zgsZHwNJ4lvQ7/aezbyk0nNX+zJVWpmHA7VYsEx7a7qr5Rg5IbtJFqkgze5Y2sruq1RUY8Q837Od7iFw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@rolldown/pluginutils": {
      "version": "1.0.0-rc.3",
      "resolved": "https://registry.npmjs.org/@rolldown/pluginutils/-/pluginutils-1.0.0-rc.3.tgz",
      "integrity": "sha512-eybk3TjzzzV97Dlj5c+XrBFW57eTNhzod66y9HrBlzJ6NsCrWCp/2kaPS3K9wJmurBC0Tdw4yPjXKZqlznim3Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@rollup/rollup-android-arm-eabi": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.68.7.tgz",
      "integrity": "sha512-ZL7MgOeMUiBum1bjzzyBotE3DuHVz+UUxcDVlLL7gpdhDM4RpjG4bZOIly7ensIcXw9jhWl7HTIIQ9KsgjykGQ==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-android-arm64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.68.7.tgz",
      "integrity": "sha512-cKZ2Hz/xt5DLY/vdUmMXEn3gnjLgwdeB/npHagbdTljLvBE6b/xKcPCcRWTiT0pHeVf8akl5Cb9K7ylRxbtHng==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-android-x64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-x64/-/rollup-android-x64-4.68.7.tgz",
      "integrity": "sha512-P9vs1uCC2drepKKuiXrhY+r7ry/jtDCrBS8SUCYm2Rr7rVTR9eFH6XVAmD9TdfYFlDgRe5r1eH8tLQVuz+l/VA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@rollup/rollup-darwin-arm64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-arm64/-/rollup-darwin-arm64-4.68.7.tgz",
      "integrity": "sha512-Lgu2AV7jbOTNNhkQ/OurNm7Snqu1Ux/3y7k8q47fbpPa3q63aIzKKp1xFzax5KH4pcdUzbnX/riuFsxKflsF+g==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-darwin-x64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-4.68.7.tgz",
      "integrity": "sha512-wKo6rOzla+/3rN8QBqTgcrsQMfyqwa3y14TvCTotLLib/ACWTxX1zWDTYze90s2RWtYiSfTlavHLmZv0Jsafrw==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-arm64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-arm64/-/rollup-freebsd-arm64-4.68.7.tgz",
      "integrity": "sha512-vAeCwbFyEu/vBt9O/uHCHJSvwtOpTSssnM/PoZgn8rmvAkS+9ixaUfJZ2IP3ltom+rvpuQQEIEqltPY7qhC9lQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-freebsd-x64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-freebsd-x64/-/rollup-freebsd-x64-4.68.7.tgz",
      "integrity": "sha512-HvjSxOKI+6Si4ytmaoCEpjwDMrH/1s0uWeTAhdE5oXY8/RMI92hCePI/psZuJtY5EHWoT7MfyvTz0HBDZb1ZwQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-gnueabihf": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-gnueabihf/-/rollup-linux-arm-gnueabihf-4.68.7.tgz",
      "integrity": "sha512-nz/Eu1sag3w5gPiKLJhAbKa4D9hUUJpDc9XzKXxGNHZqwgT2AbuVS2e4k9CIoLQp5dPhSN9ntiEVuz2jTzu1Gg==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm-musleabihf": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm-musleabihf/-/rollup-linux-arm-musleabihf-4.68.7.tgz",
      "integrity": "sha512-05CEv2G/kI261A1WQBZL8gx6xXULjPfVnTKAkfnV/0uqHeLo+dNEOeUzMaiK/HDGR0Z1Nn7KJjm/34bNbNcfTA==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-gnu": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-gnu/-/rollup-linux-arm64-gnu-4.68.7.tgz",
      "integrity": "sha512-wrqk3EkxQt98lTdiYhjcaWmFHwvKiSgHFi7XmPTSF4X8+uGUTBOAc0CaynEvpUhBgkPRbwASrYoU/5uJPF+LFA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-arm64-musl": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-arm64-musl/-/rollup-linux-arm64-musl-4.68.7.tgz",
      "integrity": "sha512-DnuEUWvzeSxHxzu5lvrN+I/UzrcQkR/fQ4Bibetdp73Rf7aP0XgFpalSDuHmVWsCLETE+Lrl3GVOqIvFP7rcjw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-loong64-gnu": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-loong64-gnu/-/rollup-linux-loong64-gnu-4.68.7.tgz",
      "integrity": "sha512-n0sr2s+rzVw8ntRucOxGhWeJ9lEl9KxCRzF3RmnZLE/tRnfKiloLuK8UqWrKFqVigEAh0IkRkPz5LVaV9/ZfvA==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-loong64-musl": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-loong64-musl/-/rollup-linux-loong64-musl-4.68.7.tgz",
      "integrity": "sha512-qDVJyMCbh7ekjt1kM9CZsyCFZvv5UW1QTIx3YfJ/gh8LkqpoPNpl9dCeYeOa+bsDOGTWZiMG2riXuoFSRISimQ==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-ppc64-gnu": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-ppc64-gnu/-/rollup-linux-ppc64-gnu-4.68.7.tgz",
      "integrity": "sha512-GiIOHHIzgpMoR5DT1pA1b9qMk5i0Ngg2FRj4D6XFSBC8e/axHuIdB7K/OBozO2RtCVAMnH1rXcuJrGScg+bvzA==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-ppc64-musl": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-ppc64-musl/-/rollup-linux-ppc64-musl-4.68.7.tgz",
      "integrity": "sha512-B132V2fwDl7UGLhvK6s3Ay7eNQ4dmDSDgsBm/Wwbz+Wgnunz0le4R2wzDp6TL5ExMu3MC1auJIrVtk2gOyxbyw==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-gnu": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-gnu/-/rollup-linux-riscv64-gnu-4.68.7.tgz",
      "integrity": "sha512-3NueHQilbssjxgJMx9hXBV+U5keb3CBzmW5WhoBG3iSLFcmz9U2FVoG4MUYpZoZ+KSNMQPN2AA79dTxlEF0VxQ==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-riscv64-musl": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-riscv64-musl/-/rollup-linux-riscv64-musl-4.68.7.tgz",
      "integrity": "sha512-8XRwbf76oAF1zZzg6OT8EY3swvCptZnLmiqMgO5+STyhTZ9s7rXa+tY8jESZW9IDyKACcVBGqa/RACDaLzRVjQ==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-s390x-gnu": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-s390x-gnu/-/rollup-linux-s390x-gnu-4.68.7.tgz",
      "integrity": "sha512-pvqqfjNdxVLvmovH681K5cPIL9DXj5n1RROaa0vb9JrtHddiScLrkHPRKj5flTKHF1M7xvRy0SS2yTRIc2TO0Q==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-gnu": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-gnu/-/rollup-linux-x64-gnu-4.68.7.tgz",
      "integrity": "sha512-rsTjTf5HAm6F4sI6uUfJf2pc+7AWBKxgc2RveGvwB2OvVa1GezSSCDD1rtXPuFhcg3itPv7iHgcZsq/RwWvJ4Q==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-linux-x64-musl": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-linux-x64-musl/-/rollup-linux-x64-musl-4.68.7.tgz",
      "integrity": "sha512-VNLvsYMD5+zLCi5SohwDdL8PpicC9PnArLwyMJXXUcAduzrM3k9aZT9XiHw+mn5dOWr3UEyfyqJbOvxwJ2fCWQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@rollup/rollup-openbsd-x64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-openbsd-x64/-/rollup-openbsd-x64-4.68.7.tgz",
      "integrity": "sha512-7aOjdahkwiECWWOmjAemPd21yeQ18TW59DUiLWttzolMe5tDwHyBhlOfmxRUHOQnepTNkZ2Qwp1T6LxFZ5v7yQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openbsd"
      ]
    },
    "node_modules/@rollup/rollup-openharmony-arm64": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-openharmony-arm64/-/rollup-openharmony-arm64-4.68.7.tgz",
      "integrity": "sha512-BnNkTwE4FMCAoz3UYiJ6D6Y3pGozYIYZ2W+onH64uhiTI2iwD3KOaNSlkuHYfupZVemls3YTlvbPnuKwHsraiQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ]
    },
    "node_modules/@rollup/rollup-win32-arm64-msvc": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-arm64-msvc/-/rollup-win32-arm64-msvc-4.68.7.tgz",
      "integrity": "sha512-OH8tGWsJcRW6Vn0dmndyWJGdQa46bH2/2/PVfleBGUWuBd5/HVkIvw2UslgBwUZdtV78bJaoCNBmYI5+bcTJ4A==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-ia32-msvc": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-ia32-msvc/-/rollup-win32-ia32-msvc-4.68.7.tgz",
      "integrity": "sha512-SpYx5X9+2JOF3hXe1cRaiFn562h4AMJhfgxkyHyiuh9dJ7PanPm7FTp8GJReSbS9N+TfjRiBbKacVk1g35kKxg==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-x64-gnu": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-x64-gnu/-/rollup-win32-x64-gnu-4.68.7.tgz",
      "integrity": "sha512-0ncKtQ55fqElV9Sk4cZ/4tiXVGlWxaH5PvDOlx1Sx8GuHIpSWgYrTcyrO51JnVFfy7LvAJiffkEg63ZHKwTMag==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@rollup/rollup-win32-x64-msvc": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-4.68.7.tgz",
      "integrity": "sha512-XY9DYHO5UxxVR8G6AErXDlccQmDpvGTLgKHFpvkgsyjwG/PrQuInRjQQfpEzBRuT+bhBtwfS8yDe9sPhVcq/9A==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@types/babel__core": {
      "version": "7.20.5",
      "resolved": "https://registry.npmjs.org/@types/babel__core/-/babel__core-7.20.5.tgz",
      "integrity": "sha512-qoQprZvz5wQFJwMDqeseRXWv3rqMvhgpbXFfVyWhbx9X47POIA6i/+dXefEmZKoAgOaTdaIgNSMqMIU61yRyzA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.20.7",
        "@babel/types": "^7.20.7",
        "@types/babel__generator": "*",
        "@types/babel__template": "*",
        "@types/babel__traverse": "*"
      }
    },
    "node_modules/@types/babel__generator": {
      "version": "7.27.0",
      "resolved": "https://registry.npmjs.org/@types/babel__generator/-/babel__generator-7.27.0.tgz",
      "integrity": "sha512-ufFd2Xi92OAVPYsy+P4n7/U7e68fex0+Ee8gSG9KX7eo084CWiQ4sdxktvdl0bOPupXtVJPY19zk6EwWqUQ8lg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__template": {
      "version": "7.4.4",
      "resolved": "https://registry.npmjs.org/@types/babel__template/-/babel__template-7.4.4.tgz",
      "integrity": "sha512-h/NUaSyG5EyxBIp8YRxo4RMe2/qQgvyowRwVMzhYhBCONbW8PUsg4lkFMrhgZhUe5z3L3MiLDuvyJ/CaPa2A8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.1.0",
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__traverse": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@types/babel__traverse/-/babel__traverse-7.28.0.tgz",
      "integrity": "sha512-8PvcXf70gTDZBgt9ptxJ8elBeBjcLOAcOtoO/mPJjtji1+CdGbHgm77om1GrsPxsiE+uXIpNSK64UYaIwQXd4Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.28.2"
      }
    },
    "node_modules/@types/estree": {
      "version": "1.0.10",
      "resolved": "https://registry.npmjs.org/@types/estree/-/estree-1.0.10.tgz",
      "integrity": "sha512-lTyOMnOcmRBzdCv6/4zUZCrEhV0xrqQiUZBZtVcbmLHBXKLnN8q89v/wKRF/Q0HbwVsqbIG3o5HDoFl9sduM+g==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@vitejs/plugin-react": {
      "version": "5.2.0",
      "resolved": "https://registry.npmjs.org/@vitejs/plugin-react/-/plugin-react-5.2.0.tgz",
      "integrity": "sha512-YmKkfhOAi3wsB1PhJq5Scj3GXMn3WvtQ/JC0xoopuHoXSdmtdStOpFrYaT1kie2YgFBcIe64ROzMYRjCrYOdYw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/core": "^7.29.0",
        "@babel/plugin-transform-react-jsx-self": "^7.27.1",
        "@babel/plugin-transform-react-jsx-source": "^7.27.1",
        "@rolldown/pluginutils": "1.0.0-rc.3",
        "@types/babel__core": "^7.20.5",
        "react-refresh": "^0.18.0"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      },
      "peerDependencies": {
        "vite": "^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.11.38",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.38.tgz",
      "integrity": "sha512-rMgy5YW7x28SMfXHLlVZDBqlWzYZ0x2rVR/6FWrNBF0chjigARK1H6nM0hKA1Um3kPOlkQFVtjJs00d2N1ezuw==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/browserslist": {
      "version": "4.29.6",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.6.tgz",
      "integrity": "sha512-CmVVIQ3RVc5HxYEc9X84GvxK/C8C1wH8TlKAiO7uTxF8PDwt7r8t9Qk3J9NkMOVzX5O/HbLv3yzxZg9HPrnI9w==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "baseline-browser-mapping": "^2.11.37",
        "caniuse-lite": "^1.0.30001826",
        "electron-to-chromium": "^1.5.486",
        "node-releases": "^2.0.64",
        "update-browserslist-db": "^1.4.0"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001826",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001826.tgz",
      "integrity": "sha512-wTB+9tIbLro/BCXwLuNV1meHE4L9dS6dArMDwgYfNBPMYScqClHyGunhkCSDtHhe/69Xl0sHlKgBVZ+fNsYtWA==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/convert-source-map": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
      "integrity": "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cookie": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/cookie/-/cookie-1.1.1.tgz",
      "integrity": "sha512-ei8Aos7ja0weRpFzJnEA9UHJ/7XQmqglbRwnf2ATjcB9Wq874VKH9kfjjirM6UhU2/E5fFYadylyhFldcqSidQ==",
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/debug": {
      "version": "4.4.3",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.3.tgz",
      "integrity": "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.490",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.490.tgz",
      "integrity": "sha512-I0dPyEsiaYAlbGJlr0SdRRGSWk9BpOz8AIo/4f93A6bAGuN3YafmT71rpss72SA05isaAkcAOYcW0F0H48om4Q==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/esbuild": {
      "version": "0.28.2",
      "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.28.2.tgz",
      "integrity": "sha512-HKVLS8dvII+xoKW9kmqxbRKrnWEXfJJr/FZhhJmiqIB0e053QNYFqOBouTMO/k5sID4MvCiUCvv8b9M4h32wIA==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "bin": {
        "esbuild": "bin/esbuild"
      },
      "engines": {
        "node": ">=18"
      },
      "optionalDependencies": {
        "@esbuild/aix-ppc64": "0.28.2",
        "@esbuild/android-arm": "0.28.2",
        "@esbuild/android-arm64": "0.28.2",
        "@esbuild/android-x64": "0.28.2",
        "@esbuild/darwin-arm64": "0.28.2",
        "@esbuild/darwin-x64": "0.28.2",
        "@esbuild/freebsd-arm64": "0.28.2",
        "@esbuild/freebsd-x64": "0.28.2",
        "@esbuild/linux-arm": "0.28.2",
        "@esbuild/linux-arm64": "0.28.2",
        "@esbuild/linux-ia32": "0.28.2",
        "@esbuild/linux-loong64": "0.28.2",
        "@esbuild/linux-mips64el": "0.28.2",
        "@esbuild/linux-ppc64": "0.28.2",
        "@esbuild/linux-riscv64": "0.28.2",
        "@esbuild/linux-s390x": "0.28.2",
        "@esbuild/linux-x64": "0.28.2",
        "@esbuild/netbsd-arm64": "0.28.2",
        "@esbuild/netbsd-x64": "0.28.2",
        "@esbuild/openbsd-arm64": "0.28.2",
        "@esbuild/openbsd-x64": "0.28.2",
        "@esbuild/openharmony-arm64": "0.28.2",
        "@esbuild/sunos-x64": "0.28.2",
        "@esbuild/win32-arm64": "0.28.2",
        "@esbuild/win32-ia32": "0.28.2",
        "@esbuild/win32-x64": "0.28.2"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fdir": {
      "version": "6.5.0",
      "resolved": "https://registry.npmjs.org/fdir/-/fdir-6.5.0.tgz",
      "integrity": "sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/gensync": {
      "version": "1.0.0-beta.2",
      "resolved": "https://registry.npmjs.org/gensync/-/gensync-1.0.0-beta.2.tgz",
      "integrity": "sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz",
      "integrity": "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/jsesc": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-3.1.0.tgz",
      "integrity": "sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/json5": {
      "version": "2.2.3",
      "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
      "integrity": "sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "json5": "lib/cli.js"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/lru-cache": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-5.1.1.tgz",
      "integrity": "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "yallist": "^3.0.2"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/nanoid": {
      "version": "3.3.20",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.20.tgz",
      "integrity": "sha512-uKdg2G3GNCKQn9byYOpxbGqrT2fGO5KRt5J/8b3pok8rT6qxGWF6hxMyJiEYtAf+FVyYuD9hRaDqX5uPFYJ4ZQ==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/node-releases": {
      "version": "2.0.65",
      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.65.tgz",
      "integrity": "sha512-PfvofsGQ+MiOQIPkX9fU8ELUWmy5zL74CdQaph/ismKszfFkfwXaw0cGiwbwym2hT9k5+mdyl8O5WQ1MD8EHmA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz",
      "integrity": "sha512-qcJu88Q2IWqJsDD529JKMdwGm/dvInW4HvQnRwiH9JtihJvzGOscDtHE3x1pBKeUOTysQ8kVmLnJ2kJu7yhcGA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.33",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.33.tgz",
      "integrity": "sha512-RVHEU9/Pp1Fnjr/MpAJsZoADukCKhfIi15OunEYiGktIkYLkPVvC1sioWolGDS7XByMTx9m/IGbro0Js13zhnQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.20",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/react": {
      "version": "19.2.9",
      "resolved": "https://registry.npmjs.org/react/-/react-19.2.9.tgz",
      "integrity": "sha512-RuLdAokXv3sRmZa2/N8QH0KmTBIgDKC+buRUikGqow31+mGSGidLCX2o4XFq8OV+xBFWfhM9DVgTq1PPHADH4w==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.2.9",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.2.9.tgz",
      "integrity": "sha512-YceU74W21fXEHszKBLj16MY0CmvpFKOs60iVrIyW/cCgOPsZJNaB6GVJEtIUqt6AG6EjzKLui5lPRrxAeS328Q==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.27.0"
      },
      "peerDependencies": {
        "react": "^19.2.9"
      }
    },
    "node_modules/react-refresh": {
      "version": "0.18.0",
      "resolved": "https://registry.npmjs.org/react-refresh/-/react-refresh-0.18.0.tgz",
      "integrity": "sha512-QgT5//D3jfjJb6Gsjxv0Slpj23ip+HtOpnNgnb2S5zU3CB26G/IDPGoy4RJB42wzFE46DRsstbW6tKHoKbhAxw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-router": {
      "version": "7.18.5",
      "resolved": "https://registry.npmjs.org/react-router/-/react-router-7.18.5.tgz",
      "integrity": "sha512-dTgvcXDOrLPrlLHrcZAqWveiK1hMSqN+rGAJzegP8HtmNkfRxOoshGWBNX3ZJ0cZjOHkRdlUJtaIhZMLLyGyPw==",
      "license": "MIT",
      "dependencies": {
        "cookie": "^1.0.1",
        "set-cookie-parser": "^2.6.0"
      },
      "engines": {
        "node": ">=20.0.0"
      },
      "peerDependencies": {
        "react": ">=18",
        "react-dom": ">=18"
      },
      "peerDependenciesMeta": {
        "react-dom": {
          "optional": true
        }
      }
    },
    "node_modules/rollup": {
      "version": "4.68.7",
      "resolved": "https://registry.npmjs.org/rollup/-/rollup-4.68.7.tgz",
      "integrity": "sha512-CxhzUIc+ocxPAWxHuff+PAluoW1otD6dHqqPK2h2Q38WA1VYk+3gizX6NEg5t2a8yNGQaiHM1R7V+qdwWuvp5Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/estree": "^1.0.10"
      },
      "bin": {
        "rollup": "dist/bin/rollup"
      },
      "engines": {
        "node": ">=18.0.0",
        "npm": ">=8.0.0"
      },
      "optionalDependencies": {
        "@rollup/rollup-android-arm-eabi": "4.68.7",
        "@rollup/rollup-android-arm64": "4.68.7",
        "@rollup/rollup-android-x64": "4.68.7",
        "@rollup/rollup-darwin-arm64": "4.68.7",
        "@rollup/rollup-darwin-x64": "4.68.7",
        "@rollup/rollup-freebsd-arm64": "4.68.7",
        "@rollup/rollup-freebsd-x64": "4.68.7",
        "@rollup/rollup-linux-arm-gnueabihf": "4.68.7",
        "@rollup/rollup-linux-arm-musleabihf": "4.68.7",
        "@rollup/rollup-linux-arm64-gnu": "4.68.7",
        "@rollup/rollup-linux-arm64-musl": "4.68.7",
        "@rollup/rollup-linux-loong64-gnu": "4.68.7",
        "@rollup/rollup-linux-loong64-musl": "4.68.7",
        "@rollup/rollup-linux-ppc64-gnu": "4.68.7",
        "@rollup/rollup-linux-ppc64-musl": "4.68.7",
        "@rollup/rollup-linux-riscv64-gnu": "4.68.7",
        "@rollup/rollup-linux-riscv64-musl": "4.68.7",
        "@rollup/rollup-linux-s390x-gnu": "4.68.7",
        "@rollup/rollup-linux-x64-gnu": "4.68.7",
        "@rollup/rollup-linux-x64-musl": "4.68.7",
        "@rollup/rollup-openbsd-x64": "4.68.7",
        "@rollup/rollup-openharmony-arm64": "4.68.7",
        "@rollup/rollup-win32-arm64-msvc": "4.68.7",
        "@rollup/rollup-win32-ia32-msvc": "4.68.7",
        "@rollup/rollup-win32-x64-gnu": "4.68.7",
        "@rollup/rollup-win32-x64-msvc": "4.68.7",
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/scheduler": {
      "version": "0.27.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.27.0.tgz",
      "integrity": "sha512-eNv+WrVbKu1f3vbYJT/xtiF5syA5HPIMtf9IgY/nKg0sWqzAUEvqY/xm7OcZc/qafLx/iO9FgOmeSAp4v5ti/Q==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "6.3.2",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.2.tgz",
      "integrity": "sha512-GYrCADwpu6yV5OAvchkQ27Z5wwMxWAEMg5NNWjyHh/5DboFFqbdbvYNIvZouQpxXyeMPoTOh0vdPYKlf0ZswdQ==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/set-cookie-parser": {
      "version": "2.7.3",
      "resolved": "https://registry.npmjs.org/set-cookie-parser/-/set-cookie-parser-2.7.3.tgz",
      "integrity": "sha512-irZHtTqurLna57KQG/s+fzOwv/J6XSH4cs8M/vsrY3uCaQ3S6+QJguAH0WdN47SXlk82voMZ4naWMQf8fdEoIg==",
      "license": "MIT"
    },
    "node_modules/source-map-js": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz",
      "integrity": "sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==",
      "dev": true,
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "resolved": "https://registry.npmjs.org/tinyglobby/-/tinyglobby-0.2.17.tgz",
      "integrity": "sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/update-browserslist-db": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.4.0.tgz",
      "integrity": "sha512-WPJuOnjI9FWDct4fB+ej4Mz8opLaw5CDcZ2t44tFZ0vIQVYWzBhWR3mkixuUj/A7+vY4V9+ApOZ2YYLwdgq46w==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/vite": {
      "version": "7.3.8",
      "resolved": "https://registry.npmjs.org/vite/-/vite-7.3.8.tgz",
      "integrity": "sha512-3tTi78MAKhVk9h+YZVXMQ8POmneJuE97QUPAWtJghHzhH7BAyiqQOC2KZh1DWOsu/USB2cRXhznPByaabvYXfw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "esbuild": "^0.27.0 || ^0.28.0",
        "fdir": "^6.5.0",
        "picomatch": "^4.0.3",
        "postcss": "^8.5.6",
        "rollup": "^4.43.0",
        "tinyglobby": "^0.2.15"
      },
      "bin": {
        "vite": "bin/vite.js"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      },
      "funding": {
        "url": "https://github.com/vitejs/vite?sponsor=1"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.3"
      },
      "peerDependencies": {
        "@types/node": "^20.19.0 || >=22.12.0",
        "jiti": ">=1.21.0",
        "less": "^4.0.0",
        "lightningcss": "^1.21.0",
        "sass": "^1.70.0",
        "sass-embedded": "^1.70.0",
        "stylus": ">=0.54.8",
        "sugarss": "^5.0.0",
        "terser": "^5.16.0",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        },
        "jiti": {
          "optional": true
        },
        "less": {
          "optional": true
        },
        "lightningcss": {
          "optional": true
        },
        "sass": {
          "optional": true
        },
        "sass-embedded": {
          "optional": true
        },
        "stylus": {
          "optional": true
        },
        "sugarss": {
          "optional": true
        },
        "terser": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/yallist": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz",
      "integrity": "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==",
      "dev": true,
      "license": "ISC"
    }
  }
}
```

</details>
