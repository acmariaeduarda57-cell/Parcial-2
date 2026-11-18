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
