import { useCallback, useEffect, useState } from 'react'

// «leer» es una función de módulo estable. «clave» distingue, por ejemplo, dos /ordenes/:id.
export function useLectura(leer, clave = '') {
  const [revision, setRevision] = useState(0)
  const [respuesta, setRespuesta] = useState(null)
  // Identidad estable: así no reinstalamos el listener de foco en cada render.
  const recargar = useCallback(() => setRevision((n) => n + 1), [])
  useEffect(() => {
    window.addEventListener('focus', recargar)
    return () => window.removeEventListener('focus', recargar)
  }, [recargar])
  useEffect(() => {
    const c = new AbortController()
    const publicar = (datos, error) => {
      if (!c.signal.aborted) setRespuesta({ leer, clave, revision, datos, error })
    }
    leer(c.signal, clave)
      .then((datos) => publicar(datos, null))
      .catch((error) => publicar(null, error))
    // Una respuesta lenta de la ruta anterior no puede reemplazar la orden actual.
    return () => c.abort()
  }, [leer, clave, revision])
  const misma = respuesta?.leer === leer && respuesta.clave === clave
  return {
    datos: misma ? respuesta.datos : null,
    error: misma ? respuesta.error : null,
    cargando: !misma || respuesta.revision !== revision,
    recargar,
  }
}
