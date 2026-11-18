import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useLectura } from '../lib/useLectura.js'
import { leerSalud } from '../lib/api.js'
import Icono from './Icono.jsx'

const grupos = [
  [
    'Operaciones',
    [
      ['/ordenes', 'ordenes', 'Órdenes de trabajo'],
      ['/ordenes/nueva', 'nueva', 'Nueva orden'],
      ['/resumen', 'resumen', 'Resumen por etapa'],
    ],
  ],
  ['Directorio', [['/clientes', 'clientes', 'Clientes']]],
]
function Marca({ alNavegar }) {
  return (
    <Link className="marca" onClick={alNavegar} to="/ordenes" aria-label="Voltio, inicio">
      <img src="/voltio.svg" alt="" width="40" height="40" />
      <span>
        <strong>
          Voltio<span>.</span>
        </strong>
        <small>GESTIÓN DE TALLER</small>
      </span>
    </Link>
  )
}
function Conexion() {
  const salud = useLectura(leerSalud)
  return (
    <div className="terminal">
      <span className="terminal-icono">
        <Icono nombre="terminal" size={19} />
      </span>
      <span>
        <b>Terminal del taller</b>
        <small>
          <i className={`led ${salud.datos ? 'online' : ''}`} />
          {salud.datos ? 'Sistema en línea' : salud.cargando ? 'Conectando…' : 'Sin conexión'}
        </small>
      </span>
    </div>
  )
}
function Menu({ ruta, cerrar }) {
  return (
    <>
      {grupos.map(([nombre, items]) => (
        <div className="grupo-nav" key={nombre}>
          <p className="micro">{nombre}</p>
          <nav aria-label={nombre}>
            {items.map(([to, icono, etiqueta]) => (
              <NavLink
                end
                key={to}
                to={to}
                onClick={cerrar}
                className={({ isActive }) =>
                  `nav-item ${isActive || (to === '/ordenes' && /^\/ordenes\/(?!nueva$)[^/]+$/.test(ruta)) ? 'actual' : ''}`
                }
              >
                <Icono nombre={icono} />
                {etiqueta}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </>
  )
}
export default function Layout() {
  const { pathname } = useLocation()
  const pagina =
    grupos.flatMap((g) => g[1]).find(([to]) => to === pathname)?.[2] ||
    (pathname.startsWith('/ordenes/') ? 'Detalle de orden' : 'Página no encontrada')
  const [abierto, setAbierto] = useState(false)
  const cerrar = () => setAbierto(false)
  const movil = useRef(null)
  useEffect(() => {
    document.title = `${pagina} · Voltio`
    window.scrollTo(0, 0)
  }, [pagina, pathname])
  useEffect(() => {
    const d = movil.current
    if (abierto) d.showModal()
    return () => {
      if (d.open) d.close()
    }
  }, [abierto])
  return (
    <div className="shell">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Marca />
        <Menu ruta={pathname} cerrar={cerrar} />
        <Conexion />
      </aside>
      <dialog ref={movil} aria-label="Menú del taller" className="menu-movil" onCancel={cerrar}>
        <div className="menu-cabeza">
          <Marca alNavegar={cerrar} />
          <button className="boton-icono" aria-label="Cerrar menú" onClick={cerrar}>
            <Icono nombre="x" />
          </button>
        </div>
        <Menu ruta={pathname} cerrar={cerrar} />
      </dialog>
      <div className="espacio">
        <header className="barra">
          <div className="migas">
            <button
              className="boton-icono abrir-menu"
              onClick={() => setAbierto(true)}
              aria-label="Abrir menú"
            >
              <Icono nombre="menu" />
            </button>
            <Link className="marca-movil" to="/ordenes" aria-label="Voltio, inicio">
              <img src="/voltio.svg" width="23" height="23" alt="" />
              Voltio.
            </Link>
            <Icono nombre="grid" size={15} className="miga-icono" />
            <span className="miga-raiz">Espacio de trabajo</span>
            <span className="slash">/</span>
            <b>{pagina}</b>
          </div>
          <span className="fecha-barra">
            <Icono nombre="calendario" size={15} />
            {new Intl.DateTimeFormat('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }).format(new Date())}
          </span>
        </header>
        <main id="contenido" tabIndex="-1">
          <Outlet />
        </main>
        <footer className="pie">
          <span>
            <Icono nombre="pulso" size={15} />
            Voltio <i>/</i> Gestión de taller
          </span>
          <span className="micro">SISTEMA V1.0</span>
        </footer>
      </div>
    </div>
  )
}
