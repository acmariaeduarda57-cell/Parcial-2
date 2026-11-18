# Voltio · Taller de Reparaciones

Aplicación de recepción y seguimiento de equipos electrónicos. El personal del taller trabaja **sin sesión, contraseñas ni roles**. Un cliente es un contacto, no una cuenta. **PocketBase decide si una operación es válida**, aunque se haga con `curl` y sin abrir React.

**[Entrega completa: árbol → backend → frontend, con la ruta antes del código de cada archivo](./ENTREGA.md).** Esta guía de instalación también sirve como guion para la defensa oral.

## 1. Estructura del proyecto

```text
Parcial-2/
├── backend/
│   ├── pb_migrations/       # Esquema y reglas, demostración y cierre del registro de cuentas
│   └── pb_hooks/            # ordenes.pb.js (registro) y flujo.js (dominio/transacción)
├── frontend/
│   ├── index.html, package.json, package-lock.json, vite.config.js
│   ├── public/              # Marca, plano de osciloscopio y fuente local con licencia
│   └── src/
│       ├── main.jsx, App.jsx, styles.css
│       ├── lib/             # Cliente REST nativo, lecturas cancelables y cálculos puros
│       ├── components/      # Layout, formularios, monitor, tabla y acciones
│       └── pages/           # Órdenes, detalle, alta, resumen, clientes y 404
├── tests/api.test.mjs       # Pruebas contra un PocketBase real y desechable
├── scripts/entrega.mjs      # Reconstruye el documento de código desde los fuentes
├── .gitignore
├── ENTREGA.md
└── README.md
```

Requisitos: **Node.js 22.12 o superior**, npm y el ejecutable de **PocketBase 0.40.6** (versión fijada y probada; usa la API de migraciones `fields` de la familia 0.23+). No hacen falta Go, Docker, una cuenta de PocketBase ni un servidor de base de datos aparte.

## 2. Backend: instalar y levantar PocketBase

Desde la raíz del repositorio, descarga el ZIP de [PocketBase v0.40.6](https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6) para tu sistema y extrae **solo el ejecutable** dentro de `backend/`. Ejemplo reproducible para Linux x86-64:

```bash
cd backend
curl -fL https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_linux_amd64.zip -o /tmp/voltio-pb.zip
printf '0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f  /tmp/voltio-pb.zip\n' | sha256sum -c -
unzip /tmp/voltio-pb.zip pocketbase
chmod +x pocketbase
./pocketbase --version
```

En macOS utiliza el archivo `darwin_arm64` o `darwin_amd64` correspondiente y verifica su entrada en `checksums.txt` de la misma publicación. En Windows extrae `pocketbase.exe` y usa `.\pocketbase.exe` en lugar de `./pocketbase`.

**Terminal 1**, dentro de `backend/`:

```bash
./pocketbase serve --http=127.0.0.1:8090 --dir=./pb_data --hooksDir=./pb_hooks --migrationsDir=./pb_migrations
```

`serve` aplica las migraciones pendientes **una sola vez** y carga los hooks. Parte de un directorio de datos nuevo para este proyecto, no de una base de otra aplicación. No hay que importar esquemas a mano ni crear un superusuario para usar el taller. Comprueba `http://127.0.0.1:8090/api/health`. El panel administrativo `/_/` es de PocketBase, no es la interfaz del taller.

**Alternativa si no puedes descargar los ZIP:** en un entorno virtual de Python con una rueda para tu plataforma, `python -m pip install --only-binary=:all: pocketbase-bin==0.40.6` instala una distribución de terceros del ejecutable (no es un SDK). Con el entorno activado, usa `pocketbase` en lugar de `./pocketbase`, manteniendo los directorios explícitos del comando anterior.

### Esquema y permisos efectivos

| Colección | Campos del dominio | Listar / ver | Crear | Actualizar | Borrar |
|---|---|---|---|---|---|
| `clientes` | `nombre`, `telefono` | `""` | `""` | `""` | `null` |
| `ordenes` | `cliente`, `equipo`, `problema`, `estado`, `diagnostico`, `manoObra`, `piezas`, `fotos` | `""` | `""` + hook de alta | `""` + hooks de flujo | `null` |
| `eventos` | `orden`, `de`, `a`, `created` automático | `""` | `null` | `null` | `null` |

