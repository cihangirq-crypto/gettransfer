import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths"
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  root: '.',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    https: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
        
      }
    }
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react'],
          map: ['leaflet', 'react-leaflet']
        }
      }
    }
  }
})
