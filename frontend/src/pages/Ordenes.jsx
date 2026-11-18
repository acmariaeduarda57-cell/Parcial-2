import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { leerOrdenes } from '../lib/api.js'
import { etapas, ingreso, normalizar, numero, referencia } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import Icono from '../components/Icono.jsx'
import { Aviso, Buscar, Cabecera, Cargando, Vacio } from '../components/UI.jsx'
import Monitor from '../components/Monitor.jsx'
import TablaOrdenes, { Paginacion } from '../components/TablaOrdenes.jsx'

function Registro({ ordenes }) {
  const [params, setParams] = useSearchParams()
  const filtro = Object.hasOwn(etapas, params.get('estado')) ? params.get('estado') : ''
  const [buscar, setBuscar] = useState(''),
    [recientes, setRecientes] = useState(true),
    [pagina, setPagina] = useState(1)
  // Al paginar no volvemos a normalizar nombres ni ordenar todo el registro.
  const lista = useMemo(
    () =>
      ordenes
        .filter(
          (o) =>
            (!filtro || o.estado === filtro) &&
            normalizar(`${referencia(o.id)} ${o.equipo} ${o.expand.cliente.nombre}`).includes(
              normalizar(buscar)
            )
        )
        .sort(
          (a, b) =>
            (ingreso(b).localeCompare(ingreso(a)) || b.id.localeCompare(a.id)) *
            (recientes ? 1 : -1)
        ),
    [ordenes, buscar, filtro, recientes]
  )
  const n = 8,
    actual = Math.min(pagina, Math.max(1, Math.ceil(lista.length / n)))
  return (
    <section className="panel registro">
      <div className="registro-titulo">
        <div>
          <h2>Registro de órdenes</h2>
          <span className="contador">{numero(ordenes.length)}</span>
        </div>
        <button
          className="ordenar"
          onClick={() => {
            setRecientes(!recientes)
            setPagina(1)
          }}
          aria-label={`Cambiar orden: ${recientes ? 'más antiguas' : 'más recientes'} primero`}
        >
          <Icono nombre="ordenar" size={14} />
          {recientes ? 'Más recientes' : 'Más antiguas'}
        </button>
      </div>
      <div className="herramientas">
        <Buscar
          texto="Buscar por orden, equipo o cliente…"
          valor={buscar}
          cambiar={(s) => {
            setBuscar(s)
            setPagina(1)
          }}
        />
        <label className="select-filtro">
          <Icono nombre="filtro" size={16} />
          <select
            aria-label="Filtrar por estado"
            value={filtro}
            onChange={(e) => {
              setParams(e.target.value ? { estado: e.target.value } : {})
              setPagina(1)
            }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(etapas).map(([id, e]) => (
              <option key={id} value={id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <Icono nombre="abajo" size={13} />
        </label>
      </div>
      {lista.length ? (
        <TablaOrdenes ordenes={lista.slice((actual - 1) * n, actual * n)} />
      ) : (
        <Vacio
          titulo="No hay órdenes que mostrar"
          texto={
            ordenes.length
              ? 'Prueba con otro término o cambia el filtro de estado.'
              : 'Registra el primer equipo para iniciar el seguimiento.'
          }
        >
          {ordenes.length ? (
            <button
              className="enlace"
              onClick={() => {
                setBuscar('')
                setParams({})
                setPagina(1)
              }}
            >
              Limpiar filtros
            </button>
          ) : (
            <Link className="enlace" to="/ordenes/nueva">
              Crear una orden
            </Link>
          )}
        </Vacio>
      )}
      <Paginacion pagina={actual} porPagina={n} total={lista.length} cambiar={setPagina} />
    </section>
  )
}
export default function Ordenes() {
  const r = useLectura(leerOrdenes)
  return (
    <>
      <Cabecera
        seccion="Panel de operaciones"
        titulo="Órdenes de trabajo"
        descripcion="Supervisa los equipos y el avance de cada reparación."
        accion={
          <Link className="boton primario" to="/ordenes/nueva">
            <Icono nombre="mas" size={17} />
            Nueva orden
          </Link>
        }
      />
      <Aviso error={r.error} reintentar={r.recargar} />
      {r.datos ? (
        <>
          <Monitor ordenes={r.datos} />
          <Registro ordenes={r.datos} />
        </>
      ) : (
        r.cargando && <Cargando />
      )}
    </>
  )
}
