import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
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
    host: true,
    hmr: { overlay: false },
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
