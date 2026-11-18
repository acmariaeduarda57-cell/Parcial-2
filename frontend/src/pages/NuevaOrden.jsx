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
