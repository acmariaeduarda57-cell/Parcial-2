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
