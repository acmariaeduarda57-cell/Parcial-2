// Pictogramas SVG locales: sin paquete de iconos, fuentes remotas ni controles opacos.
const trazos = {
  ordenes: 'M8 5H5v16h14V5h-3 M9 3h6v4H9z M8 12h8m-8 4h5',
  nueva: 'M14 3H5v18h14V8z M14 3v5h5 M8 14h8m-4-4v8',
  resumen: 'M3 3v17h18 M7 16v-5m5 5V6m5 10V9',
  clientes:
    'M15.5 20v-2a5 5 0 0 0-5-5h-2a5 5 0 0 0-5 5v2 M13.5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M16 4a3.5 3.5 0 0 1 0 6.8m1 3a4.5 4.5 0 0 1 3.5 4.4V20',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  terminal: 'M3 4h18v14H3z M8 21h8m-4-3v3 M7 8l3 3-3 3m5 0h4',
  calendario: 'M4 6h16v15H4z M8 3v6m8-6v6M4 11h16m-12 4h3',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  pulso: 'M2 13h5l3-9 4 16 3-10h5',
  buscar: 'M16.6 10.3a6.3 6.3 0 1 1-12.6 0 6.3 6.3 0 0 1 12.6 0z M15 15l5 5',
  filtro:
    'M3 7h6m4 0h8M3 17h10m4 0h4 M13 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M17 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  ordenar: 'M8 4v16m-4-4 4 4 4-4 M16 20V4m-4 4 4-4 4 4',
  abajo: 'm6 9 6 6 6-6',
  derecha: 'm9 6 6 6-6 6',
  izquierda: 'm15 6-6 6 6 6',
  flecha: 'M4 12h15m-6-6 6 6-6 6',
  volver: 'M20 12H5m6-6-6 6 6 6',
  externo: 'M6 18 18 6M7 6h11v11',
  menu: 'M3 6h18M3 12h18M3 18h18',
  x: 'm6 6 12 12M18 6 6 18',
  laptop: 'M5 5h14v12H5z M5 17l-3 3h20l-3-3M9 17h6',
  gamepad:
    'M8 7h8c3 0 4 2 5 7 1 5-1 6-4 3l-2-2H9l-2 2c-3 3-5 2-4-3 1-5 2-7 5-7z M6 11.5h4m-2-2v4 M15 11h.1m2.5 2h.1',
  monitor: 'M3 4h18v13H3z M8 21h8m-4-4v4',
  phone: 'M7 2h10v20H7z M11 18h2',
  cpu: 'M6 6h12v12H6z M9 9h6v6H9z M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z M12 11v5m0-9v.1',
  foto: 'M3 4h18v16H3z M3 17l5-5 4 4 3-3 6 6 M16 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
  subir: 'M4 15v5h16v-5M12 16V3m-5 5 5-5 5 5',
  tiempo: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z M12 6v6l4 2',
  editar: 'm4 16 12-12 4 4L8 20l-5 1z M14 6l4 4',
  check: 'm4 12 5 5L20 6',
  llamar: 'm6 3 4 4-2 3c1 3 3 5 6 6l3-2 4 4-2 3c-8 1-17-8-16-16z',
  llave: 'M14 5a6 6 0 0 0-7 7l-5 5 4 4 6-6a6 6 0 0 0 7-8l-4 4-3-3 4-4z',
  lista: 'M4 6h2m3 0h11M4 12h2m3 0h11M4 18h2m3 0h11',
}
export default function Icono({ nombre, size = 18, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={trazos[nombre]} />
    </svg>
  )
}
