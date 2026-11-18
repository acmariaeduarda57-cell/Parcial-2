import { Link } from 'react-router'
import { fecha, ingreso, referencia, tipoEquipo } from '../lib/taller.js'
import Icono from './Icono.jsx'
import { Estado } from './UI.jsx'

export default function TablaOrdenes({ ordenes }) {
  return (
    <div className="tabla-scroll">
      <table className="tabla-ordenes">
        <thead>
          <tr>
            <th scope="col">Orden</th>
            <th scope="col">Equipo</th>
            <th scope="col">Cliente</th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="sr">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenes.map((o) => {
            const [icono, tipo] = tipoEquipo(o.equipo),
              url = `/ordenes/${o.id}`
            return (
              <tr key={o.id}>
                <td>
                  <Link className="codigo" to={url}>
                    {referencia(o.id)}
                  </Link>
                  <small>{fecha(ingreso(o))}</small>
                </td>
                <td>
                  <div className="celda-equipo">
                    <span className="equipo-icono">
                      <Icono nombre={icono} size={21} />
                    </span>
                    <div>
                      <Link to={url} className="nombre-equipo">
                        {o.equipo}
                      </Link>
                      <small>{tipo}</small>
                    </div>
                  </div>
                </td>
                <td>{o.expand.cliente.nombre}</td>
                <td>
                  <Estado valor={o.estado} />
                </td>
                <td className="celda-ir">
                  <Link className="ir" to={url} aria-label={`Ver detalle de ${o.equipo}`}>
                    <Icono nombre="derecha" size={16} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
export function Paginacion({ pagina, porPagina, total, cambiar }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  return (
    <div className="paginacion">
      <span>
        {total ? (
          <>
            <b>
              {(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, total)}
            </b>{' '}
            de {total} {total === 1 ? 'orden' : 'órdenes'}
          </>
        ) : (
          '0 órdenes'
        )}
      </span>
      <div>
        <button
          className="boton-pagina"
          disabled={pagina <= 1}
          onClick={() => cambiar(pagina - 1)}
          aria-label="Página anterior"
        >
          <Icono nombre="izquierda" size={14} />
        </button>
        <span className="pagina-num" aria-label={`Página ${pagina} de ${paginas}`}>
          {pagina}
        </span>
        <button
          className="boton-pagina"
          disabled={pagina >= paginas}
          onClick={() => cambiar(pagina + 1)}
          aria-label="Página siguiente"
        >
          <Icono nombre="derecha" size={14} />
        </button>
      </div>
    </div>
  )
}
