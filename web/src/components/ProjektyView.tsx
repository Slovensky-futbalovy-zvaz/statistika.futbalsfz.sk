import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { Projekt } from '../lib/data';
import { fmt } from '../lib/format';

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface Props {
  projekty: Projekt[];
}

const KICKER: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-sfz-blue)' };
const CARD: React.CSSProperties = { background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-card)' };

export default function ProjektyView({ projekty }: Props) {
  const [aktivny, setAktivny] = useState(projekty[0]?.projekt ?? '');
  const p = projekty.find((x) => x.projekt === aktivny) ?? projekty[0];
  const sezony = p ? Object.keys(p.sezony).sort() : [];
  const posledna = sezony[sezony.length - 1];

  const trendEl = useRef<HTMLDivElement>(null);
  const donutEl = useRef<HTMLDivElement>(null);
  const vekEl = useRef<HTMLDivElement>(null);
  const trendCh = useRef<echarts.ECharts | null>(null);
  const donutCh = useRef<echarts.ECharts | null>(null);
  const vekCh = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!p) return;
    const s = p.sezony[posledna];

    if (trendEl.current) {
      if (!trendCh.current) trendCh.current = echarts.init(trendEl.current, undefined, { renderer: 'canvas' });
      trendCh.current.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 8, right: 8, top: 30, bottom: 24, containLabel: true },
        xAxis: { type: 'category', data: sezony.map((x) => x.replace('20', '').replace('/20', '/')), axisLabel: { fontSize: 11, color: '#6c7178' }, axisLine: { lineStyle: { color: '#e7e9ec' } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eceef1' } }, axisLabel: { show: false } },
        series: [{ type: 'bar', data: sezony.map((x) => p.sezony[x].deti), itemStyle: { color: '#1450df', borderRadius: [6, 6, 0, 0] }, barMaxWidth: 54, label: { show: true, position: 'top', fontWeight: 700, fontSize: 13, formatter: (o: { value: number }) => fmt(o.value) } }],
      }, true);
    }

    if (donutEl.current) {
      if (!donutCh.current) donutCh.current = echarts.init(donutEl.current, undefined, { renderer: 'canvas' });
      const m = s.pohlavie.M ?? 0, f = s.pohlavie.F ?? 0;
      donutCh.current.setOption({
        tooltip: { trigger: 'item', formatter: (x: { name: string; value: number; percent: number }) => `${x.name}: <b>${fmt(x.value)}</b> (${x.percent}%)` },
        series: [{
          type: 'pie', radius: ['58%', '82%'], center: ['50%', '50%'], label: { show: false },
          data: [{ name: 'Chlapci', value: m, itemStyle: { color: '#1450df' } }, { name: 'Dievčatá', value: f, itemStyle: { color: '#ec1c24' } }],
        }],
        graphic: { type: 'text', left: 'center', top: 'center', style: { text: fmt(m + f), fontSize: 22, fontWeight: 800, fill: '#0b0a0a' } },
      }, true);
    }

    if (vekEl.current) {
      if (!vekCh.current) vekCh.current = echarts.init(vekEl.current, undefined, { renderer: 'canvas' });
      const veky = Object.keys(s.vek).sort((a, b) => +a - +b);
      vekCh.current.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0, data: ['Chlapci', 'Dievčatá'], textStyle: { fontSize: 11 } },
        grid: { left: 8, right: 8, top: 30, bottom: 20, containLabel: true },
        xAxis: { type: 'category', data: veky, axisLabel: { fontSize: 10, color: '#6c7178' }, axisLine: { lineStyle: { color: '#e7e9ec' } } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eceef1' } }, axisLabel: { show: false } },
        series: [
          { name: 'Chlapci', type: 'bar', stack: 'v', data: veky.map((v) => s.vek[v].M ?? 0), itemStyle: { color: '#1450df' } },
          { name: 'Dievčatá', type: 'bar', stack: 'v', data: veky.map((v) => s.vek[v].F ?? 0), itemStyle: { color: '#ec1c24' } },
        ],
      }, true);
    }

    const ro = new ResizeObserver(() => { trendCh.current?.resize(); donutCh.current?.resize(); vekCh.current?.resize(); });
    if (trendEl.current) ro.observe(trendEl.current);
    return () => ro.disconnect();
  }, [aktivny, p, posledna]);

  if (!p) return <p style={{ color: 'var(--color-muted)' }}>Zatiaľ nie sú dostupné žiadne projekty.</p>;

  const s = p.sezony[posledna];
  const donutM = s.pohlavie.M ?? 0, donutF = s.pohlavie.F ?? 0, donutC = donutM + donutF;

  return (
    <div>
      {/* výber projektu */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', marginBottom: 24 }}>
        {projekty.map((x) => {
          const aktiv = x.projekt === aktivny;
          const sez = Object.keys(x.sezony).sort();
          const posl = sez[sez.length - 1];
          return (
            <button key={x.projekt} type="button" onClick={() => setAktivny(x.projekt)} style={{ ...CARD, textAlign: 'left', cursor: 'pointer', borderColor: aktiv ? 'var(--color-sfz-blue)' : 'var(--color-line)', borderWidth: aktiv ? 2 : 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: aktiv ? 'var(--color-sfz-blue)' : 'var(--color-ink)' }}>{x.nazov}</div>
              <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '6px 0 10px' }}>{x.popis}</p>
              <div style={{ ...KICKER, fontSize: 10.5 }}>{sez.length} sezón · posl. {fmt(x.sezony[posl].deti)} detí</div>
            </button>
          );
        })}
      </div>

      {/* detail vybraného */}
      <h2 style={{ fontSize: 26, fontWeight: 800 }}>{p.nazov}</h2>
      <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '4px 0 18px' }}>{p.popis}</p>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {[
          { label: 'Zapojené deti', v: s.deti },
          { label: 'Školy / kluby', v: s.skoly },
          { label: 'Tímy / skupiny', v: s.timy },
        ].map((k) => (
          <div key={k.label} style={CARD}>
            <div style={{ ...KICKER, color: 'var(--color-muted)' }}>{k.label}</div>
            <div className="tnum" style={{ fontSize: 34, fontWeight: 800, marginTop: 2 }}>{fmt(k.v)}</div>
          </div>
        ))}
      </div>

      <section style={{ ...CARD, marginTop: 18 }}>
        <div style={KICKER}>Vývoj v čase</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 10px' }}>Zapojené deti podľa sezón</h3>
        <div ref={trendEl} style={{ width: '100%', height: 320 }} role="img" aria-label="Trend zapojenia" />
      </section>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', marginTop: 18 }}>
        <section style={CARD}>
          <div style={KICKER}>Pohlavie</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 10px' }}>Chlapci a dievčatá</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div ref={donutEl} style={{ width: 200, height: 170 }} role="img" aria-label="Pohlavie detí" />
            <div style={{ fontSize: 13.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#1450df', display: 'inline-block' }} />
                <b>Chlapci</b> <span className="tnum" style={{ color: 'var(--color-muted)' }}>{fmt(donutM)} · {donutC ? Math.round((donutM / donutC) * 100) : 0} %</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ec1c24', display: 'inline-block' }} />
                <b>Dievčatá</b> <span className="tnum" style={{ color: 'var(--color-muted)' }}>{fmt(donutF)} · {donutC ? Math.round((donutF / donutC) * 100) : 0} %</span>
              </div>
            </div>
          </div>
        </section>
        <section style={CARD}>
          <div style={KICKER}>Vek účastníkov · {posledna}</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 10px' }}>Rozloženie podľa veku (rokov)</h3>
          <div ref={vekEl} style={{ width: '100%', height: 260 }} role="img" aria-label="Vek účastníkov" />
        </section>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 14 }}>
        <b>Metodika:</b> deti = počet detí v súpiskách tímov (nie zápasy). Školy = unikátne školy/kluby, tímy = počet skupín. Zdroj: sportnet.online.
      </p>
    </div>
  );
}
