import { useMemo, useState } from 'react';
import { fmt, fmt1 } from '../lib/format';
import { UROVEN_LABEL } from '../lib/palette';

interface Props {
  /**
   * Riadky zbalené do reťazca — jeden na sezónu a rez, polia oddelené `|`:
   * `sezona|rez|median|priemer×100|p25|p75|n|doU21×1000|nad35×1000`
   *
   * `rez` je prázdny pre celok, `L:<kod>` pre úroveň ligy a `S:<názov>` pre konkrétnu
   * súťaž. Pri kluboch príde názov súťaže bez prefixu (spätná kompatibilita).
   */
  rows: string;
  poslednaKompletna: string;
  /** Popis celku v prepínači — napr. „Všetky súťaže“ alebo „Celý zväz“. */
  labelCelok?: string;
}

interface Bod {
  sezona: string; rez: string; median: number; priemer: number;
  p25: number; p75: number; n: number; u21: number; nad35: number;
}

/**
 * Vek hráčov klubu v súťažiach dospelých naprieč sezónami.
 *
 * Hlavné číslo je medián (rozhodnutie Ján Letko) — priemer je citlivý na to, že
 * kategória dospelých siaha od pätnástich rokov po sedemdesiat. Pásmo okolo čiary
 * je rozsah medzi 25. a 75. percentilom, teda kde leží stredná polovica hráčov;
 * z neho vidno nielen posun stredu, ale aj či sa káder rozťahuje alebo zužuje.
 */
