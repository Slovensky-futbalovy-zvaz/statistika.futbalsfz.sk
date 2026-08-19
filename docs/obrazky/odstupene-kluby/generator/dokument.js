const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ImageRun, PageOrientation, Footer, PageNumber,
  LevelFormat, convertInchesToTwip, ExternalHyperlink, PositionalTab, PositionalTabAlignment,
  PositionalTabLeader, SectionType, TabStopType, PageBreak,
} = require('docx');

const MODRA = '1450DF', INK = '0F172A', MUT = '64748B', CERV = 'EC1C24', ZEL = '12A06B';
const LINE = 'E2E8F0', BG = 'F8FAFC';

// ── pomocníci ──────────────────────────────────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text, font: 'Calibri', ...o });
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...o });
const veta = (text, o = {}) => p(t(text), { spacing: { after: 140, line: 276 }, ...o });

/** Odsek s tučnými úsekmi — **takto** označené v texte. */
function odsek(text, o = {}) {
  const runs = [];
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).forEach((cast) => {
    if (cast.startsWith('**')) runs.push(t(cast.slice(2, -2), { bold: true }));
    else runs.push(t(cast));
  });
  return p(runs, { spacing: { after: 140, line: 276 }, ...o });
}

const H1 = (text) => p(t(text, { bold: true, size: 30, color: INK }),
  { heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 160 } });
const H2 = (text) => p(t(text, { bold: true, size: 24, color: MODRA }),
  { heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 } });

/** Citát na použitie — orámovaný blok. */
const citat = (text) => p([t('„' + text + '“', { italics: true, size: 22, color: INK })], {
  spacing: { before: 120, after: 180, line: 288 },
  indent: { left: 220, right: 220 },
  border: {
    left: { style: BorderStyle.SINGLE, size: 18, color: MODRA, space: 12 },
    top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 8 },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 8 },
    right: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 8 },
  },
  shading: { type: ShadingType.CLEAR, fill: BG },
});

