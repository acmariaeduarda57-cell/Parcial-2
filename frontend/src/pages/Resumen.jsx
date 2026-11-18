import { Link } from 'react-router'
import { leerEtapas } from '../lib/api.js'
import { etapas, numero } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import { Aviso, Cabecera, Cargando, Estado } from '../components/UI.jsx'
import Icono from '../components/Icono.jsx'
import Monitor from '../components/Monitor.jsx'

function Distribucion({ ordenes }) {
  const conteo = ordenes.reduce((c, o) => {
    c[o.estado] = (c[o.estado] || 0) + 1
    return c
  }, {})
  return (
    <section className="resumen-seccion">
      <div className="subtitulo">
        <h2>Distribución de órdenes</h2>
        <span className="micro">09 etapas</span>
      </div>
      <div className="cuadricula">
        {Object.keys(etapas).map((s) => {
          const n = conteo[s] || 0,
            p = ordenes.length ? Math.round((100 * n) / ordenes.length) : 0
          return (
            <Link
              key={s}
              to={`/ordenes?estado=${s}`}
              className="panel tarjeta-etapa"
              aria-label={`Ver ${n} ${n === 1 ? 'orden' : 'órdenes'} en estado ${etapas[s].nombre}`}
            >
              <div>
                <Estado valor={s} />
                <Icono nombre="externo" size={16} />
              </div>
              <strong>{numero(n)}</strong>
              <small>{p}% del total</small>
              <div className="medidor">
                <i style={{ width: `${p}%` }} />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
export default function Resumen() {
  const r = useLectura(leerEtapas)
  return (
    <>
      <Cabecera
        seccion="Análisis del taller"
        titulo="Resumen por etapa"
        descripcion="Consulta la carga de trabajo y abre las órdenes de cada estado."
      />
      <Aviso error={r.error} reintentar={r.recargar} />
      {r.datos ? (
        <>
          <Monitor ordenes={r.datos} />
          <Distribucion ordenes={r.datos} />
        </>
      ) : (
        r.cargando && <Cargando />
      )}
    </>
  )
}
