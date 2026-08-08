#!/usr/bin/env node
/**
 * Generátor OG obrázkov (1200×630) pre statistika.futbalsfz.sk.
 *
 * Existujúce OG obrázky vznikli ručne v júli 2026 a generátor k nim nebol
 * v repozitári — tento skript ich štýl reprodukuje, aby sa nové stránky dali
 * doplniť bez ručnej práce v grafickom editore: modrý gradient, logo SFZ
 * a značka vľavo hore, tematický piktogram v presvetlenom kruhu vpravo hore,
 * veľký titulok, podtitulok, päta a červený pruh dole.
 *
 * POZOR: prepisuje len tie súbory, ktoré vymenuješ v argumentoch. Bez
 * argumentov nevygeneruje NIČ — aby sa omylom neprepísali existujúce obrázky.
 *
 *   node tools/og/generuj.mjs trendy dokumentacia
 *   node tools/og/generuj.mjs --vsetky        # naozaj prepíše všetky
 *
 * Vyžaduje Google Chrome (headless screenshot). Playwright ani ďalšie
 * závislosti netreba.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const VEREJNE = path.join(REPO, 'web', 'public');
const VYSTUP = path.join(VEREJNE, 'og');

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error('Nenašiel som Chrome ani Chromium — OG obrázky sa nedajú vyrenderovať.');
  process.exit(1);
}

/** Piktogramy (Lucide, stroke 1.5) — jeden na stránku, kreslí sa do kruhu vpravo hore. */
const PIKTO = {
  // stĺpcový graf s rastúcou čiarou
  trend:
    '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/><path d="M19 9v4"/><path d="M19 9h-4"/>',
  // otvorená kniha
  kniha:
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
};

/** Definícia jednej stránky: súbor, titulok, podtitulok, piktogram. */
const STRANKY = {
  trendy: {
    titulok: 'Trendy slovenského futbalu',
    podtitulok: 'Ako starne futbal dospelých a ako rastie mládežnícka základňa klubov.',
    pikto: PIKTO.trend,
  },
  dokumentacia: {
    titulok: 'Dokumentácia a metodika',
    podtitulok: 'Odkiaľ dáta pochádzajú, ako sa počítajú a čo presne jednotlivé čísla znamenajú.',
    pikto: PIKTO.kniha,
  },
};

const args = process.argv.slice(2);
const ciele = args.includes('--vsetky') ? Object.keys(STRANKY) : args;

if (!ciele.length) {
  console.error('Použitie: node tools/og/generuj.mjs <stranka…>');
  console.error('Dostupné: ' + Object.keys(STRANKY).join(', '));
  process.exit(1);
}

const sablona = fs.readFileSync(path.join(HERE, 'sablona.html'), 'utf-8');
const docasny = fs.mkdtempSync(path.join(VEREJNE, '.og-tmp-'));

// logo musí ležať vedľa HTML — Chrome ho číta relatívne
fs.copyFileSync(path.join(VEREJNE, 'sfz-logo-official.svg'), path.join(docasny, 'sfz-logo-official.svg'));

const escapuj = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

try {
  for (const kluc of ciele) {
    const s = STRANKY[kluc];
    if (!s) {
      console.error(`Neznáma stránka: ${kluc}`);
      process.exitCode = 1;
      continue;
    }
    const html = sablona
      .replace(
        '<div class="pikto" data-pikto></div>',
        `<svg class="pikto" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${s.pikto}</svg>`,
      )
      .replace('<h1 data-titulok>Titulok</h1>', `<h1>${escapuj(s.titulok)}</h1>`)
      .replace(
        '<p class="podtitulok" data-podtitulok>Podtitulok</p>',
        `<p class="podtitulok">${escapuj(s.podtitulok)}</p>`,
      );

    const htmlPath = path.join(docasny, `${kluc}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');

    const cielovy = path.join(VYSTUP, `${kluc}.png`);
    execFileSync(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--window-size=1200,630',
        `--screenshot=${cielovy}`,
        `file://${htmlPath}`,
      ],
      { stdio: 'ignore' },
    );
    console.log(`OK  og/${kluc}.png`);
  }
} finally {
  fs.rmSync(docasny, { recursive: true, force: true });
}
