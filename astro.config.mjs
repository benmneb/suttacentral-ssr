// @ts-check
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  site: 'https://suttacentral.now',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    css: {
      transformer: 'lightningcss',
    },
  },
})
