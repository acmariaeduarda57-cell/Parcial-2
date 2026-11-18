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
