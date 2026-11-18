import { Link } from 'react-router'
import Icono from '../components/Icono.jsx'

export default function NoEncontrada({ orden = false }) {
  return (
    <section className="panel no-encontrada">
      <span className="etiqueta-tecnica">VOL / ERROR 404</span>
      <strong>404</strong>
      <h1>{orden ? 'Orden no encontrada' : 'Página no encontrada'}</h1>
      <p>
        {orden
          ? 'No hay una orden con ese identificador en el taller.'
          : 'Esta ruta no pertenece al sistema del taller.'}
      </p>
      <Link className="boton primario" to="/ordenes">
        <Icono nombre="volver" size={16} />
        Ir a órdenes de trabajo
      </Link>
    </section>
  )
}
