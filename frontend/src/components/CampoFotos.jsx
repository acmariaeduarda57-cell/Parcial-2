import { useRef } from 'react'
import Icono from './Icono.jsx'

export default function CampoFotos({ fotos, cambiar, avisar }) {
  // El navegador no permite asignar archivos al input. La lista visible y el envío
  // se controlan con «fotos»; la ref solo abre el selector nativo.
  const input = useRef(null)
  function agregar(files) {
    const nuevas = [...fotos, ...files]
    if (nuevas.length > 3) return avisar(new Error('Solo puedes adjuntar tres imágenes.'))
    if (
      nuevas.some(
        (f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5242880
      )
    ) {
      return avisar(new Error('Usa archivos JPG, PNG o WebP de hasta 5 MB cada uno.'))
    }
    avisar(null)
    cambiar(nuevas)
  }
  return (
    <div>
      <span className="label">
        Fotos del equipo <small>Opcional</small>
      </span>
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          agregar([...e.target.files])
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="subir"
        onClick={() => input.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          agregar([...e.dataTransfer.files])
        }}
      >
        <Icono nombre="subir" size={24} />
        <b>Seleccionar imágenes</b>
        <small>Hasta 3 fotos · JPG, PNG o WebP · 5 MB por foto</small>
      </button>
      {fotos.length > 0 && (
        <ul className="archivos">
          {fotos.map((f, i) => (
            <li key={`${i}-${f.name}`}>
              <Icono nombre="foto" size={16} />
              <span>{f.name}</span>
              <button
                type="button"
                className="boton-icono"
                aria-label={`Quitar ${f.name}`}
                onClick={() => cambiar(fotos.filter((_, j) => j !== i))}
              >
                <Icono nombre="x" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