/** Tabuľka: hlavička + riadky. sirky v DXA, spolu 9070 (A4 s 2,5 cm okrajmi). */
function tabulka(hlavicka, riadky, sirky, zvyraznPosledny = false) {
  const cela = (text, { bold, align, fill, color } = {}) => new TableCell({
    width: { size: 100, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [p(
      String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((c) => c.startsWith('**')
        ? t(c.slice(2, -2), { bold: true, size: 19, color: color || INK })
        : t(c, { bold, size: 19, color: color || INK })),
      { alignment: align || AlignmentType.LEFT, spacing: { after: 0 } },
    )],
  });
  const riadok = (bunky, o = {}) => new TableRow({
    children: bunky.map((b, i) => {
      const c = cela(b, {
        bold: o.bold, fill: o.fill, color: o.color,
        align: (i === 0 || sirky[i] > 3000) ? AlignmentType.LEFT : AlignmentType.CENTER,
      });
      c.options.width = { size: sirky[i], type: WidthType.DXA };
      return c;
    }),
    tableHeader: o.hlavicka,
  });
  const rows = [riadok(hlavicka, { bold: true, fill: 'EEF2F6', hlavicka: true })];
  riadky.forEach((r, i) => {
    const posledny = zvyraznPosledny && i === riadky.length - 1;
    rows.push(riadok(r, posledny ? { bold: true, fill: 'FDECEC' } : {}));
  });
  return new Table({
    columnWidths: sirky,
    width: { size: sirky.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows,
  });
}

/** Obrázok na šírku sadzby + popis. */
function obrazok(cesta, popis, sirkaPt = 460) {
  const [w, h] = cesta.includes('infografika') ? [2200, 1500] : [1600, 900];
  const vyska = Math.round(sirkaPt * h / w);
  return [
    p(new ImageRun({ type: 'png', data: fs.readFileSync(cesta), transformation: { width: sirkaPt, height: vyska } }),
      { spacing: { before: 140, after: 60 }, alignment: AlignmentType.CENTER }),
    p(t(popis, { size: 17, color: MUT, italics: true }),
      { spacing: { after: 200 }, alignment: AlignmentType.CENTER }),
  ];
}

const medzera = (n = 120) => p(t(''), { spacing: { after: n } });

// ── obsah dokumentu ────────────────────────────────────────────────────────────────
const telo = [
  // titulok
  p(new ImageRun({ type: 'png', data: fs.readFileSync('/tmp/art/logo.png'),
    transformation: { width: 54, height: 54 } }), { spacing: { after: 60 } }),
  p([t('ŠTATISTIKY SLOVENSKÉHO FUTBALU', { bold: true, size: 15, color: MUT, characterSpacing: 30 })],
    { spacing: { after: 200 } }),
  p(t('Odstúpené kluby — čo hovoria dáta', { bold: true, size: 44, color: INK }),
    { heading: HeadingLevel.TITLE, spacing: { after: 120 } }),
  odsek('**Podklad na argumentáciu, 19. 8. 2026.** Dáta z prepočtu 19. 8. 2026 vrátane rozbehu sezóny 2026/2027. Zadanie prišlo ako „štatistika odhlásených klubov '
    + 'za posledných 5 rokov“ s cieľom vyvrátiť rétoriku, že sa kluby hromadne odhlásili tento rok — '
    + 'či už pre zmeny v RaPP, alebo pre nevyplatené finančné záväzky zo strany SFZ.'),
  p([t('Zdroj: ISSF, prepočet ', { size: 19, color: MUT }),
    t('etl/odstupene_kluby.py', { size: 19, color: MUT, font: 'Consolas' }),
    t(' → ', { size: 19, color: MUT }),
    t('data/odstupene-kluby.json', { size: 19, color: MUT, font: 'Consolas' }),
    t('. Overiteľné na ', { size: 19, color: MUT }),
    new ExternalHyperlink({ link: 'https://statistika.futbalsfz.sk',
      children: [t('statistika.futbalsfz.sk', { size: 19, color: MODRA, underline: {} })] }),
    t('.', { size: 19, color: MUT })],
    { spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 10 } } }),

  H1('Najprv terminológia, inak sa v tom stratíme'),
  odsek('**„Odhlásený klub“ je zlá definícia — odhlasujú sa DRUŽSTVÁ, nie kluby.** Klub môže odhlásiť '
    + 'dorast a ďalej hrať dospelých aj prípravku. Preto sa v tomto podklade pracuje s dvoma presnými pojmami:'),
  tabulka(['Pojem', 'Definícia'], [
    ['**Odstúpený klub**', 'klub, ktorý **prvú sezónu nemá v súťažiach žiadne družstvo** a v predchádzajúcej sezóne mal aspoň jedno'],
    ['**Zaniknutý klub**', 'klub, ktorý **dva roky po sebe** neprihlási do súťaže žiadne družstvo'],
  ], [2200, 6870]),
  medzera(160),
  odsek('Odstúpený klub **nie je zaniknutý klub**. Po jednej vynechanej sezóne sa vracia každý piaty '
    + 'klub (19,7 %). Zánik je až druhá tichá sezóna.'),
  odsek('Prihlásené družstvo sa v dátach meria **reálne odohraným zápasom** — družstvo, ktoré sa '
    + 'prihlási a odhlási pred prvým kolom, hraný futbal nie je. Poháre sa nerátajú: do Slovnaft Cupu '
    + 'sa dostane len klub aktívny v súťažiach. **Prebiehajúca sezóna 2026/2027 sa nehodnotí** — '
    + 'mládežnícke súťaže sa rozbiehajú neskôr, takže klub, ktorý ešte len čaká na štart svojej súťaže, '
    + 'by vyšiel ako odstúpený. Preregistrácie klubu (nové IČO) sa spájajú s predchodcom, inak by '
    + 'preregistrácia vyšla ako strata všetkých družstiev.'),

  new Paragraph({ children: [new PageBreak()] }),
  H1('1. Koľko klubov odstúpilo — a kedy'),
  tabulka(['Sezóna', 'Odstúpených klubov', 'Z nich sa vrátilo', 'Z nich zaniklo'], [
    ['2015/2016', '72', '16', '56'], ['2016/2017', '78', '24', '54'],
    ['2017/2018', '58', '20', '38'], ['2018/2019', '70', '27', '43'],
    ['2019/2020', '76', '15', '61'], ['2020/2021', '63', '11', '52'],
    ['2021/2022', '80', '18', '62'], ['2022/2023', '59', '15', '44'],
    ['2023/2024', '53', '8', '45'], ['2024/2025', '51', '7', '44'],
    ['**2025/2026**', '**42**', 'zatiaľ 0', 'zatiaľ nevieme'],
    ['2026/2027 (sezóna sa iba začína)', '—', '—', '—'],
  ], [2270, 2600, 2100, 2100], false),
  medzera(160),
  odsek('**Priemer jedenástich sezón je 63,8 klubu.** V sezóne 2025/2026 odstúpilo **42 klubov — '
    + 'najmenej za celé sledované obdobie.** Tri najnižšie hodnoty v celom rade sú tri posledné '
    + 'sezóny: 53, 51, 42.'),
  citat('V poslednej sezóne odstúpilo 42 klubov. To je najnižší počet za jedenásť sezón, pri priemere '
    + '63,8 — a tri najnižšie hodnoty v celom rade sú tri posledné sezóny.'),
  odsek('Ak by za odstupovaním stáli zmeny v RaPP alebo nevyplatené záväzky, čakali by sme v poslednej '
    + 'sezóne **skok nahor**. Namerané je presne opačné číslo.'),
  ...obrazok('/tmp/viz3/01-odstupene.png',
    'Graf 1 — Odstúpené kluby po sezónach. Zelený stĺpec je posledná sezóna, prerušovaná čiara priemer.'),

  H2('Sezóna 2026/2027 — prvé kolá sa odohrali, hodnotiť sa ešte nedá'),
  odsek('Prvé kolá sezóny 2026/2027 sú za nami, preto ju v tabuľke uvádzame — ale **len ako rozbeh, '
    + 'nie ako počet odstúpených klubov.** Stav k prepočtu z 19. 8. 2026:'),
  tabulka(['Ukazovateľ', '2026/2027', '2025/2026 (celá)', 'Rozbeh'], [
    ['Súťaže s uzavretým zápasom', '145', '397', '36,5 %'],
    ['Odohrané zápasy', '1 757', '61 007', '2,9 %'],
    ['Družstvá', '2 326', '5 686', '40,9 %'],
    ['Kluby s aspoň jedným zápasom', '1 024', '1 401', '73,1 %'],
  ], [3470, 1900, 1900, 1800]),
  medzera(160),
  veta('Prečo sa to hodnotiť nedá — rozbeh po vekových kategóriách:'),
  tabulka(['Kategória', '2026/2027', '2025/2026 (celá)', 'Rozbeh'], [
    ['Dospelí', '1 007', '1 320', '76,3 %'],
    ['Dorast', '487', '803', '60,6 %'],
    ['Žiaci', '416', '1 611', '25,8 %'],
    ['**Prípravka**', '**32**', '**1 712**', '**1,9 %**'],
  ], [3470, 1900, 1900, 1800]),
  medzera(160),
  odsek('Súťaže sa rozbiehajú v poradí dospelí → dorast → žiaci → prípravky, mládež má štart '
    + 'o týždne neskôr. **Bez odohraného zápasu je zatiaľ 382 klubov — a toto číslo NIE JE počet '
    + 'odstúpených klubov.** Prípraviek hrá 1,9 % a žiakov 25,8 %, takže väčšina tých klubov len '
    + 'čaká na štart svojej súťaže. Je to presne to číslo, ktoré by rétoriku o hromadnom '
    + 'odhlasovaní zdanlivo potvrdilo, preto sa tak nesmie použiť ani interne. Počet odstúpených '
    + 'klubov za sezónu 2026/2027 budeme vedieť po jesennej časti.'),

  H1('2. Aké to boli kluby'),
  veta('Profil 42 klubov, ktoré odstúpili v sezóne 2025/2026:'),
  tabulka(['Ukazovateľ', 'Hodnota'], [
    ['Priemerný počet družstiev v poslednej odohranej sezóne', '**1,45**'],
    ['Malo jediné družstvo', '**27 zo 42**'],
    ['Malo dve družstvá', '12'],
    ['Malo tri a viac', '3'],
    ['Priemerný počet sezón, ktoré klub odohral', '**9,6**'],
    ['Existovalo 9 a viac sezón', '**33 zo 42**'],
    ['Malo len dospelých (žiadnu mládež)', '16'],
    ['Malo len mládež (žiadnych dospelých)', '15'],
  ], [6470, 2600]),
  medzera(160),
  odsek('Najväčší z nich mal štyri družstvá (ŠK fan-club Púchov), ďalšie tri po troch. **Ani jeden '
    + 'veľký klub.**'),
  odsek('Obraz je jednoznačný: **odstupujú malé, staré klubíky s jedným alebo dvoma družstvami.** '
    + 'Nie sú to nové kluby, ktoré by sa po roku vzdali — dve tretiny z nich hrali deväť a viac sezón. '
    + 'A nie sú to kluby, ktoré by niesli mládežnícku základňu regiónu.'),

  H2('Kategórie, v ktorých mali družstvo'),
  tabulka(['Sezóna', 'Prípravka', 'Žiaci', 'Dorast', 'Dospelí'], [
    ['2015/2016', '5', '17', '19', '62'], ['2019/2020', '4', '18', '11', '64'],
    ['2021/2022', '11', '27', '8', '66'], ['2023/2024', '15', '15', '8', '44'],
    ['2024/2025', '19', '14', '6', '32'],
    ['**2025/2026**', '**13**', '**15**', '**2**', '**27**'],
  ], [2270, 1700, 1700, 1700, 1700], true),
  medzera(160),
  odsek('**Odstupujú kluby dospelých — a aj tých je čoraz menej.** Klubov s družstvom dospelých medzi '
    + 'odstúpenými ubudlo zo 62 – 70 na 27, dorastu z 19 na 2.'),
  ...obrazok('/tmp/viz3/02-kategorie.png',
    'Graf 2 — Aké družstvá mali odstúpené kluby, keď naposledy hrali. Klub mohol mať družstvá vo viacerých kategóriách naraz.'),

  H2('História: scvrkávali sa postupne, nezmizli zrazu'),
  veta('Tá istá skupina 42 klubov, ktorá odstúpila v 2025/2026, mala v predchádzajúcich sezónach:'),
  tabulka(['Sezóna', 'Hralo klubov', 'Prípravka', 'Žiaci', 'Dorast', 'Dospelí'], [
    ['2022/2023', '40', '24', '19', '2', '34'],
    ['2023/2024', '40', '19', '16', '2', '29'],
    ['2024/2025', '42', '20', '20', '4', '28'],
  ], [1870, 1840, 1340, 1340, 1340, 1340]),
  medzera(160),
  odsek('Počet družstiev dospelých v tejto skupine klesal tri sezóny pred odstúpením (34 → 29 → 28). '
    + '**Nie je to náhly odchod, je to koniec dlhého scvrkávania.**'),

  H1('3. Spoločný menovateľ'),
  odsek('**Dôvod odstúpenia v ISSF evidovaný nie je** — žiadne pole s dôvodom v dátach neexistuje. '
    + 'Čo sa dá povedať zodpovedne, je profil, a ten ukazuje na jednu vec:'),
  odsek('**Spoločný menovateľ je veľkosť, nie legislatíva.** Odstupujúci klub je malý klub s jedným '
    + 'družstvom dospelých, ktorý existoval dlho a postupne sa scvrkával. Zmeny v RaPP ani finančné '
    + 'vzťahy so SFZ toto vysvetliť nedokážu, pretože:'),
  ...[
    ['Časovanie nesedí.', 'Odstúpení je v poslednej sezóne najmenej za jedenásť rokov. Legislatívna zmena by sa musela prejaviť skokom, nie historickým minimom.'],
    ['Zásah je nerovnomerný a dlhodobý.', 'Jedenásť rokov odstupujú prakticky výlučne kluby dospelých. Ak by príčinou boli podmienky nastavené centrálne, zasiahlo by to aj mládež — a tá naopak rastie.'],
    ['Mládežnícke družstvá pribúdajú.', 'Prípraviek je dnes 1 712 oproti 163 v sezóne 2014/2015, žiakov 1 611 oproti 1 316. Dorast klesol na 706 v 2022/2023 a odvtedy rastie na 803. Jediná kategória s nepretržitým poklesom sú dospelí: 1 788 → 1 320 družstiev.'],
    ['Poplatky za delegované osoby v mládeži platí SFZ.', 'Klub si platí len súťaže dospelých — presne tú kategóriu, ktorá ubúda, a tú, kde náklady na klub zostávajú.'],
  ].map(([nadpis, text], i) => p([
    t((i + 1) + '. ', { bold: true, color: MODRA }), t(nadpis + ' ', { bold: true }), t(text),
  ], { spacing: { after: 120, line: 276 }, indent: { left: 280, hanging: 280 } })),
  citat('Odstupujú malé kluby s jedným družstvom dospelých, ktoré existovali deväť a viac sezón '
    + 'a tri sezóny pred odchodom sa scvrkávali. Mládežnícke družstvá pritom pribúdajú — prípraviek '
    + 'je dnes desaťnásobok stavu z roku 2014.'),
  ...obrazok('/tmp/viz3/03-druzstva.png',
    'Graf 3 — Družstvá v súťažiach po vekových kategóriách, 2014/2015 – 2025/2026.'),

  H1('4. Kde odstúpené kluby naposledy hrali'),
  odsek('Rozloženie odstúpených klubov podľa zväzu, v ktorom klub odohral svoju poslednú sezónu, je '
    + 'v samostatnej infografike na konci dokumentu (**Príloha A**). Zväzy s najväčším počtom '
    + 'odstúpených klubov za celé obdobie:'),
  tabulka(['Zväz', 'Spolu 2015/2016 – 2025/2026', 'Z toho 2025/2026'], [
    ['ObFZ Prievidza', '37', '2'], ['ObFZ Michalovce', '34', '3'],
    ['ObFZ Trebišov', '34', '3'], ['ObFZ Trnava', '32', '1'],
    ['ObFZ Nitra', '28', '0'], ['ObFZ Humenné', '25', '0'],
    ['ObFZ Levice', '24', '1'], ['ObFZ Rožňava', '23', '0'],
  ], [4070, 3000, 2000]),
  medzera(160),
  odsek('**Ako čítať zväz.** Je to zväz, v ktorého súťažiach klub odohral najviac zápasov v poslednej '
    + 'sezóne. Pri malom klube s jediným družstvom dospelých je to priamo zväz, kde hrali dospelí; pri '
    + 'klube s mládežou v celoštátnej alebo regionálnej súťaži to môže byť zväz tejto mládežníckej '
    + 'súťaže. Presné priradenie súťaže dospelých ku zväzu si vyžaduje prístup do ISSF databázy — '
    + 'publikované dáta ho nenesú.'),

  H1('Čo treba vedieť, skôr než tieto čísla niekto použije'),
  ...[
    ['Dôvod odstúpenia v dátach nie je.', 'Profil klubov je fakt, výklad príčin je náš úsudok. Ak máme rozhodnutia ŠTK alebo evidenciu záväzkov, dá sa to k tomu priložiť a vyhodnotiť kvantitatívne — bez toho zostáva pri profile.'],
    ['Sezóna 2025/2026 ešte nie je uzavretá z hľadiska návratov.', 'Zo 42 klubov sa časť vráti; podľa histórie približne pätina. Definitívne číslo zánikov za túto sezónu budeme vedieť po 2027/2028.'],
    ['Prebiehajúca sezóna 2026/2027 sa vykazuje len ako rozbeh.', 'Počet odstúpených klubov sa v rozbehnutej sezóne merať nedá. Bez odohraného zápasu je zatiaľ 382 klubov, ale prípraviek hrá 1,9 % a žiakov 25,8 % — väčšina tých klubov len čaká na štart svojej súťaže. Toto číslo sa nedá použiť ako počet odstúpených klubov a treba naň dávať pozor — je to presne to číslo, ktoré by rétoriku o hromadnom odhlasovaní zdanlivo potvrdilo. Pravidlo je zapísané v docs/metodika.md.'],
    ['Kluby vo viacerých kategóriách sa počítajú viackrát.', 'Klub s prípravkou aj dospelými je v oboch stĺpcoch. Súčet stĺpcov preto nie je počet klubov.'],
    ['135 klubo-sezón má vekovú kategóriu „NEZNÁMA“', 'a do rozpadu po kategóriách nevstupuje (rovnako U20 a U21, ktoré do štyroch skúmaných kategórií nepatria).'],
  ].map(([nadpis, text]) => p([
    t('▪  ', { color: CERV, bold: true }), t(nadpis + ' ', { bold: true }), t(text),
  ], { spacing: { after: 120, line: 276 }, indent: { left: 280, hanging: 280 } })),
];

