import type { DistrictPop, Facility } from '@/types/dashboard';
import { costCategory, parseCostBracket } from './dashboardData';

export function fmtPop(n: number) {
  return n >= 1e6 ? (n / 1e6).toFixed(2) + 'm' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

interface DivRow {
  name: string; total: number; govt: number; priv: number;
  free: number; child: number; avgPer100k: number; districtCount: number;
}

export interface ComputedReport {
  hasData: boolean; isFiltered: boolean; scopeLabel: string; scopePct: string;
  totalFacilities: number; totalPop: number; natAvgPer100k: number;
  districtsWithFacilities: number;
  govtCount: number; govtPct: string; privCount: number; privPct: string;
  freeCount: number; freePct: string; criticalCount: number;
  walkinCount: number; walkinPct: string; apptCount: number; walkinFreeCount: number;
  unknownCostCount: number; unknownCostPct: string;
  medianPer100k: number; belowMedianCount: number;
  findings: string[];
  bottom10: DistrictPop[];
  divRows: DivRow[]; costBrackets: Record<string, number>;
  topDiv: DivRow | null; topGovtDiv: DivRow | null; topFreeDiv: DivRow | null; lowestDiv: DivRow | null;
  coveredDivisions: number;
}

/* ─── computeReport ───────────────────────────────────────────────────────── */
export function computeReport(
  sd: DistrictPop[], sf: Facility[], allF: Facility[], scopeLabel: string
): ComputedReport {
  const isFiltered = scopeLabel !== 'All Bangladesh';
  if (!sd.length) return { hasData: false, isFiltered, scopeLabel } as ComputedReport;

  const tot = sf.length;
  const pop = sd.reduce((s, d) => s + d.Population, 0);
  const avg = pop > 0 ? (tot / pop) * 100000 : 0;
  const scopePct = allF.length ? ((tot / allF.length) * 100).toFixed(0) : '0';
  const withFac = sd.filter(d => d.total_facilities > 0).length;
  const govt = sf.filter(f => f.ownership === 'Government').length;
  const gPct = (tot ? (govt / tot) * 100 : 0).toFixed(0);
  const priv = sf.filter(f => f.ownership === 'Private').length;
  const pPct = (tot ? priv / tot * 100 : 0).toFixed(0);
  const free = sf.filter(f => costCategory(f.cost) === 'Free').length;
  const fPct = (tot ? (free / tot) * 100 : 0).toFixed(0);
  const crit = sd.filter(d => (d.facilitiesPer100k || 0) <= 0.08).length;
  const walkin = sf.filter(f => f.appointment_required === 'No').length;
  const wPct = (tot ? (walkin / tot) * 100 : 0).toFixed(0);
  const appt = sf.filter(f => f.appointment_required === 'Yes').length;
  const wf = sf.filter(f => f.appointment_required === 'No' && costCategory(f.cost) === 'Free').length;
  const unk = sf.filter(f => costCategory(f.cost) === 'Unknown').length;
  const uPct = (tot ? (unk / tot) * 100 : 0).toFixed(0);

  const s100k = [...sd].map(d => d.facilitiesPer100k || 0).sort((a, b) => a - b);
  const mid = Math.floor(s100k.length / 2);
  const median = s100k.length % 2 === 0 ? (s100k[mid - 1] + s100k[mid]) / 2 : s100k[mid];
  const belowMed = sd.filter(d => (d.facilitiesPer100k || 0) < median).length;

  const bottom10 = [...sd].sort((a, b) => (a.facilitiesPer100k || 0) - (b.facilitiesPer100k || 0)).slice(0, 10);
  const worst = bottom10[0];

  const findings = [
    `${crit} of ${sd.length} district(s) have at most 0.08 indexed facilities per 100,000 people (scope average: ${avg.toFixed(2)}/100K).`,
    `${worst?.DIS_NAME} has the lowest indexed facility density — ${worst?.total_facilities} facilit${worst?.total_facilities === 1 ? 'y' : 'ies'} for ${fmtPop(worst?.Population || 0)} people (${(worst?.facilitiesPer100k || 0).toFixed(2)}/100K).`,
    `${pPct}% of facilities are recorded as private; government facilities account for ${gPct}%.`,
    `Only ${wf} facilit${wf === 1 ? 'y' : 'ies'} (${(tot ? (wf / tot) * 100 : 0).toFixed(0)}%) offer both walk-in access and free care.`,
    `A free or paid cost category cannot be confirmed for ${unk} facilit${unk === 1 ? 'y' : 'ies'} (${uPct}%), limiting patients' ability to assess affordability.`,
  ];


  const divNames = [...new Set(sd.map(d => d.DIV_NAME))];
  const divRows: DivRow[] = divNames.map(name => {
    const dd = sd.filter(d => d.DIV_NAME === name);
    const df = sf.filter(f => f.DIV_NAME === name);
    const g = df.filter(f => f.ownership === 'Government').length;
    const fr = df.filter(f => costCategory(f.cost) === 'Free').length;
    const ch = df.filter(f => (f.category_adult_child_both || '').includes('Child')).length;
    const divPop = dd.reduce((sum, d) => sum + d.Population, 0);
    const a = divPop > 0 ? df.length / divPop * 100000 : 0;
    return { name, total: df.length, govt: g, priv: df.filter(f => f.ownership === 'Private').length, free: fr, child: ch, avgPer100k: a, districtCount: dd.length };
  }).sort((a, b) => b.total - a.total);

  const brackets = ['Free', '1–99 BDT', '100–499 BDT', '500–999 BDT', '1000+ BDT', 'Variable / package', 'Unknown'];
  const costBrackets: Record<string, number> = {};
  brackets.forEach(b => { costBrackets[b] = 0; });
  sf.forEach(f => { const b = parseCostBracket(f.cost); costBrackets[b] = (costBrackets[b] || 0) + 1; });

  const covDiv = divRows.filter(r => r.total > 0).length;
  const topDiv = divRows.find(row => row.total > 0) ?? null;
  const coveredRows = divRows.filter(r => r.total > 0);
  const topGovtDiv = coveredRows.length ? [...coveredRows].sort((a, b) => (b.govt / b.total) - (a.govt / a.total))[0] : null;
  const topFreeDiv = coveredRows.length ? [...coveredRows].sort((a, b) => (b.free / b.total) - (a.free / a.total))[0] : null;
  const lowestDiv = divRows.length ? [...divRows].sort((a, b) => a.avgPer100k - b.avgPer100k)[0] : null;

  return {
    hasData: true, isFiltered, scopeLabel, scopePct,
    totalFacilities: tot, totalPop: pop, natAvgPer100k: avg, districtsWithFacilities: withFac,
    govtCount: govt, govtPct: gPct, privCount: priv, privPct: pPct,
    freeCount: free, freePct: fPct, criticalCount: crit,
    walkinCount: walkin, walkinPct: wPct, apptCount: appt, walkinFreeCount: wf,
    unknownCostCount: unk, unknownCostPct: uPct,
    medianPer100k: median, belowMedianCount: belowMed,
    findings, bottom10, divRows, costBrackets,
    coveredDivisions: covDiv, topDiv, topGovtDiv, topFreeDiv, lowestDiv,
  };
}

