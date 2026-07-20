// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Čisto statický web (ADR-0001), hosting Vercel (ADR-0006).
// Interaktívne prvky = React islands (ADR-0007). Dáta z ../data pri builde (data.ts).
export default defineConfig({
  site: 'https://statistika.futbalsfz.sk',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
