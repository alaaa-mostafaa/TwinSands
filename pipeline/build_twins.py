"""Twin Score: rank Earth windows against Mars and Moon reference sites.

Input (credited, not copied code): the processed, openly licensed measurements
published by the Terrestrial Analog Finder project (Space Apps 2026):
  data/processed/locations.json    terrain features from Copernicus DEM GLO-30,
                                   LOLA south-polar DTMs and CTX DTMs (12 km windows, 30 m grid)
  data/processed/environment.json  ECOSTRESS/VIIRS thermal inertia, EMIT minerals,
                                   MGS TES thermal inertia, LRO Diviner ice stability

Method (ours; deliberately simple so it can be explained in one breath)
  For each axis we measure how far an Earth window is from the target, then
  express that distance as a percentile among all Earth windows:
      closeness = 100 * (share of Earth windows that are farther away)
  So "Relief 96" means: this window's relief is closer to the target's than
  96 % of the 469 Earth windows we measured. Axes:
    relief, typical slope, steep slopes, roughness, hypsometry   (DEM geometry, same 30 m grid)
    thermal inertia  (percentile within its own world, then compared)
    minerals         (share of the target's published key minerals that EMIT sees in the window)
  Twin Score = mean closeness over all seven axes. An axis we could not measure
  for a pair counts as 50 (the expected closeness when nothing is known), so a
  window neither wins nor loses by missing data; we always show which axes were
  measured. It is a ranking aid, not a probability.

Answer key: the USGS-listed analogs (Atacama, Haughton, Death Valley, ...) are
ranked like any other window; we report where they land.

Run:  .venv/bin/python pipeline/build_twins.py [path/to/terrestrial-analog-finder]
"""
from __future__ import annotations

import json
import math
import shutil
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "terrestrial-analog-finder-main"
PROC = SRC / "data" / "processed"
OUT = ROOT / "public" / "data"
HS_OUT = ROOT / "public" / "hillshade"

TERRAIN = {  # key -> (label, transform)
    "local_relief_m": ("Relief", "log"),
    "slope_median_deg": ("Typical slope", "id"),
    "slope_p90_deg": ("Steep slopes", "id"),
    "roughness_rms_m": ("Roughness", "log"),
    "hypsometric_integral": ("Hypsometry", "id"),
}

# Key minerals reported for each Mars target in the literature, mapped to EMIT classes.
# Sources: Christensen et al. 2000 (JGR) & Squyres et al. 2004 (Science) for Meridiani;
# Vaniman et al. 2014, Rampe et al. 2020 for Gale; Horgan et al. 2020, Tice et al. 2022 for Jezero;
# Liu et al. 2022 (Nature Astronomy) for Zhurong / southern Utopia.
TARGET_MINERALS = {
    "mars-meridiani": {"hematite": ["hematite", "goethite"], "sulfate": ["gypsum", "other_sulfate"]},
    "mars-gale": {"clay": ["smectite", "kaolinite", "illite_muscovite", "chlorite", "vermiculite"],
                  "hematite": ["hematite", "goethite"], "sulfate": ["gypsum", "other_sulfate"]},
    "mars-jezero": {"carbonate": ["calcite", "dolomite", "other_carbonate"],
                    "clay": ["smectite", "kaolinite", "illite_muscovite", "chlorite", "vermiculite"]},
    "mars-utopia-zhurong": {"sulfate": ["gypsum", "other_sulfate"]},
}
MIN_CLASS_SHARE = 0.10   # a class counts as present if >= 10 % of identified pixels
MIN_IDENTIFIED = 0.002   # and EMIT identified at least 0.2 % of the window

ANSWER_KEY = ["earth-atacama-yungay", "earth-haughton", "earth-death-valley", "earth-mdrs-hanksville",
              "earth-dry-valleys", "earth-meteor-crater", "earth-craters-of-the-moon", "earth-mauna-kea"]


