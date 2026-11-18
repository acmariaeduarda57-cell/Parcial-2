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
