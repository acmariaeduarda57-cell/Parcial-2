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
