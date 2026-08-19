import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { Demografia } from '../lib/data';
import { fmt, endYear, ageLevel } from '../lib/format';
import { GROUPS, GROUP_COLOR, PALETTE, ROLA_LABEL, ROLY_PORADIE, skupinaKategorie } from '../lib/palette';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface Props {
  demo: Demografia;
  /**
   * Posledná KOMPLETNÁ sezóna ("RRRR/RRRR"). Sezóny za ňou ešte bežia — čísla sa
   * v nich dopĺňajú a nižšia hodnota nie je pokles. Označujú sa zosvetleným pásmom
   * v trende, prerušovanou sparklinou a poznámkou pri rozpade sezóny.
   */
  poslednaKompletna?: string;
}

const U_LEVELS = ['ADULTS', 'U19', 'U18', 'U17', 'U16', 'U15', 'U14', 'U13', 'U12', 'U11', 'U10', 'U09', 'U08', 'U07'];

type Pohlavie = 'VSETCI' | 'M' | 'F';
const POHLAVIE_LABEL: Record<Pohlavie, string> = { VSETCI: 'Všetci', M: 'Muži', F: 'Ženy' };

/** Farba U-úrovne podľa skupiny, do ktorej patrí. */
function farbaUrovne(lvl: string): string {
  const g = skupinaKategorie(lvl);
  return g ? GROUP_COLOR[g] : '#5b6470';
}

