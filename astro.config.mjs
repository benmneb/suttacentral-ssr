// @ts-check
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  site: 'https://suttacentral.now',
  vite: {
    plugins: [tailwindcss()],
    css: {
      transformer: 'lightningcss',
    },
  },
})
