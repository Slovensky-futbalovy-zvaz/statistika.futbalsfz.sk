// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Čisto statický web (ADR-0001), hosting Cloudflare Pages (ADR-0003).
// Dáta sa čítajú pri builde zo susedného priečinka ../data (viď src/lib/data.ts).
export default defineConfig({
  site: 'https://statistika.futbalsfz.sk',
  vite: {
    plugins: [tailwindcss()],
  },
});