export default function VekKlubu({ rows, poslednaKompletna, labelCelok = 'Všetky súťaže' }: Props) {
  const [rez, setRez] = useState('');

  const { body, urovne, sutaze, sezony } = useMemo(() => {
    const b: Bod[] = (rows ? rows.split('\n') : []).map((r) => {
      const p = r.split('|');
      return {
        sezona: p[0], rez: p[1], median: Number(p[2]), priemer: Number(p[3]) / 100,
        p25: Number(p[4]), p75: Number(p[5]), n: Number(p[6]),
        u21: Number(p[7]) / 1000, nad35: Number(p[8]) / 1000,
      };
    });
    const vsetky = [...new Set(b.map((x) => x.rez))].filter(Boolean);
    return {
      body: b,
      urovne: vsetky.filter((r) => r.startsWith('L:')).sort(),
      // súťaže: s prefixom `S:` (zväz) aj bez prefixu (klub — spätná kompatibilita)
      sutaze: vsetky.filter((r) => !r.startsWith('L:')).sort(),
      sezony: [...new Set(b.map((x) => x.sezona))].sort(),
    };
  }, [rows]);

  /** Popis rezu do prepínača: `L:L7` → „7. liga“, `S:Názov` → „Názov“. */
  const popisRezu = (r: string) =>
    r.startsWith('L:') ? (UROVEN_LABEL[r.slice(2)] ?? r.slice(2)) : r.replace(/^S:/, '');

  const vybrane = useMemo(
    () => sezony.map((s) => body.find((x) => x.sezona === s && x.rez === rez) ?? null),
    [body, sezony, rez],
  );

  const { min, max } = useMemo(() => {
    let lo = 99;
    let hi = 0;
    for (const b of vybrane) {
      if (!b) continue;
      lo = Math.min(lo, b.p25);
      hi = Math.max(hi, b.p75);
    }
    return lo > hi ? { min: 15, max: 40 } : { min: Math.floor(lo - 1), max: Math.ceil(hi + 1) };
  }, [vybrane]);

  const n = sezony.length;
  const prebiehaOd = useMemo(() => {
    const i = sezony.indexOf(poslednaKompletna);
    return i < 0 ? n : i + 1;
  }, [sezony, poslednaKompletna, n]);

  const W = 820;
  const L = 34;
  const R = 12;
  const T = 8;
  const H = 200;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - min) / Math.max(1, max - min)) * H;

  const posledny = [...vybrane].reverse().find((b) => b && sezony.indexOf(b.sezona) < prebiehaOd) ?? null;

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 13, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    border: active ? 'none' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  if (!body.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
        Klub nemá v súťažiach dospelých dosť zápisov na výpočet (potrebných je aspoň 100 za sezónu).
      </p>
    );
  }

  // plocha medzi p25 a p75 (len súvislé úseky s dátami)
  const plocha = (() => {
    const hore: string[] = [];
    const dole: string[] = [];
    vybrane.forEach((b, i) => {
      if (!b) return;
      hore.push(`${x(i)},${y(b.p75)}`);
      dole.unshift(`${x(i)},${y(b.p25)}`);
    });
    return hore.length > 1 ? `M${hore.join(' L')} L${dole.join(' L')} Z` : '';
  })();

  const ciara = (od: number, doIdx: number) => {
    let d = '';
    for (let i = Math.max(0, od); i <= doIdx && i < n; i++) {
      const b = vybrane[i];
      if (!b) continue;
      d += (d ? ' L' : 'M') + x(i) + ',' + y(b.median);
    }
    return d;
  };

  return (
    <div>
      {(urovne.length > 0 || sutaze.length > 0) && (
        <div style={{ marginBottom: 12, fontSize: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            <span style={{ color: 'var(--color-muted)' }}>Rez:</span>
            <button type="button" style={chip(rez === '')} onClick={() => setRez('')}>{labelCelok}</button>
            {urovne.map((r) => (
              <button key={r} type="button" style={chip(rez === r)} onClick={() => setRez(r)}>
                {popisRezu(r)}
              </button>
            ))}
          </div>
          {sutaze.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginTop: 6 }}>
              <span style={{ color: 'var(--color-muted)' }}>Súťaže:</span>
              {sutaze.map((r) => (
                <button key={r} type="button" style={chip(rez === r)} onClick={() => setRez(r)}>
                  {popisRezu(r)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {posledny && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {posledny.median}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>medián veku · {posledny.sezona}</div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.8 }}>
            priemer <b style={{ color: 'var(--color-ink)' }}>{fmt1(posledny.priemer)}</b> ·
            stredná polovica <b style={{ color: 'var(--color-ink)' }}>{posledny.p25}–{posledny.p75}</b> ·
            do 21 rokov <b style={{ color: 'var(--color-ink)' }}>{Math.round(posledny.u21 * 100)} %</b> ·
            35 a viac <b style={{ color: 'var(--color-ink)' }}>{Math.round(posledny.nad35 * 100)} %</b> ·
            <b style={{ color: 'var(--color-ink)' }}> {fmt(posledny.n)}</b> zápisov
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${T + H + 26}`} style={{ display: 'block', width: '100%', height: 'auto' }} role="img">
        {Array.from({ length: max - min + 1 }, (_, k) => min + k)
          .filter((v) => (v - min) % Math.max(1, Math.ceil((max - min) / 5)) === 0)
          .map((v) => (
            <g key={v}>
              <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="#eef0f3" />
              <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--color-muted)">{v}</text>
            </g>
          ))}
        {plocha && <path d={plocha} fill="var(--color-sfz-blue)" opacity={0.13} />}
        <path d={ciara(0, prebiehaOd - 1)} fill="none" stroke="var(--color-sfz-blue)" strokeWidth={2.4} strokeLinejoin="round" />
        {prebiehaOd < n && (
          <path d={ciara(prebiehaOd - 1, n - 1)} fill="none" stroke="var(--color-sfz-blue)" strokeWidth={2.4} strokeDasharray="4 3" opacity={0.6} />
        )}
        {vybrane.map((b, i) =>
          b ? (
            <circle key={b.sezona} cx={x(i)} cy={y(b.median)} r={2.8} fill="var(--color-sfz-blue)"
                    opacity={i >= prebiehaOd ? 0.6 : 1}>
              <title>{`${b.sezona}: medián ${b.median}, stredná polovica ${b.p25}–${b.p75} (${fmt(b.n)} zápisov)`}</title>
            </circle>
          ) : null,
        )}
        {sezony.map((s, i) =>
          i % 2 ? null : (
            <text key={s} x={x(i)} y={T + H + 15} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
              {s.slice(2, 4)}/{s.slice(7)}
            </text>
          ),
        )}
      </svg>

      <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        Čiara je medián vekovej úrovne osoby, svetlé pásmo je rozsah medzi 25. a 75. percentilom —
        kde leží stredná polovica hráčov. Jednotkou je jeden zápis hráča v jednom zápase, takže opora
        váži viac než jednorazová výpomoc. Prerušovaný úsek je prebiehajúca sezóna. Sezóny s menej
        než 100 zápismi sa nezobrazujú.
      </p>
    </div>
  );
}
