import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/proxy/us': {
        target: 'https://api.8x8.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/proxy\/us/, '/cidp/journey/api'),
      },
      '/proxy/eu': {
        target: 'https://api-eu.8x8.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/proxy\/eu/, '/cidp/journey/api'),
      },
      '/proxy/css-us': {
        target: 'https://api.8x8.com/storage/us',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/proxy\/css-us/, ''),
      },
      '/proxy/css-eu': {
        target: 'https://api.8x8.com/storage/eu',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/proxy\/css-eu/, ''),
      },
      '/proxy/oauth': {
        target: 'https://api.8x8.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/proxy\/oauth/, '/oauth/v2/token'),
      },
    },
  },
})
