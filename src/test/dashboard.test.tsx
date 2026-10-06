import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import districtsJson from '../../public/data/districts_pop.json';
import facilitiesJson from '../../public/data/facilities.json';
import type { DistrictPop, Facility } from '@/types/dashboard';
import { useFilters } from '@/hooks/useFilters';
import { costCategory, enrichDistricts, parseCostBracket, relativeDifference, matchesFacilitySearch } from '@/lib/dashboardData';
import { computeReport } from '@/lib/reportData';
import { facilityCompleteness } from '@/lib/dataCompleteness';
import { toCsv } from '@/lib/csvExport';
import Feedback from '@/pages/Feedback';

const facilities = facilitiesJson as Facility[];
const districts = enrichDistricts(districtsJson as DistrictPop[], facilities);
const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
const initialHook = (url: string) => renderHook(() => useFilters(districts, facilities), {
  wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('dashboard data and filters', () => {
  it('keeps all six Barishal districts and the full population denominator', () => {
    const { result } = initialHook('/?div=BD10');
    expect(result.current.activeDistricts).toHaveLength(6);
    expect(result.current.activeFacilities).toHaveLength(14);
    const population = result.current.activeDistricts.reduce((sum, d) => sum + d.Population, 0);
    expect(14 / population * 100000).toBeCloseTo(0.1541, 4);
  });
  it('recognizes all 46 explicitly free facilities', () => {
    const { result } = initialHook('/?c=Free');
    expect(result.current.activeFacilities).toHaveLength(46);
    expect(result.current.activeDistricts.reduce((sum, d) => sum + d.total_facilities, 0)).toBe(46);
    expect(costCategory('Free of cost.')).toBe('Free');
    expect(costCategory('Call for Details')).toBe('Unknown');
  });
  it('recomputes filtered district totals and keeps the national geography', () => {
    const { result } = initialHook('/?d=BD3026&o=Private');
    expect(result.current.activeFacilities).toHaveLength(67);
    expect(result.current.activeDistricts[0].total_facilities).toBe(67);
    expect(result.current.nationalDistricts).toHaveLength(64);
    expect(result.current.nationalDistricts.reduce((sum, d) => sum + d.total_facilities, 0)).toBe(248);
  });
  it('retains zero-indexed districts and represents division by zero as unavailable', () => {
    const code = districts.find(d => d.DIS_NAME === 'Bandarban')!.DIS_CODE;
    const { result } = initialHook(`/?sel=${code}`);
    expect(result.current.activeDistricts).toHaveLength(1);
    expect(result.current.activeFacilities).toHaveLength(0);
    expect(result.current.activeDistricts[0].populationPerFacility).toBeNull();
    expect(computeReport(result.current.activeDistricts, [], facilities, 'Bandarban').hasData).toBe(true);
  });
  it('keeps sequential changes made in one event and restores URL values', () => {
    const { result } = initialHook('/');
    act(() => {
      result.current.updateFilter('ownership', ['Private']);
      result.current.updateFilter('cost', ['Free']);
      result.current.updateMapDisplay('showHeatmap', true);
    });
    expect(result.current.filters.ownership).toEqual(['Private']);
    expect(result.current.filters.cost).toEqual(['Free']);
    expect(result.current.mapDisplay.showHeatmap).toBe(true);
    const restored = initialHook('/?s=%5B%22Service%2C%20one%22%5D&pr=10,40&map=%7B%22showHeatmap%22%3Atrue%7D');
    expect(restored.result.current.filters.services).toEqual(['Service, one']);
    expect(restored.result.current.filters.povertyRange).toEqual([10, 40]);
    expect(restored.result.current.mapDisplay.showHeatmap).toBe(true);
  });
  it('searches names, districts, and types with the same rules', () => {
    const { result } = initialHook('/?q=Psychiatric%20Service');
    expect(result.current.activeFacilities.length).toBeGreaterThan(0);
    expect(result.current.activeFacilities.every(f => matchesFacilitySearch(f, 'Psychiatric Service'))).toBe(true);
  });
  it('does not count placeholders as complete or fabricate single prices from ranges', () => {
    expect(facilityCompleteness({ facility_name: 'Clinic', cost: 'Call for Details', website: 'N/A' } as Facility)).toBe(1);
    expect(parseCostBracket('Tk. 800–1000 per visit')).toBe('Variable / package');
    expect(parseCostBracket('Tk. 16,500 monthly')).toBe('Variable / package');
    expect(parseCostBracket('Tk. 700')).toBe('500–999 BDT');
    expect(relativeDifference(5, 0)).toEqual({ direction: 'higher', pct: null });
  });
  it('uses matching report thresholds, separates unknown costs, and avoids zero-result NaNs', () => {
    const report = computeReport(districts, facilities, facilities, 'All Bangladesh');
    expect(report.freeCount).toBe(46);
    expect(report.unknownCostCount).toBe(facilities.filter(f => costCategory(f.cost) === 'Unknown').length);
    expect(report.unknownCostCount).toBeGreaterThanOrEqual(145);
    expect(report.criticalCount).toBe(31);
    expect(report.findings[0]).toContain('at most 0.08');
    const empty = computeReport([districts.find(d => d.total_facilities === 0)!], [], facilities, 'Zero indexed district');
    expect(empty.freePct).toBe('0');
    expect(empty.privPct).toBe('0');
    expect(empty.findings.join(' ')).not.toMatch(/NaN|Infinity|undefined/);
  });
  it('escapes CSV formulas and retains commas and quotation marks', () => {
    const csv = toCsv([{ name: '=1+1', phone: '+880123', note: 'a,"b"' }], [{ key: 'name' }, { key: 'phone' }, { key: 'note' }]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+880123");
    expect(csv).toContain('"a,""b"""');
  });
});

describe('feedback acknowledgement', () => {
  it('rejects HTTP failures and shows success only for a server acknowledgement', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('PointerEvent', MouseEvent);
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
    render(<Feedback />, { wrapper });
    fireEvent.click(screen.getByRole('combobox', { name: 'Select your role' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Researcher' }));
    fireEvent.click(screen.getByRole('radio', { name: '4 star — Easy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('not confirmed'));
    expect(screen.queryByText('Thank you for your feedback')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    expect(await screen.findByText('Thank you for your feedback')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
