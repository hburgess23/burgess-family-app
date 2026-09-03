import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'The Burgess Family App',
        short_name: 'Burgess Family',
        description: 'A private family dashboard for calendar, chores, meals, reminders, rewards, groceries and messages.',
        theme_color: '#f7f7fb',
        background_color: '#f7f7fb',
        display: 'standalone',
        start_url: '/',
        icons: []
      }
    })
  ]
})
