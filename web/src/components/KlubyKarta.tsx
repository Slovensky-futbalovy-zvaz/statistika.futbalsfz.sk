/**
 * Karta „Počet klubov“ — úvodná stránka aj profil zväzu.
 *
 * Aktívny klub = klub s aspoň jedným reálne odohraným zápasom (metodika 14. 8. 2026).
 * Rozpad: len dospelí (bez mládeže) / dospelí + mládež / len mládež.
 * Na profile zväzu ide o kluby, ktoré v súťažiach TOHTO zväzu odohrali aspoň zápas —
 * klub hrajúci vo viacerých zväzoch je započítaný v každom z nich.
 */
interface Rok {
  sezona: string;
  kluby: number;
  /** Prebiehajúca sezóna — čísla sa ešte dopĺňajú, kreslí sa šrafovane. */
  prebieha?: boolean;
}

interface Props {
  kluby: number;
  klubyPredch?: number;
  lenDospeli: number;
  dospeliAMladez: number;
  lenMladez: number;
  /** Voliteľný vývoj naprieč sezónami (úvodná stránka). */
  rows?: Rok[];
  /** Text pod nadpisom — napr. „v súťažiach ObFZ Nitra“. */
  podnadpis?: string;
  /** Doplnkové číslo: kluby s domovským zväzom (len profil zväzu). */
  domaci?: number;
}

const NF = new Intl.NumberFormat('sk-SK');
const F = (n: number) => NF.format(n);

// Sezóny nábehu ISSF (rozhodnutie Ján Letko, 14. 8. 2026): 2012/2013 a 2013/2014 sú roky,
// v ktorých sa Informačný systém slovenského futbalu ešte len nasadzoval — počty klubov v nich
// nie sú úplné a nesmú sa čítať ako stav. Kreslia sa šrafovane ako prebiehajúca sezóna.
const NABEH_ISSF = new Set(['2012/2013', '2013/2014']);

const SEGMENTY = [
  { k: 'lenDospeli', label: 'Len dospelí (bez mládeže)', color: '#94a3b8' },
  { k: 'dospeliAMladez', label: 'Dospelí aj mládež', color: '#1450df' },
  { k: 'lenMladez', label: 'Len mládež', color: '#22c55e' },
] as const;

export default function KlubyKarta(p: Props) {
  const casti: Record<string, number> = {
    lenDospeli: p.lenDospeli,
    dospeliAMladez: p.dospeliAMladez,
    lenMladez: p.lenMladez,
  };
  const spolu = Math.max(1, p.lenDospeli + p.dospeliAMladez + p.lenMladez);
  const sMladezou = p.dospeliAMladez + p.lenMladez;

  const rozdiel = p.klubyPredch === undefined ? undefined : p.kluby - p.klubyPredch;
  const rastie = (rozdiel ?? 0) > 0;
  const farbaZmeny = rozdiel === undefined || rozdiel === 0 ? 'var(--color-muted)' : rastie ? '#22c55e' : '#ef4444';

  const rows = p.rows ?? [];
  const maxRow = Math.max(1, ...rows.map((r) => r.kluby));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold">Počet klubov</h2>
        {p.podnadpis && <span className="text-xs text-muted">{p.podnadpis}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="tnum font-extrabold" style={{ fontSize: 'clamp(30px,6vw,46px)', lineHeight: 1.02 }}>
            {F(p.kluby)}
          </div>
          {rozdiel !== undefined && (
            <div className="mt-1 text-xs">
              <span className="tnum font-semibold" style={{ color: farbaZmeny }}>
                {rozdiel > 0 ? '▲' : rozdiel < 0 ? '▼' : '='} {rozdiel > 0 ? '+' : ''}{F(rozdiel)}
              </span>
              <span className="text-muted"> medziročne</span>
            </div>
          )}
        </div>
        <div className="text-sm">
          <div>
            <span className="tnum font-bold">{F(sMladezou)}</span>{' '}
            <span className="text-muted">klubov s mládežou ({Math.round((100 * sMladezou) / spolu)} %)</span>
          </div>
          <div className="mt-0.5">
            <span className="tnum font-bold">{F(p.lenDospeli)}</span>{' '}
            <span className="text-muted">bez mládeže ({Math.round((100 * p.lenDospeli) / spolu)} %)</span>
          </div>
          {p.domaci !== undefined && (
            <div className="mt-0.5 text-muted">
              z toho <span className="tnum font-semibold">{F(p.domaci)}</span> má tento zväz ako domovský
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex h-3 w-full overflow-hidden" style={{ borderRadius: 999 }}>
        {SEGMENTY.map((s) => {
          const v = casti[s.k] ?? 0;
          if (!v) return null;
          return <div key={s.k} title={`${s.label}: ${F(v)}`} style={{ width: `${(100 * v) / spolu}%`, background: s.color }} />;
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {SEGMENTY.map((s) => (
          <span key={s.k} className="inline-flex items-center gap-1.5">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
            <span className="text-muted">{s.label}</span>
            <span className="tnum font-semibold">{F(casti[s.k] ?? 0)}</span>
          </span>
        ))}
      </div>

      {rows.length > 1 && (
        <div className="mt-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Vývoj po sezónach</div>
          <div className="mt-2 flex items-end gap-[3px]" style={{ height: 72 }}>
            {rows.map((r, i) => {
              const posledna = i === rows.length - 1;
              const nabeh = NABEH_ISSF.has(r.sezona);
              const farba = r.prebieha
                ? 'repeating-linear-gradient(45deg,#1450df,#1450df 3px,transparent 3px,transparent 7px)'
                : nabeh
                  ? 'repeating-linear-gradient(45deg,#cbd5e1,#cbd5e1 3px,transparent 3px,transparent 7px)'
                  : posledna || i === rows.length - 2
                    ? '#1450df'
                    : 'var(--color-line, #cbd5e1)';
              return (
                <div
                  key={r.sezona}
                  title={`${r.sezona}: ${F(r.kluby)} klubov${r.prebieha ? ' (prebiehajúca sezóna)' : nabeh ? ' (nábeh ISSF — číslo nie je úplné)' : ''}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(2, (100 * r.kluby) / maxRow)}%`,
                    background: farba,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>{rows[0]?.sezona}</span>
            <span>{rows[rows.length - 1]?.sezona}</span>
          </div>
          {(rows.some((r) => r.prebieha) || rows.some((r) => NABEH_ISSF.has(r.sezona))) && (
            <p className="mt-1.5 text-[11px] text-muted">
              Šrafované stĺpce sa nedajú čítať ako stav:{' '}
              {rows.some((r) => NABEH_ISSF.has(r.sezona)) && (
                <>2012/2013 a 2013/2014 sú roky nábehu ISSF, evidencia vtedy ešte nebola úplná</>
              )}
              {rows.some((r) => NABEH_ISSF.has(r.sezona)) && rows.some((r) => r.prebieha) && '; '}
              {rows.some((r) => r.prebieha) && (
                <>posledný stĺpec je prebiehajúca sezóna — mládežnícke súťaže sa ešte len rozbiehajú, číslo bude rásť</>
              )}
              .
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Aktívny klub = klub s aspoň jedným reálne odohraným zápasom v sezóne. Mládež znamená akúkoľvek vekovú úroveň
        okrem dospelých. Nezapočítavajú sa účastníci neregulárnych súťaží (školské a výberové turnaje) ani súťaží mimo
        riadenia slovenských zväzov. Klub hrajúci v súťažiach viacerých zväzov sa počíta v každom z nich, preto je
        súčet po zväzoch vyšší než celoslovenský počet.
      </p>
    </div>
  );
}
