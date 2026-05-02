import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/analyze': 'http://localhost:3000',
      '/generate-video': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
})
