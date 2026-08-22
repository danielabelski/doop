import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4300,
    proxy: {
      /* changeOrigin stays OFF so the backend sees Host localhost:4300 and
         better-auth builds OAuth discovery/authorize URLs on this origin —
         the one that serves the login page and that MCP clients connect to */
      '/api': { target: 'http://localhost:4400' },
      '/mcp': { target: 'http://localhost:4400' },
      '/i': { target: 'http://localhost:4400' },
      '/a/': { target: 'http://localhost:4400' },
      '/u/': { target: 'http://localhost:4400' },
      '/relay': { target: 'http://localhost:4400' },
      '/blog': { target: 'http://localhost:4400' },
      '/robots.txt': { target: 'http://localhost:4400' },
      '/sitemap.xml': { target: 'http://localhost:4400' },
      '/.well-known': { target: 'http://localhost:4400' },
      '/ws': { target: 'ws://localhost:4400', ws: true },
    },
  },
})
