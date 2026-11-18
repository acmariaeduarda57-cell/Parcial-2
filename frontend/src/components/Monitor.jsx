import { numero } from '../lib/taller.js'
import Icono from './Icono.jsx'

export default function Monitor({ ordenes }) {
  const valores = [
    ordenes.length,
    ordenes.filter((o) => o.estado === 'en_reparacion').length,
    ordenes.filter((o) => o.estado === 'lista').length,
  ]
  return (
    <section className="monitor" aria-label="Indicadores del taller">
      <div className="monitor-info">
        <div className="monitor-titulo">
          <Icono nombre="pulso" size={18} />
          <h2>Monitor del taller</h2>
        </div>
        <dl className="metricas">
          {['Órdenes totales', 'En reparación', 'Listas para entrega'].map((s, i) => (
            <div key={s}>
              <dt>{s}</dt>
              <dd>{numero(valores[i])}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figure className="plano" aria-hidden="true">
        <img src="/osciloscopio.svg" alt="" />
        <figcaption>
          FIG. 01 <i /> OSCILOSCOPIO
        </figcaption>
      </figure>
    </section>
  )
}