- `""` significa acceso anónimo; `null` bloquea esa operación para la API ordinaria. La plantilla de cuentas `users` que trae PocketBase queda sin registro ni autenticación pública. No se utilizan tokens en el frontend.
- La relación `cliente` es obligatoria. `fotos` acepta hasta tres JPEG, PNG o WebP de 5 MiB cada una. Las mismas restricciones existen en el esquema: quitar una comprobación de React no las desactiva.
- El código `OT-…` es una referencia visual derivada del `id`; los enlaces y consultas usan el **ID completo** de PocketBase. La fecha de ingreso se lee del evento de alta. No se añade un campo `total` ni se duplican fechas de ingreso en `ordenes`.

### Máquina de estados y presupuesto

```text
solicitada ────→ en_diagnostico ──→ presupuestada ──→ aprobada ──→ en_reparacion ──→ lista ──→ entregada
    └─────────→ cancelada                 └─────────→ rechazada
```

1. El alta siempre queda `solicitada`, sin presupuesto, con un evento `de: ""`, `a: "solicitada"`.
2. El hook de **modelo** lee la orden persistida dentro de una transacción, comprueba el estado original, valida el destino contra una lista cerrada y llama a `e.next()` para que PocketBase valide y escriba. En esa **misma transacción** crea el evento. Si falla una escritura, se revierten ambas. Dos peticiones competidoras no pueden bifurcar el historial.
3. El diagnóstico, la mano de obra y **todas** las piezas viajan juntos al pasar de `en_diagnostico` a `presupuestada`. El hook HTTP verifica que se enviaron los tres campos y evita que la conversión de tipos de PocketBase acepte texto inválido como un cero. El hook de modelo comprueba el contenido efectivo. Ejemplo de cuerpo `PATCH`:

   ```json
   {
     "estado": "presupuestada",
     "diagnostico": "Conector de alimentación deteriorado.",
     "manoObra": 45,
     "piezas": [{ "descripcion": "Conector", "cantidad": 2, "precio": 4.5 }]
   }
   ```

   La cantidad es un entero positivo; los importes son no negativos, con hasta dos decimales. Se admiten mano de obra `0` y piezas `[]`. El total del ejemplo es **54,00 €**: se calcula en céntimos al mostrarlo y nunca se persiste. Ni un `PATCH` parcial ni uno combinado con un avance pueden alterar el presupuesto fuera de ese paso.
4. `rechazada`, `cancelada` y `entregada` son terminales: no se admiten más actualizaciones, ni siquiera de los datos descriptivos. Una edición sin cambio de etapa en una orden abierta no crea un evento ficticio.
5. Solo el servidor escribe eventos. Además de las reglas `null`, los hooks HTTP deniegan escrituras a `eventos` y borrados de órdenes incluso desde la API administrativa. Esto no impide las operaciones internas de migración; quien administra el servidor o el archivo SQLite está, por definición, fuera de la frontera de la API.

**Alcance de la seguridad:** las reglas protegen la integridad del proceso, no identifican a quien llama. Cualquier persona con acceso de red puede leer contactos y solicitar una transición *válida*. Usa el sistema en el equipo del taller o en una red privada de confianza; no publiques estos puertos en Internet con datos reales. `pb_data/` contiene la base y los archivos: respáldalo y mantenlo fuera de Git.

### Datos de prueba incluidos

| Cliente | ID real | Teléfono de ejemplo |
|---|---|---|
| Lucía Torres | `democt000000001` | 600 000 101 |
| Mateo Ruiz | `democt000000002` | 600 000 102 |

| Orden | ID real | Equipo | Cliente | Etapa inicial de la demo | Total calculado |
|---|---|---|---|---|---:|
| OT-0003 | `demoot000000003` | MacBook Air M1 | Lucía Torres | `solicitada` | Sin presupuesto |
| OT-0002 | `demoot000000002` | Sony PlayStation 5 | Mateo Ruiz | `presupuestada` | 77,50 € |
| OT-0001 | `demoot000000001` | Dell UltraSharp 27″ | Lucía Torres | `en_reparacion` | 54,00 € |

La migración de demostración guarda órdenes nuevas y recorre los pasos reales. Por eso las tres tienen historial coherente (1, 3 y 5 eventos, respectivamente). Reiniciar no duplica registros.

### Comprobar las garantías sin la interfaz

Desde **la raíz** (no requiere instalar dependencias de npm):

```bash
node --test tests/api.test.mjs
```