def tf(v, kind):
    if v is None or not math.isfinite(v):
        return None
    return math.log10(v + 1.0) if kind == "log" else float(v)


def closeness(dists: np.ndarray) -> np.ndarray:
    """100 * share of other windows that are strictly farther away (NaN stays NaN)."""
    out = np.full(dists.shape, np.nan)
    ok = ~np.isnan(dists)
    v = dists[ok]
    if v.size:
        order = np.sort(v)
        farther = v.size - np.searchsorted(order, v, side="right")
        out[ok] = 100.0 * farther / max(v.size - 1, 1)
    return out


def minerals_of(env):
    a = (env or {}).get("attributes", {})
    present, cover = {}, 0.0
    for g in ("mineral_group1", "mineral_group2"):
        idf = a.get(f"{g}_identified_area_fraction")
        fr = a.get(f"{g}_class_fractions") or {}
        if idf is None:
            continue
        cover = max(cover, idf)
        if idf < MIN_IDENTIFIED:
            continue
        for k, v in fr.items():
            if v >= MIN_CLASS_SHARE:
                present[k] = max(present.get(k, 0), round(v, 3))
    if not a.get("mineral_swath_coverage_fraction"):
        return None
    return {"present": present, "identified_fraction": round(cover, 4),
            "swath_coverage": a.get("mineral_swath_coverage_fraction")}


