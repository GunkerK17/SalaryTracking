import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/SalaryTracking/', // CỰC KỲ QUAN TRỌNG: Phải viết đúng hoa thường tên repo của bạn
})
