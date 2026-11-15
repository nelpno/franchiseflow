import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    target: 'es2020',
    cssMinify: 'lightningcss',
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // NAO usar a forma OBJETO aqui. Com objeto, o Rollup joga dentro do chunk
        // manual tambem os modulos compartilhados que ele "toca primeiro" — foi assim
        // que `__vitePreload` caiu no chunk `export` (jspdf+xlsx, 856 KB) e o `clsx`
        // do `cn()` caiu no chunk `recharts` (415 KB), tornando os DOIS dependencia
        // ESTATICA do chunk de entrada. Resultado medido em 07/09/2026: 1,27 MB que o
        // franqueado baixava para abrir a tela de vender e quase nunca usava.
        // jspdf/xlsx/recharts NAO entram aqui de proposito — o `import()` dinamico
        // (ExportButtons, pickingSheetPdf, shareUtils, TabResultado) ja os separa.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react-dom|react-router-dom|react-router|scheduler|@remix-run|react)[\\/]/.test(id)) return 'vendor'
          if (id.includes('@supabase')) return 'supabase'
          if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) return 'dates'
          if (/@radix-ui[\\/]react-(dialog|select|tooltip)[\\/]/.test(id)) return 'ui'
        }
      }
    }
  }
})
