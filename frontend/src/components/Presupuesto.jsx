import { useMemo, useRef, useState } from 'react'
import { moneda, totalDe } from '../lib/taller.js'
import Icono from './Icono.jsx'

function Total({ mano, piezas }) {
  // Editar el diagnóstico no modifica ningún importe; evitamos recorrer las piezas otra vez.
  const total = useMemo(() => totalDe(mano, piezas), [mano, piezas])
  return (
    <div className="total">
      <span>Total del presupuesto</span>
      <strong>{moneda(total)}</strong>
    </div>
  )
}
function FilaPieza({ pieza, cambiar, quitar }) {
  return (
    <div className="linea-pieza">
      <label>
        Descripción
        <input
          required
          value={pieza.descripcion}
          onChange={(e) => cambiar('descripcion', e.target.value)}
        />
      </label>
      <label>
        Cantidad
        <input
          required
          type="number"
          min="1"
          step="1"
          value={pieza.cantidad}
          onChange={(e) => cambiar('cantidad', e.target.value)}
        />
      </label>
      <label>
        Precio (€)
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={pieza.precio}
          onChange={(e) => cambiar('precio', e.target.value)}
        />
      </label>
      <button className="boton-icono" type="button" aria-label="Quitar pieza" onClick={quitar}>
        <Icono nombre="x" size={16} />
      </button>
    </div>
  )
}
export function FormPresupuesto({ enviar, ocupado }) {
  const [diagnostico, setDiagnostico] = useState(''),
    [mano, setMano] = useState(''),
    [piezas, setPiezas] = useState([])
  const secuencia = useRef(0)
  function guardar(e) {
    e.preventDefault()
    enviar('presupuestada', {
      diagnostico: diagnostico.trim(),
      manoObra: Number(mano),
      piezas: piezas.map((p) => ({
        descripcion: p.descripcion.trim(),
        cantidad: Number(p.cantidad),
        precio: Number(p.precio),
      })),
    })
  }
  return (
    <form onSubmit={guardar}>
      <fieldset className="campos" disabled={ocupado}>
        <label>
          Diagnóstico
          <textarea
            required
            maxLength="4000"
            rows="3"
            placeholder="Hallazgos de la revisión"
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
          />
        </label>
        <label>
          Mano de obra (€)
          <input
            type="number"
            required
            min="0"
            step="0.01"
            placeholder="0,00"
            value={mano}
            onChange={(e) => setMano(e.target.value)}
          />
        </label>
        <div className="piezas">
          <div className="label-fila">
            <b>Piezas</b>
            <button
              className="enlace"
              type="button"
              onClick={() => {
                const key = ++secuencia.current
                setPiezas((ps) => [...ps, { key, descripcion: '', cantidad: '1', precio: '' }])
              }}
            >
              <Icono nombre="mas" size={14} />
              Añadir pieza
            </button>
          </div>
          {piezas.length === 0 && (
            <p className="nota">Sin piezas añadidas. Puedes presupuestar solo mano de obra.</p>
          )}
          {piezas.map((p) => (
            <FilaPieza
              key={p.key}
              pieza={p}
              cambiar={(k, v) =>
                setPiezas((ps) => ps.map((x) => (x.key === p.key ? { ...x, [k]: v } : x)))
              }
              quitar={() => setPiezas((ps) => ps.filter((x) => p.key !== x.key))}
            />
          ))}
        </div>
        <Total mano={mano} piezas={piezas} />
        <p className="nota">
          <Icono nombre="info" size={15} />
          Una vez registrado, el presupuesto no se podrá modificar.
        </p>
        <button className="boton primario auto-ancho" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Registrar presupuesto'}
          <Icono nombre="flecha" size={16} />
        </button>
      </fieldset>
    </form>
  )
}
export function PresupuestoEmitido({ orden }) {
  return (
    <div className="presupuesto">
      <p className="micro">Diagnóstico</p>
      <p className="texto-largo">{orden.diagnostico}</p>
      <div className="renglon">
        <span>Mano de obra</span>
        <b>{moneda(orden.manoObra)}</b>
      </div>
      {orden.piezas.map((p, i) => (
        <div className="renglon" key={`${i}-${p.descripcion}`}>
          <span>
            {p.descripcion}
            <small>
              {p.cantidad} × {moneda(p.precio)}
            </small>
          </span>
          <b>{moneda(p.cantidad * p.precio)}</b>
        </div>
      ))}
      <Total mano={orden.manoObra} piezas={orden.piezas} />
    </div>
  )
}
