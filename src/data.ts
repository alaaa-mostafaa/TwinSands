import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<unknown>>();

export function useJSON<T>(url: string): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    if (!url) return;
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); }));
    (cache.get(url) as Promise<T>).then((d) => live && setV(d)).catch(() => live && setV(null));
    return () => { live = false; };
  }, [url]);
  return v;
}

export type Site = {
  id: string; body: 'earth' | 'mars' | 'moon'; kind: string; name: string; region?: string | null;
  lat: number; lon: number; coordinate_status?: string;
  features: Record<string, number>; slope_hist: number[]; elevation_m?: number;
  ti_percentile?: number | null; ti_tiu?: number | null;
  minerals?: { present: Record<string, number>; identified_fraction: number; swath_coverage: number } | null;
  lunar?: Record<string, number> | null; hillshade?: string | null;
};
export type Ranked = { id: string; score: number; n_axes: number; axes: Record<string, number | null> };
export type Twins = {
  method: string; source: string; axes: string[]; unmeasured_axes: string[];
  target_minerals: Record<string, Record<string, string[]>>;
  targets: Site[]; earth: Site[]; earth_all: [string, number, number, string | null][];
  earth_iron: [number, number, number, string][];
  rankings: Record<string, { pool: number; top: Ranked[]; extra?: Ranked[] }>;
  answer_key: Record<string, Record<string, number | null>>;
};
export type Photos = Record<string, { nasa_id: string; title: string; center?: string; date?: string; credit?: string; description?: string; url: string; w: number; h: number }>;
export type Volcanoes = { source: string; volcanoes: [number, number, string, string, number | null, string][] };

export const useTwins = () => useJSON<Twins>('data/twins.json');
export const usePhotos = () => useJSON<Photos>('data/photos.json');

export type PhotoMeta = { title: string; author?: string; license?: string; source?: string; url: string; w?: number; h?: number };

/** NASA chapter photos + Neighborhood postcard photos, one lookup by key. */
export function useAllPhotos(): Record<string, PhotoMeta> | null {
  const a = usePhotos();
  const b = useJSON<Record<string, PhotoMeta>>('data/postcards.json');
  if (!a && !b) return null;
  const out: Record<string, PhotoMeta> = {};
  for (const [k, v] of Object.entries(a ?? {})) out[k] = { title: v.title, author: 'NASA', license: 'Public domain', source: 'NASA', url: v.url };
  return { ...out, ...(b ?? {}) };
}
