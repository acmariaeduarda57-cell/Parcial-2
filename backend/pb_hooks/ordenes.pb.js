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
