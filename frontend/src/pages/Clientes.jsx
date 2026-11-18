import { useState } from 'react'
import { leerClientes } from '../lib/api.js'
import { iniciales, normalizar } from '../lib/taller.js'
import { useLectura } from '../lib/useLectura.js'
import { Aviso, Buscar, Cabecera, Cargando, TituloPanel, Vacio } from '../components/UI.jsx'
import ClienteDialog from '../components/ClienteDialog.jsx'
import Icono from '../components/Icono.jsx'

export default function Clientes() {
  const r = useLectura(leerClientes),
    [buscar, setBuscar] = useState(''),
    [editor, setEditor] = useState(null)
  const lista = r.datos?.filter((c) =>
    normalizar(`${c.nombre} ${c.telefono}`).includes(normalizar(buscar))
  )
  return (
    <>
      <Cabecera
        seccion="Directorio del taller"
        titulo="Clientes"
        descripcion="Consulta y actualiza los datos de contacto de los titulares de equipos."
        accion={
          <button className="boton primario" onClick={() => setEditor({})}>
            <Icono nombre="mas" size={17} />
            Nuevo cliente
          </button>
        }
      />
      <Aviso error={r.error} reintentar={r.recargar} />
      {lista ? (
        <section className="panel">
          <TituloPanel icono="clientes" extra={<span className="contador">{r.datos.length}</span>}>
            Directorio de clientes
          </TituloPanel>
          <div className="herramientas">
            <Buscar texto="Buscar por nombre o teléfono…" valor={buscar} cambiar={setBuscar} />
          </div>
          {lista.length ? (
            <ul className="directorio">
              {lista.map((c) => (
                <li key={c.id}>
                  <span className="avatar">{iniciales(c.nombre)}</span>
                  <div>
                    <b>{c.nombre}</b>
                    <small>{c.telefono}</small>
                  </div>
                  <button
                    className="boton secundario compacto"
                    aria-label={`Editar a ${c.nombre}`}
                    onClick={() => setEditor(c)}
                  >
                    <Icono nombre="editar" size={14} />
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio
              titulo="Sin clientes en esta vista"
              texto="Cambia la búsqueda o registra un nuevo cliente."
            />
          )}
        </section>
      ) : (
        r.cargando && <Cargando />
      )}
      {editor && (
        <ClienteDialog
          cliente={editor.id ? editor : null}
          cerrar={() => setEditor(null)}
          guardado={() => {
            r.recargar()
            setEditor(null)
          }}
        />
      )}
    </>
  )
}
