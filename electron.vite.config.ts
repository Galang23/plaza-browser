import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          newtab: resolve(__dirname, 'src/renderer/newtab.html'),
          popover: resolve(__dirname, 'src/renderer/popover.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html'),
          about: resolve(__dirname, 'src/renderer/about.html'),
          'reading-list': resolve(__dirname, 'src/renderer/reading-list.html')
        }
      }
    }
  }
})