/** Kompletná demografická sekcia: trend + legenda + rozpad + small multiples rolí. */
export default function DemografiaSekcia({ demo, poslednaKompletna }: Props) {
  const lineEl = useRef<HTMLDivElement>(null);
  const lineChart = useRef<echarts.ECharts | null>(null);
  const [rola, setRola] = useState('hraci');
  const [pohlavie, setPohlavie] = useState<Pohlavie>('VSETCI');
  const [sel, setSel] = useState<string[]>(GROUPS.map((g) => g.key));

  const sezony = useMemo(() => Object.keys(demo.sezony).sort(), [demo]);
  const posledna = sezony[sezony.length - 1];

  /** Index prvej prebiehajúcej sezóny; === sezony.length keď všetky sú kompletné. */
  const prebiehaOd = useMemo(() => {
    if (!poslednaKompletna) return sezony.length;
    const i = sezony.indexOf(poslednaKompletna);
    return i < 0 ? sezony.length : i + 1;
  }, [sezony, poslednaKompletna]);
  const prebieha = prebiehaOd < sezony.length;
  const prebiehajuce = sezony.slice(prebiehaOd);
  const dostupneRoly = ROLY_PORADIE.filter((r) => sezony.some((s) => (demo.sezony[s]?.[r]?.osoby ?? 0) > 0));

  const jeSkupina = (k: string) => GROUPS.some((g) => g.key === k);
  const farbaSerie = (k: string, i: number) => (jeSkupina(k) ? GROUP_COLOR[k] : farbaUrovne(k) ?? PALETTE[i % PALETTE.length]);

  function hodnota(sezona: string, key: string): number {
    const r = demo.sezony[sezona]?.[rola];
    if (!r) return 0;
    const ey = endYear(sezona);
    let sum = 0;
    for (const [yr, pg] of Object.entries(r.roky)) {
      const lvl = ageLevel(ey - parseInt(yr, 10));
      const zhoda = jeSkupina(key) ? skupinaKategorie(lvl) === key : lvl === key;
      if (!zhoda) continue;
      sum += pohlavie === 'VSETCI' ? (pg.M ?? 0) + (pg.F ?? 0) + (pg.N ?? 0) : (pg[pohlavie] ?? 0);
    }
    return sum;
  }

  /** Celkový počet osôb roly v sezóne — pri filtri pohlavia súčet z rokov narodenia. */
  function osobyRoly(sezona: string, r: string): number {
    const zaznam = demo.sezony[sezona]?.[r];
    if (!zaznam) return 0;
    if (pohlavie === 'VSETCI') return zaznam.osoby ?? 0;
    let sum = 0;
    for (const pg of Object.values(zaznam.roky)) sum += pg[pohlavie] ?? 0;
    return sum;
  }

  // trend graf
  useEffect(() => {
    if (!lineEl.current) return;
    if (!lineChart.current) lineChart.current = echarts.init(lineEl.current, undefined, { renderer: 'canvas' });
    const series = sel.map((key, i) => ({
      name: key,
      type: 'line' as const,
      smooth: false,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { width: 2.5 },
      itemStyle: { color: farbaSerie(key, i) },
      data: sezony.map((s) => hodnota(s, key)),
    }));
    // Prebiehajúca sezóna: zosvetlené pásmo na konci osi. Čísla sa v nej ešte
    // dopĺňajú, preto sa posledný bod nesmie čítať ako medziročný pokles.
    if (prebieha && series.length) {
      (series[0] as Record<string, unknown>).markArea = {
        silent: true,
        itemStyle: { color: 'rgba(108,113,120,0.09)' },
        label: {
          show: true,
          position: 'insideTop',
          color: '#6c7178',
          fontSize: 10,
          fontWeight: 700,
          formatter: 'prebieha',
        },
        data: [[{ xAxis: sezony[prebiehaOd - 1] }, { xAxis: sezony[sezony.length - 1] }]],
      };
    }
    lineChart.current.setOption(
      {
        tooltip: { trigger: 'axis', confine: true },
        grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
        xAxis: { type: 'category', data: sezony, axisLabel: { fontSize: 10, rotate: 45, color: '#6c7178' }, axisLine: { lineStyle: { color: '#e7e9ec' } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eceef1' } }, axisLabel: { color: '#6c7178' } },
        series,
      },
      true,
    );
    const ro = new ResizeObserver(() => lineChart.current?.resize());
    ro.observe(lineEl.current);
    return () => ro.disconnect();
  }, [sel, rola, pohlavie, sezony, prebieha, prebiehaOd]);

  function toggle(key: string) {
    setSel((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }
  const vsetkyAktivne = sel.length === GROUPS.length && GROUPS.every((g) => sel.includes(g.key));

  // legenda s poslednou hodnotou
  const legenda = sel.map((k, i) => ({ key: k, farba: farbaSerie(k, i), hodnota: hodnota(posledna, k) }));

  // rozpad poslednej sezóny
  const rozpad = sel.map((k, i) => ({ key: k, farba: farbaSerie(k, i), hodnota: hodnota(posledna, k) }));
  const rozpadMax = Math.max(1, ...rozpad.map((r) => r.hodnota));
  const rozpadSpolu = rozpad.reduce((s, r) => s + r.hodnota, 0);

  // small multiples rolí — trend osôb roly cez sezóny (sparkline)
  const rolaTrend = (r: string) => sezony.map((s) => osobyRoly(s, r));
  /** Body sparkliny ako pole — aby sa prebiehajúci úsek dal vykresliť prerušovane. */
  function sparkPts(vals: number[]): string[] {
    const mn = Math.min(...vals), mx = Math.max(...vals);
    return vals.map((v, i) => {
      const x = (i / (vals.length - 1 || 1)) * 100;
      const y = 26 - ((v - mn) / (mx - mn || 1)) * 22 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
  }

  const rolaPill = (aktiv: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    borderRadius: 18,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    border: aktiv ? 'none' : '1px solid #dcdfe4',
    background: aktiv ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: aktiv ? '#fff' : 'var(--color-ink)',
  });

  function ciaraPill(key: string, i: number) {
    const aktiv = sel.includes(key);
    const farba = farbaSerie(key, i);
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggle(key)}
        style={{
          padding: '4px 12px',
          borderRadius: 16,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
          border: `1px solid ${aktiv ? farba : '#dcdfe4'}`,
          background: aktiv ? farba : 'var(--color-card)',
          color: aktiv ? '#fff' : farba,
        }}
      >
        {key === 'ADULTS' ? 'ADULTS' : key}
      </button>
    );
  }

  const rolaNazov = ROLA_LABEL[rola] ?? rola;

  return (
    <div>
      {/* karta trend */}
      <section className="border border-line" style={{ background: 'var(--color-card)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-sfz-blue)' }}>
          {sezony.length}-ročný trend · vekové úrovne
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0 2px' }}>Osoby vo futbale na Slovensku</h2>
        <p style={{ fontSize: 13.5, color: 'var(--color-muted)', marginBottom: 12 }}>
          Každá vybraná kategória či veková úroveň je samostatná čiara. Osoby podľa veku (rok narodenia), súčet {demo.zvaz === 'sr' ? '43 zväzov' : 'zväzu'}.
          {' '}Zobrazené: <b style={{ color: 'var(--color-ink)' }}>{rolaNazov}</b>
          {pohlavie !== 'VSETCI' && <> · <b style={{ color: 'var(--color-ink)' }}>{POHLAVIE_LABEL[pohlavie]}</b></>}.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {dostupneRoly.map((r) => (
            <button key={r} type="button" style={rolaPill(rola === r)} onClick={() => setRola(r)}>
              {ROLA_LABEL[r]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--color-muted)', marginRight: 2 }}>Pohlavie:</span>
          {(['VSETCI', 'M', 'F'] as Pohlavie[]).map((g) => (
            <button
              key={g}
              type="button"
              style={{ ...rolaPill(pohlavie === g), fontSize: 12.5, padding: '4px 12px' }}
              onClick={() => setPohlavie(g)}
            >
              {POHLAVIE_LABEL[g]}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 6 }}>Zobraz čiary podľa kategórií a vekových úrovní:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          <button
            type="button"
            onClick={() => setSel(GROUPS.map((g) => g.key))}
            style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: vsetkyAktivne ? 'none' : '1px solid #dcdfe4',
              background: vsetkyAktivne ? 'var(--color-sfz-blue)' : 'var(--color-card)',
              color: vsetkyAktivne ? '#fff' : 'var(--color-sfz-blue)',
            }}
          >
            Kategórie (všetky)
          </button>
          {GROUPS.map((g, i) => ciaraPill(g.key, i))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {U_LEVELS.map((u, i) => ciaraPill(u, i + 10))}
        </div>

        <div ref={lineEl} style={{ width: '100%', height: 360 }} role="img" aria-label="Trend demografie" />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
          {legenda.map((l) => (
            <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: l.farba, display: 'inline-block' }} />
              {l.key === 'ADULTS' ? 'ADULTS' : l.key} <b className="tnum">{fmt(l.hodnota)}</b>
            </span>
          ))}
        </div>

        {prebieha && (
          <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 8 }}>
            Zosvetlený úsek vpravo {prebiehajuce.length > 1 ? 'sú sezóny' : 'je sezóna'}{' '}
            <b style={{ color: 'var(--color-ink)' }}>{prebiehajuce.join(', ')}</b> — {prebiehajuce.length > 1 ? 'ešte bežia' : 'ešte beží'}.
            Mládežnícke súťaže sa v nej len rozbiehajú, čísla budú rásť a pokles na konci čiary nie je pokles v skutočnosti.
            Posledná kompletná sezóna je <b style={{ color: 'var(--color-ink)' }}>{poslednaKompletna}</b>.
          </p>
        )}
      </section>

      {/* karta rozpad aktuálnej sezóny */}
      <section className="border border-line" style={{ background: 'var(--color-card)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-card)', marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-sfz-blue)' }}>
          {prebieha ? 'Prebiehajúca sezóna' : 'Aktuálna sezóna'} · {posledna}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 2px' }}>
          {rolaNazov} podľa vybraných úrovní{pohlavie !== 'VSETCI' ? ` — ${POHLAVIE_LABEL[pohlavie].toLowerCase()}` : ''}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--color-muted)', marginBottom: prebieha ? 8 : 14 }}>Rozpad poslednej sezóny pre vybrané čiary. Podiel z vybraných.</p>
        {prebieha && (
          <p
            style={{
              fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 14, padding: '8px 12px',
              borderRadius: 10, background: 'rgba(108,113,120,0.08)', border: '1px solid var(--color-line)',
            }}
          >
            <b style={{ color: 'var(--color-ink)' }}>Sezóna ešte beží — čísla nie sú úplné.</b>{' '}
            Mládežnícke súťaže sa rozbiehajú neskôr než dospelé a časť kôl je ešte neodohraná, takže
            mládežnícke kategórie sú zatiaľ podreprezentované. S poslednou kompletnou sezónou
            ({poslednaKompletna}) sa tento rozpad porovnávať nedá.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rozpad.map((r) => (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: r.farba }}>{r.key === 'ADULTS' ? 'ADULTS' : r.key}</span>
              <span style={{ height: 12, borderRadius: 6, background: 'var(--color-track)' }}>
                <span style={{ display: 'block', height: '100%', width: `${(r.hodnota / rozpadMax) * 100}%`, borderRadius: 6, background: r.farba, transition: 'width .3s' }} />
              </span>
              <span className="tnum" style={{ fontSize: 12.5, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                <b style={{ color: 'var(--color-ink)' }}>{fmt(r.hodnota)}</b> · {rozpadSpolu ? Math.round((r.hodnota / rozpadSpolu) * 100) : 0} %
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* small multiples rolí */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginTop: 16 }}>
        {dostupneRoly.map((r) => {
          const trend = rolaTrend(r);
          const aktiv = r === rola;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRola(r)}
              className="border"
              style={{
                textAlign: 'left', cursor: 'pointer', borderRadius: 16, padding: 16,
                background: 'var(--color-card)', boxShadow: 'var(--shadow-card)',
                borderColor: aktiv ? 'var(--color-sfz-blue)' : 'var(--color-line)',
                borderWidth: aktiv ? 2 : 1, borderStyle: 'solid',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>{ROLA_LABEL[r]}</div>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{fmt(trend[trend.length - 1] ?? 0)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--color-muted)', marginTop: 1 }}>
                {posledna}
                {prebieha && ' · prebieha'}
              </div>
              <svg viewBox="0 0 100 26" preserveAspectRatio="none" style={{ width: '100%', height: 28, marginTop: 6 }}>
                {(() => {
                  const pts = sparkPts(trend);
                  const farba = aktiv ? 'var(--color-sfz-blue)' : '#9aa0a6';
                  if (!prebieha) {
                    return <polyline points={pts.join(' ')} fill="none" stroke={farba} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
                  }
                  return (
                    <>
                      <polyline points={pts.slice(0, prebiehaOd).join(' ')} fill="none" stroke={farba} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
                      <polyline
                        points={pts.slice(prebiehaOd - 1).join(' ')}
                        fill="none"
                        stroke={farba}
                        strokeWidth={1.6}
                        strokeDasharray="3 2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  );
                })()}
              </svg>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 10 }}>
        Veková úroveň je odvodená z roku narodenia (vek k záveru sezóny) — proxy, keďže historická súťažná kategória osôb nie je dostupná.
        {pohlavie === 'VSETCI'
          ? ' „Všetci“ = súčet mužov, žien aj osôb s neuvedeným pohlavím.'
          : ' Pri filtri pohlavia sú započítané len osoby s vyplneným pohlavím aj rokom narodenia, preto súčet mužov a žien môže byť nižší než celkový počet.'}
      </p>
    </div>
  );
}
