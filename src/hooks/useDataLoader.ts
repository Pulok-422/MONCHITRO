import { enrichDistricts } from '@/lib/dashboardData';
import { useState, useEffect, useCallback } from 'react';
import type { DistrictPop, Facility, DistrictGeoJSON } from '@/types/dashboard';

interface DashboardData {
  districts: DistrictPop[];
  facilities: Facility[];
  geojson: DistrictGeoJSON | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDataLoader(): DashboardData {
  const [districts, setDistricts] = useState<DistrictPop[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [geojson, setGeojson] = useState<DistrictGeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchJson = async (url: string) => {
      const cacheBustedUrl = `${url}?v=${Date.now()}`;

      const r = await fetch(cacheBustedUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      if (!r.ok) throw new Error(`Failed to load ${url} (${r.status})`);
      return r.json();
    };

    Promise.all([
      fetchJson(`${import.meta.env.BASE_URL}data/districts_pop.json`),
      fetchJson(`${import.meta.env.BASE_URL}data/facilities.json`),
      fetchJson(`${import.meta.env.BASE_URL}data/district.geojson`),
    ])
      .then(([d, f, g]) => {
        if (cancelled) return;

        if (!Array.isArray(d) || !Array.isArray(f) || g?.type !== 'FeatureCollection' || !Array.isArray(g.features)) {
          throw new Error('Invalid dashboard data format');
        }
        const enriched = enrichDistricts(d as DistrictPop[], f as Facility[]);

        setDistricts(enriched);
        setFacilities(f as Facility[]);
        setGeojson(g);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load dashboard data');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { districts, facilities, geojson, loading, error, reload };
}
