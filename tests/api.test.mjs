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
