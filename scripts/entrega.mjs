// Genera el cuaderno de la entrega leyendo los archivos reales: no hay fragmentos copiados a mano.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
const raiz = new URL('../', import.meta.url)
const leer = (ruta) => readFileSync(new URL(ruta, raiz), 'utf8')
const listar = (dir, ext) =>
  readdirSync(new URL(dir, raiz))
    .filter((n) => n.endsWith(ext))
    .sort()
    .map((n) => `${dir}/${n}`)
const lenguajes = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.jsx': 'jsx',
  '.json': 'json',
  '.svg': 'xml',
  '.css': 'css',
  '.html': 'html',
}
function archivo(ruta) {
  return `### \`${ruta}\`\n\n\`\`\`${lenguajes[extname(ruta)] || 'text'}\n${leer(ruta).trimEnd()}\n\`\`\`\n`
}
function arbol(rutas, prefijo = '') {
  const grupos = new Map()
  for (const ruta of rutas) {
    const [nombre, ...resto] = ruta.split('/')
    if (!grupos.has(nombre)) grupos.set(nombre, [])
    if (resto.length) grupos.get(nombre).push(resto.join('/'))
  }
  return [...grupos]
    .map(([nombre, hijos], i) => {
      const ultimo = i === grupos.size - 1
      return (
        prefijo +
        (ultimo ? '└── ' : '├── ') +
        nombre +
        (hijos.length ? '/\n' + arbol(hijos, prefijo + (ultimo ? '    ' : '│   ')) : '')
      )
    })
    .join('\n')
}
const backend = [...listar('backend/pb_migrations', '.js'), ...listar('backend/pb_hooks', '.js')]
const layout = 'frontend/src/components/Layout.jsx'
const frontend = [
  'frontend/package.json',
  'frontend/vite.config.js',
  'frontend/index.html',
  'frontend/src/main.jsx',
  'frontend/src/App.jsx',
  layout,
  ...listar('frontend/src/lib', '.js'),
  ...listar('frontend/src/components', '.jsx').filter((r) => r !== layout),
  ...listar('frontend/src/pages', '.jsx'),
  'frontend/src/styles.css',
  ...listar('frontend/public', '.svg'),
]
const lock = 'frontend/package-lock.json',
  font = 'frontend/public/fonts/manrope-latin.woff2',
  licencia = 'frontend/public/fonts/OFL.txt'
const prueba = 'tests/api.test.mjs',
  script = 'scripts/entrega.mjs'
const rutas = [
  ...backend,
  ...frontend,
  lock,
  font,
  licencia,
  prueba,
  script,
  '.gitignore',
  'README.md',
  'ENTREGA.md',
]
const bloques = [
  '# Voltio · Taller de Reparaciones — entrega de código',
  '## 1. Estructura de carpetas',
  `\`\`\`text\nParcial-2/\n${arbol(rutas)}\n\`\`\``,
  'El archivo **[README.md](./README.md)** incluye instalación desde cero, datos de prueba y comandos de verificación. El ejecutable de PocketBase, `pb_data`, `node_modules` y `dist` no se versionan.',
  '## 2. Backend · PocketBase 0.40.6',
  'Las migraciones definen el esquema, los permisos y los datos iniciales. Los hooks de modelo validan la transición y escriben el evento en la misma transacción; los hooks HTTP completan la validación del presupuesto y protegen el historial. Los diez casos de integración al final de esta sección se ejecutan sin pasar por React.',
  ...backend.map(archivo),
  archivo(prueba),
  '## 3. Frontend · React, Vite y react-router',
  'El menú conserva su layout y cada página lee datos reales con `fetch`. El detalle usa `/ordenes/:id`; tras escribir vuelve a pedir la orden con sus relaciones, sin deducir el estado desde la respuesta del formulario.',
  ...frontend.map(archivo),
  `### \`${font}\`\n\n[Fuente variable Manrope, archivo binario incluido en el proyecto](./${font}). Se sirve localmente; no depende de un CDN.`,
  archivo(licencia),
  `<details><summary><strong>${lock}</strong> · manifiesto completo de dependencias reproducibles</summary>\n\n${archivo(lock)}\n</details>`,
]
writeFileSync(new URL('ENTREGA.md', raiz), bloques.join('\n\n') + '\n')
