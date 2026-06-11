import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Docker mounts OncoVision/app/src at /app/oncovision-src; fall back to relative path for local dev
const oncovisionSrc = existsSync('/app/oncovision-src/lib.tsx')
  ? '/app/oncovision-src/lib.tsx'
  : resolve(__dirname, '../../OncoVision/app/src/lib.tsx')

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    basicSsl()
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      oncovision: oncovisionSrc,
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      },
      '/room': {
        target: 'http://oncovision-api:8000',
        changeOrigin: true,
        ws: true,
      },
      '/viewer': {
        target: 'http://oncovision-api:8000',
        changeOrigin: true,
      },
      '/draw': {
        target: 'http://oncovision-api:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
