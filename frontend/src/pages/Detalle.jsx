import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { fotoURL, guardar, leerOrden } from '../lib/api.js'
import { etapas, fecha, historial, referencia } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import { Aviso, Cabecera, Cargando, Estado, TituloPanel } from '../components/UI.jsx'
import Icono from '../components/Icono.jsx'
import { PresupuestoEmitido } from '../components/Presupuesto.jsx'
import CambioEstado from '../components/CambioEstado.jsx'
import NoEncontrada from './NoEncontrada.jsx'

function Historial({ orden }) {
  return (
    <section className="panel">
      <TituloPanel icono="tiempo">Historial</TituloPanel>
      <ol className="historial">
        {historial(orden)
          .reverse()
          .map((e) => (
            <li key={e.id}>
              <b>{etapas[e.a].nombre}</b>
              <span>
                {e.de ? `Desde ${etapas[e.de].nombre.toLowerCase()}` : 'Ingreso al taller'}
              </span>
              <time dateTime={e.created.replace(' ', 'T')}>{fecha(e.created, true)}</time>
            </li>
          ))}
      </ol>
    </section>
  )
}
function Ficha({ orden }) {
  const c = orden.expand.cliente
  return (
    <section className="panel">
      <TituloPanel icono="cpu" extra={<Estado valor={orden.estado} />}>
        Ficha del equipo
      </TituloPanel>
      <div className="cuerpo-panel ficha">
        <div className="datos-cliente">
          <div>
            <p className="micro">Cliente</p>
            <b>{c.nombre}</b>
          </div>
          <div>
            <p className="micro">Teléfono</p>
            <a href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`}>{c.telefono}</a>
          </div>
        </div>
        <p className="micro">Problema informado</p>
        <p className="texto-largo">{orden.problema}</p>
        <p className="micro">Fotografías · {orden.fotos.length}/3</p>
        {orden.fotos.length ? (
          <div className="galeria">
            {orden.fotos.map((f) => (
              <a key={f} href={fotoURL(orden, f)} target="_blank" rel="noreferrer">
                <img src={fotoURL(orden, f)} alt={`Foto del equipo: ${f}`} />
              </a>
            ))}
          </div>
        ) : (
          <p className="nota">No se adjuntaron imágenes.</p>
        )}
      </div>
    </section>
  )
}
function FichaOrden({ id }) {
  const r = useLectura(leerOrden, id),
    [ocupado, setOcupado] = useState(false),
    [error, setError] = useState(null)
  async function avanzar(estado, campos = {}) {
    setOcupado(true)
    setError(null)
    try {
      await guardar('ordenes', { estado, ...campos }, id)
    } catch (err) {
      setError(err)
    } finally {
      r.recargar()
      setOcupado(false)
    } // También releer tras un rechazo por concurrencia.
  }
  if (r.error?.status === 404) return <NoEncontrada orden />
  if (!r.datos) return r.error ? <Aviso error={r.error} reintentar={r.recargar} /> : <Cargando />
  const o = r.datos
  return (
    <>
      <Cabecera
        seccion={`Ficha de servicio / ${referencia(o.id)}`}
        titulo={o.equipo}
        descripcion="Recepción, presupuesto y trazabilidad de la reparación."
        accion={
          <Link to="/ordenes" className="boton secundario">
            <Icono nombre="volver" size={15} />
            Volver al registro
          </Link>
        }
      />
      <div className="dos-columnas">
        <div className="pila">
          <Ficha orden={o} />
          {o.diagnostico && (
            <section className="panel">
              <TituloPanel icono="lista">Presupuesto registrado</TituloPanel>
              <div className="cuerpo-panel">
                <PresupuestoEmitido orden={o} />
              </div>
            </section>
          )}
          <section className="panel">
            <TituloPanel icono="llave">
              {o.estado === 'en_diagnostico' ? 'Preparar presupuesto' : 'Control de etapa'}
            </TituloPanel>
            <div className="cuerpo-panel">
              <Aviso error={error} />
              <CambioEstado
                key={o.estado}
                estado={o.estado}
                ocupado={ocupado || r.cargando}
                enviar={avanzar}
              />
            </div>
          </section>
        </div>
        <Historial orden={o} />
      </div>
    </>
  )
}
export default function Detalle() {
  const { id } = useParams()
  return <FichaOrden key={id} id={id} />
}