La suite encuentra `backend/pocketbase` (`.exe` en Windows) o `pocketbase` en el `PATH`. Si está en otro directorio, indica la ruta absoluta: `POCKETBASE_BIN=/ruta/al/pocketbase node --test tests/api.test.mjs`. Arranca su propia instancia en un puerto libre, comprueba la matriz completa, los estados terminales, el presupuesto, la auditoría, los bloqueos de API, las fotos y dos escrituras concurrentes. También fuerza un fallo de auditoría **solo en los hooks de prueba** para comprobar el rollback. Cierra el proceso y elimina su base temporal: **no toca las tres órdenes de la demo**.

Dos comprobaciones manuales que tampoco cambian los ejemplos:

```bash
# Devuelve 400: solicitada no puede saltar a entregada.
curl -i -X PATCH -H 'Content-Type: application/json' -d '{"estado":"entregada"}' http://127.0.0.1:8090/api/collections/ordenes/records/demoot000000003
# Devuelve 403: el cliente HTTP no puede fabricar un evento.
curl -i -X POST -H 'Content-Type: application/json' -d '{"orden":"demoot000000003","de":"solicitada","a":"lista"}' http://127.0.0.1:8090/api/collections/eventos/records
```

## 3. Frontend: instalar y levantar React

**Terminal 2**, desde la raíz:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Abre **http://127.0.0.1:5173/** (o el puerto que muestre Vite). En la vista previa remota se usa `npm run dev`: Vite escucha en `0.0.0.0` y admite el host del proxy. El navegador siempre solicita **`/api/...` de su propio origen**. Solo el proxy de Vite conecta al backend en `127.0.0.1:8090`; `PB_ORIGIN` permite cambiar ese destino en el proceso de Vite. Si PocketBase no está disponible, la pantalla muestra el error y permite reintentar; no hay datos simulados de sustitución.

| Ruta | Qué permite hacer |
|---|---|
| `/` → `/ordenes` | Buscar por referencia, equipo o cliente; filtrar por etapa, ordenar y paginar. |
| `/ordenes/nueva` | Seleccionar o registrar cliente, describir el problema y adjuntar fotos. |
| `/ordenes/:id` | Ver ficha, imágenes, historial y presupuesto; ejecutar solo las acciones que corresponden a la etapa actual. |
| `/resumen` | Contar órdenes de las nueve etapas, incluidas las de cero órdenes; abrir cada grupo en el registro. |
| `/clientes` | Buscar, registrar y editar contactos. |
| `*` | 404 con vuelta al registro; el detalle también distingue una orden inexistente de un fallo de red. |

**Decisiones para explicar el código:**

- `main.jsx` monta `BrowserRouter` de **`react-router`**. `App.jsx` define las rutas hijas; `Layout.jsx` conserva el menú con `NavLink` y coloca la página en `Outlet`.
- `lib/api.js` es la única puerta HTTP: `fetch` nativo, JSON o `FormData`, paginación de PocketBase y mensajes del servidor, incluidos errores por campo. Para el resumen basta con leer `id,estado`; no se requiere un endpoint propio. Los datos nunca se leen del almacenamiento del navegador.
- `useLectura` vuelve a hacer GET al cambiar la ruta, al recuperar el foco o al recargar tras una escritura. Su `AbortController` cancela la lectura anterior. Tras un cambio de etapa se releen la orden **y su historial**; un rechazo también se muestra y provoca una relectura. No se avanza el estado de forma optimista.
- Formularios controlados y listas con claves. La selección de archivos es nativa; la lista elegida vive en estado. `useRef` enfoca el nombre al abrir el formulario de cliente. Los botones de etapa solo guían al operador: el servidor no confía en ellos.
- `useMemo` evita recalcular las líneas del presupuesto al escribir el diagnóstico y evita reordenar el registro solo por paginar. `useCallback` mantiene estable la función que usa el listener de foco. No hay SDK de PocketBase ni librerías de estado o componentes.

### Compilar y servir con un solo proceso

```bash
# Dentro de frontend/
npm run build
# Detén el servidor anterior del puerto 8090 y, desde frontend/:
cd ../backend
./pocketbase serve --http=127.0.0.1:8090 --dir=./pb_data --hooksDir=./pb_hooks --migrationsDir=./pb_migrations --publicDir=../frontend/dist --indexFallback=true
```

Abre `http://127.0.0.1:8090/`. El fallback a `index.html` permite recargar directamente `/ordenes/:id`; PocketBase sigue sirviendo `/api` en el mismo origen. Para regenerar la entrega de código después de editar los fuentes, ejecuta `node scripts/entrega.mjs` desde la raíz.
