import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.jsx'
import Ordenes from './pages/Ordenes.jsx'
import Detalle from './pages/Detalle.jsx'
import NuevaOrden from './pages/NuevaOrden.jsx'
import Resumen from './pages/Resumen.jsx'
import Clientes from './pages/Clientes.jsx'
import NoEncontrada from './pages/NoEncontrada.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/ordenes" replace />} />
        <Route path="ordenes" element={<Ordenes />} />
        <Route path="ordenes/nueva" element={<NuevaOrden />} />
        <Route path="ordenes/:id" element={<Detalle />} />
        <Route path="resumen" element={<Resumen />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  )
}
