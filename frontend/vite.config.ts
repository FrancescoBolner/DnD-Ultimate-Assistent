import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // bind to 0.0.0.0 so players on the LAN can connect
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
})