def main():
    locs = json.loads((PROC / "locations.json").read_text())["locations"]
    env = json.loads((PROC / "environment.json").read_text())["locations"]
    targets = [l for l in locs if l["kind"] == "target" and l["status"] == "ok"]
    earth = [l for l in locs if l["body"] == "earth" and l["status"] == "ok"]
    print(len(targets), "targets,", len(earth), "earth windows")

    def ti(l):
        return ((env.get(l["id"]) or {}).get("values") or {}).get("thermal_inertia_percentile")

    E = {k: np.array([tf(e["features"].get(k), t) if e["features"].get(k) is not None else np.nan
                      for e in earth], float) for k, (_, t) in TERRAIN.items()}
    E_ti = np.array([ti(e) if ti(e) is not None else np.nan for e in earth], float)
    E_min = [minerals_of(env.get(e["id"])) for e in earth]

    rankings, answer = {}, {}
    for t in targets:
        axes = {}
        for k, (label, kind) in TERRAIN.items():
            tv = tf(t["features"].get(k), kind)
            axes[label] = closeness(np.abs(E[k] - tv)) if tv is not None else np.full(len(earth), np.nan)
        tti = ti(t)
        axes["Thermal inertia"] = (100 - np.abs(E_ti - tti)) if tti is not None else np.full(len(earth), np.nan)
        groups = TARGET_MINERALS.get(t["id"])
        mvals = np.full(len(earth), np.nan)
        if groups:
            for i, m in enumerate(E_min):
                if m is None:
                    continue
                hit = sum(1 for cls in groups.values() if any(c in m["present"] for c in cls))
                mvals[i] = 100.0 * hit / len(groups)
        axes["Minerals"] = mvals

        M = np.vstack(list(axes.values()))
        terrain_ok = ~np.isnan(M[:5]).any(axis=0)
        n_axes = (~np.isnan(M)).sum(axis=0)
        # Missing thermal/mineral axes count as 50: the expected closeness when we know nothing,
        # so a window can neither win nor lose by lacking data.
        score = np.where(terrain_ok, np.where(np.isnan(M), 50.0, M).mean(axis=0), np.nan)
        order = [i for i in np.argsort(-np.nan_to_num(score, nan=-1)) if terrain_ok[i]]
        rank_of = {earth[i]["id"]: r + 1 for r, i in enumerate(order)}
        top = []
        for i in order[:40]:
            top.append({"id": earth[i]["id"], "score": round(float(score[i]), 1), "n_axes": int(n_axes[i]),
                        "axes": {k: (None if np.isnan(v[i]) else round(float(v[i]), 1)) for k, v in axes.items()}})
        rankings[t["id"]] = {"pool": len(order), "top": top}
        answer[t["id"]] = {aid: rank_of.get(aid) for aid in ANSWER_KEY}
        # full axis record for answer-key sites, so the radar can show them too
        for aid in ANSWER_KEY:
            if aid in rank_of and not any(x["id"] == aid for x in top):
                i = next(j for j, e in enumerate(earth) if e["id"] == aid)
                rankings[t["id"]].setdefault("extra", []).append(
                    {"id": aid, "score": round(float(score[i]), 1), "n_axes": int(n_axes[i]),
                     "axes": {k: (None if np.isnan(v[i]) else round(float(v[i]), 1)) for k, v in axes.items()}})

    used = {x["id"] for r in rankings.values() for x in r["top"] + r.get("extra", [])}
    used |= {t["id"] for t in targets}
    HS_OUT.mkdir(parents=True, exist_ok=True)
    for i in used:
        p = PROC / "hillshade" / f"{i}.png"
        if p.exists():
            shutil.copy(p, HS_OUT / p.name)

    def site(l):
        e = env.get(l["id"]) or {}
        return {"id": l["id"], "body": l["body"], "kind": l["kind"], "name": l["name"], "region": l.get("region"),
                "lat": round(l["lat"], 4), "lon": round(l["lon"], 4), "coordinate_status": l.get("coordinate_status"),
                "features": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in l["features"].items()},
                "slope_hist": [round(x, 4) for x in l["slope_hist"][:40]],
                "elevation_m": l.get("absolute_elevation_median_m"),
                "ti_percentile": ti(l), "ti_tiu": (e.get("attributes") or {}).get("thermal_inertia_median_tiu")
                                                   or (e.get("values") or {}).get("apparent_thermal_inertia"),
                "minerals": minerals_of(e) if l["body"] == "earth" else None,
                "lunar": {k: v for k, v in (e.get("attributes") or {}).items() if k.startswith("lunar_")} or None,
                "hillshade": f"hillshade/{l['id']}.webp" if (HS_OUT / f"{l['id']}.png").exists() or (HS_OUT / f"{l['id']}.webp").exists() else None}

    out = {
        "method": __doc__.split("Run:")[0].strip(),
        "source": "Terrestrial Analog Finder processed measurements (Space Apps 2026), built "
                  + json.loads((PROC / "manifest.json").read_text()).get("built_at", "?"),
        "axes": [v[0] for v in TERRAIN.values()] + ["Thermal inertia", "Minerals"],
        "unmeasured_axes": ["Dust", "Ice", "Sunlight"],
        "target_minerals": TARGET_MINERALS,
        "targets": [site(t) for t in targets],
        "earth": [site(e) for e in earth if e["id"] in used or e["kind"] == "earth_named"],
        "earth_all": [[e["id"], round(e["lat"], 3), round(e["lon"], 3), e.get("region")] for e in earth],
        # EMIT iron oxides (hematite + goethite share of identified pixels) wherever EMIT saw the window
        "earth_iron": [[round(e["lat"], 3), round(e["lon"], 3),
                        round(max(m["present"].get("hematite", 0), m["present"].get("goethite", 0)), 3), e["name"]]
                       for e, m in zip(earth, E_min) if m is not None],
        "rankings": rankings,
        "answer_key": answer,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "twins.json").write_text(json.dumps(out, separators=(",", ":")))
    print("wrote twins.json", round((OUT / "twins.json").stat().st_size / 1e3), "kB;", len(used), "hillshades")
    for tid, a in answer.items():
        print(f"  {tid:28s}", {k.replace('earth-', ''): v for k, v in a.items()})
    for tid, r in rankings.items():
        print(f"  {tid:28s} top3:", [(x['id'], x['score'], x['n_axes']) for x in r['top'][:3]])


if __name__ == "__main__":
    main()
