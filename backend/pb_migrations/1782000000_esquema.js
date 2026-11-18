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
