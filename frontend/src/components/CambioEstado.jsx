import { useState } from 'react'
import { acciones, etapas } from '../lib/taller.js'
import Icono from './Icono.jsx'
import { FormPresupuesto } from './Presupuesto.jsx'

export default function CambioEstado({ estado, enviar, ocupado }) {
  const [confirmar, setConfirmar] = useState(null)
  if (estado === 'en_diagnostico') return <FormPresupuesto enviar={enviar} ocupado={ocupado} />
  if (!etapas[estado].sigue.length)
    return (
      <p className="nota">
        <Icono nombre="check" />
        Esta orden está cerrada. Sus datos e historial se conservan para consulta.
      </p>
    )
  if (confirmar)
    return (
      <div className="confirmacion">
        <b>¿{acciones[confirmar]}?</b>
        <p>Esta acción cierra la orden de forma definitiva.</p>
        <div className="acciones">
          <button
            className="boton secundario"
            disabled={ocupado}
            onClick={() => setConfirmar(null)}
          >
            Volver
          </button>
          <button className="boton primario" disabled={ocupado} onClick={() => enviar(confirmar)}>
            {ocupado ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    )
  return (
    <>
      <p className="nota nota-accion">Selecciona el siguiente paso de la orden.</p>
      <div className="acciones">
        {etapas[estado].sigue.map((s, i) => (
          <button
            key={s}
            disabled={ocupado}
            className={`boton ${i === 0 ? 'primario' : 'secundario'}`}
            onClick={() => (etapas[s].sigue.length ? enviar(s) : setConfirmar(s))}
          >
            {acciones[s]}
            {i === 0 && <Icono nombre="flecha" size={15} />}
          </button>
        ))}
      </div>
    </>
  )
}
