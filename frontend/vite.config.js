import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El navegador siempre usa /api en su propio origen. Solo Vite conoce el puerto interno.
const proxy = {
  '/api': { target: process.env.PB_ORIGIN || 'http://127.0.0.1:8090', changeOrigin: true },
}
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], proxy },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], proxy },
})
