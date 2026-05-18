import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  // iOS (Capacitor) needs relative assets, GitHub Pages needs repository base path.
  base: mode === 'ios' ? './' : '/SalaryTracking/',
  plugins: [react()],
}))
