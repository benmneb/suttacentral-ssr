// @ts-check
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
export default defineConfig({
  compressHTML: true,
  devToolbar: { enabled: false },
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  session: {
    driver: { entrypoint: 'unstorage/drivers/null' },
  },
  site: 'https://suttacentral.now',
  vite: {
    plugins: [tailwindcss()],
    // Vite 7s targets, as Vite 8s drop fallbacks like 100vh before 100svh
    build: {
      cssTarget: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    },
    css: {
      transformer: 'lightningcss',
      lightningcss: {
        targets: {
          chrome: 107 << 16,
          edge: 107 << 16,
          firefox: 104 << 16,
          safari: 16 << 16,
        },
      },
    },
  },
})