// ── príloha A na ležato ────────────────────────────────────────────────────────────
const priloha = [
  p(t('Príloha A — Odstúpené kluby po sezónach a zväzoch', { bold: true, size: 30, color: INK }),
    { heading: HeadingLevel.HEADING_1, spacing: { after: 160 } }),
  p(new ImageRun({ type: 'png', data: fs.readFileSync('/tmp/art/odstupene-kluby-zvazy-infografika.png'),
    transformation: { width: 745, height: Math.round(745 * 1500 / 2200) } }),
    { spacing: { after: 100 }, alignment: AlignmentType.CENTER }),
  p(t('Číslo v políčku je počet klubov, ktoré v danej sezóne odstúpili a naposledy hrali v súťažiach '
    + 'daného zväzu. Zväz = ten, v ktorého súťažiach klub odohral najviac zápasov v poslednej sezóne. '
    + 'Sezóna 2026/2027 je uvedená len ako rozbeh, nie ako počet odstúpených klubov. Zdroj: ISSF.', { size: 17, color: MUT, italics: true }),
    { alignment: AlignmentType.CENTER }),
];

const patka = (text, tabPos) => new Footer({
  children: [p([t(text, { size: 16, color: MUT }),
    t('\t', { size: 16, color: MUT }),
    t('Strana ', { size: 16, color: MUT }),
    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUT }),
    t(' z ', { size: 16, color: MUT }),
    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUT })],
    { spacing: { before: 100 },
      tabStops: [{ type: TabStopType.RIGHT, position: tabPos }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 8 } } })],
});

const doc = new Document({
  creator: 'Slovenský futbalový zväz',
  title: 'Odstúpené kluby — čo hovoria dáta',
  description: 'Podklad na argumentáciu, 19. 8. 2026. Dáta z prepočtu 19. 8. 2026 vrátane rozbehu sezóny 2026/2027. Zdroj ISSF, statistika.futbalsfz.sk',
  styles: { default: { document: { run: { font: 'Calibri', size: 21, color: INK } } } },
  sections: [
    {
      properties: { page: { margin: { top: 1200, right: 1200, bottom: 1100, left: 1200 } } },
      footers: { default: patka('Odstúpené kluby — čo hovoria dáta · statistika.futbalsfz.sk', 9506) },
      children: telo,
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69),
            orientation: PageOrientation.LANDSCAPE },
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      footers: { default: patka('Príloha A · statistika.futbalsfz.sk', 15034) },
      children: priloha,
    },
  ],
});

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync('/tmp/art/Odstupene-kluby-analyza.docx', b);
  console.log('OK', b.length, 'bajtov');
});
