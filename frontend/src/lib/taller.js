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
