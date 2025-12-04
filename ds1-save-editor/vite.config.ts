import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'static' ? './' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './index.html',
        ds1: './ds1.html',
        ds3: './ds3.html',
        eldenring: './eldenring.html',
      },
      output: {
        manualChunks: undefined,
      }
    }
  }
}))
