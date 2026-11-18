import { etapas } from '../lib/taller.js'
import Icono from './Icono.jsx'

export function Cabecera({ seccion, titulo, descripcion, accion }) {
  return (
    <header className="cabecera">
      <div>
        <div className="ceja">
          <i className="marcas" />
          {seccion}
        </div>
        <h1>{titulo}</h1>
        <p>{descripcion}</p>
      </div>
      {accion}
    </header>
  )
}
export function Estado({ valor }) {
  const { tono, nombre } = etapas[valor]
  return (
    <span className={`estado ${tono}`}>
      <i />
      {nombre}
    </span>
  )
}
export function Aviso({ error, reintentar }) {
  if (!error) return null
  return (
    <div className="aviso" role="alert">
      <Icono nombre="info" />
      <span>{error.message || String(error)}</span>
      {reintentar && (
        <button type="button" className="enlace" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}
export function Cargando() {
  return (
    <div className="cargando" role="status">
      <i className="spinner" />
      Leyendo del taller…
    </div>
  )
}
export function Vacio({ titulo, texto, children }) {
  return (
    <div className="vacio">
      <span className="icono-vacio">
        <Icono nombre="buscar" size={24} />
      </span>
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {children}
    </div>
  )
}
export function Buscar({ valor, cambiar, texto }) {
  return (
    <label className="busqueda">
      <Icono nombre="buscar" size={17} />
      <input
        type="search"
        aria-label={texto}
        placeholder={texto}
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
      />
    </label>
  )
}
export function TituloPanel({ icono, children, extra }) {
  return (
    <div className="titulo-panel">
      <div>
        {icono && <Icono nombre={icono} />}
        <h2>{children}</h2>
      </div>
      {extra}
    </div>
  )
}
