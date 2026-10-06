import type { DistrictPop, Facility, Filters } from '@/types/dashboard';

const MISSING = /^(?:n\/?a|none|null|unknown|not available|not provided|not specified|call for details|-)$/i;

export function isKnownValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !MISSING.test(value.trim());
}

export function costCategory(cost: unknown): 'Free' | 'Paid' | 'Unknown' {
  if (!isKnownValue(cost)) return 'Unknown';
  const text = cost.trim();
  if (/\bfree\b/i.test(text) && !/\b(?:not free|free and paid|free or paid)\b/i.test(text)) return 'Free';
  return /\d/.test(text) || /\bpaid\b/i.test(text) ? 'Paid' : 'Unknown';
}

export const COST_BRACKETS = ['Free', '1–99 BDT', '100–499 BDT', '500–999 BDT', '1000+ BDT', 'Variable / package', 'Unknown'] as const;

export function parseCostBracket(cost: unknown): string {
  const category = costCategory(cost);
  if (category !== 'Paid') return isKnownValue(cost) && /\bpackage\b/i.test(cost) ? 'Variable / package' : category;
  const text = String(cost).replace(/(?<=\d),(?=\d{3}\b)/g, '');
  const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  // Different tariffs and billing periods cannot be combined into a visit price.
  if (numbers.length !== 1 || /monthly|month|package|family|couple/i.test(text)) return 'Variable / package';
  const price = numbers[0];
  if (price === 0) return 'Free';
  return price < 100 ? '1–99 BDT' : price < 500 ? '100–499 BDT' : price < 1000 ? '500–999 BDT' : '1000+ BDT';
}

export function matchesFacilitySearch(facility: Facility, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || [facility.facility_name, facility.DIS_NAME, facility.DIV_NAME, facility.facility_type, facility.ownership, facility.services_provided]
    .some(value => (value || '').toLowerCase().includes(q));
}

export function matchesFacilityFilters(f: Facility, filters: Filters): boolean {
  const matches = (values: string[], value: string | undefined) => !values.length || values.includes(value || '');
  return matches(filters.facilityTypes, f.facility_type)
    && matches(filters.ownership, f.ownership)
    && matches(filters.origin, f.origin)
    && matches(filters.category, f.category_adult_child_both)
    && matches(filters.appointmentRequired, f.appointment_required)
    && (!filters.cost.length || filters.cost.some(value => value === f.cost || value === costCategory(f.cost)))
    && (!filters.services.length || filters.services.some(service => (f.services_provided || '').includes(service)))
    && matchesFacilitySearch(f, filters.searchQuery);
}

export function enrichDistricts(districts: DistrictPop[], facilities: Facility[]): DistrictPop[] {
  const counts = new Map<string, number>();
  facilities.forEach(f => counts.set(f.DIS_CODE, (counts.get(f.DIS_CODE) || 0) + 1));
  return districts.map(d => {
    const count = counts.get(d.DIS_CODE) || 0;
    return {
      ...d,
      total_facilities: count,
      facilitiesPer100k: d.Population > 0 ? count / d.Population * 100000 : null,
      populationPerFacility: count > 0 ? d.Population / count : null,
      householdsPerFacility: count > 0 ? d.Total_households / count : null,
    };
  });
}

export function matchesDistrictFilters(d: DistrictPop, filters: Filters, selectedDistrict: string | null): boolean {
  const inRange = (value: number, range: [number, number]) => value >= range[0] && value <= range[1];
  return (!filters.divisions.length || filters.divisions.includes(d.DIV_CODE))
    && (!filters.districts.length || filters.districts.includes(d.DIS_CODE))
    && (!selectedDistrict || d.DIS_CODE === selectedDistrict)
    && inRange(d['Poverty Index'], filters.povertyRange)
    && inRange(d.Literacy_rate, filters.literacyRange)
    && inRange(d.Urban_percent, filters.urbanRange)
    && inRange(d.Population, filters.populationRange)
    && inRange(d.total_facilities, filters.facilitiesRange);
}

export function coverageTier(value: number) {
  if (value <= 0.08) return { label: 'Very low density', tier: 0 };
  if (value <= 0.18) return { label: 'Low density', tier: 1 };
  if (value <= 0.3) return { label: 'Medium density', tier: 2 };
  return { label: 'Higher density', tier: 3 };
}

export function relativeDifference(a: number, b: number) {
  const direction = a > b ? 'higher' as const : a < b ? 'lower' as const : 'same' as const;
  return { direction, pct: b === 0 && a !== 0 ? null : b === 0 ? 0 : Math.abs((a - b) / b * 100) };
}

export const DATA_NOTICE = 'Directory-derived records, not a verified service census. Zero indexed facilities may reflect directory gaps. Density bands are descriptive, not validated adequacy thresholds. Population and subgroup fields require source reconciliation. A child-development-centre record with a Cumilla address and Chattogram coordinates requires verification; source records have been retained.';
