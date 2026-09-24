import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // Tailwind v4 — no config file needed
  ],
  test: {
    environment: 'node',
    globals: true,
  },
})
