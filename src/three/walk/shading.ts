// Shared shading for the Explore walk: one set of uniforms (sun, sky, haze, terrain shadow) and a patch that
// teaches three's MeshStandardMaterial a few planetary tricks:
//   - terrain shadows: hills and crater walls hide the Sun (precomputed horizon texture, see horizon.ts)
//   - a shadow map that fades out at its edge instead of ending in a line
//   - aerial perspective on Mars: distant ground fades into the sky colour in that direction (not a flat fog)
//   - planet curvature: far ground drops below the horizon (1 km at 60 km on the Moon)
//   - lunar photometry: Moon dust is not Lambertian (Lommel-Seeliger + opposition surge)
//   - a procedural ground surface: pebbles, ripples, cracked bedrock plates, craters, at every scale
// Only one walk is open at a time, so the uniforms are module-level and shared by reference by every material.
import * as THREE from 'three';

const v3 = (x = 0, y = 0, z = 0) => ({ value: new THREE.Vector3(x, y, z) });
const col = (r = 0, g = 0, b = 0) => ({ value: new THREE.Color(r, g, b) });
const f = (x: number) => ({ value: x });

export const U = {
  uSun: v3(0, 1, 0),                       // unit vector toward the Sun (world)
  uTime: f(0),
  // terrain shadow: horizon margin textures (radians, > 0 = Sun hidden) for the walk map and the 120 km backdrop
  uHorizon: { value: null as THREE.Texture | null },
  uTerr: { value: new THREE.Vector4(12000, 256, 0.004, 0) },      // size m, samples, soft radius rad, 1 = present
  uHorizonFar: { value: null as THREE.Texture | null },
  uTerrFar: { value: new THREE.Vector4(120000, 200, 0.004, 0) },
  uInvTwoR: f(0),                          // 1 / (2 x planet radius): curvature drop = d^2 / 2R
  // sky (linear radiance) and aerial perspective
  uZen: col(), uHor: col(), uTau: f(0.6), uAur: f(1), uMoon: f(0),
  uFogB: f(0), uFogH: f(11000), uFogRefH: f(0),
  // ground
  uSand: col(), uDark: col(), uRock: col(), uSlab: col(), uPeb: col(),
  uPebDens: f(0.3), uRipple: f(0), uPlates: f(0), uPlateSize: f(0.9), uDarkAmt: f(0.3), uStreaks: f(0),
  // rocks
  uDust: f(0.6),
  // the Moon's opposition surge
  uSurgeB0: f(0.9), uSurgeH: f(0.06),
};

/** The sky, as a GLSL function of view direction, shared by the sky dome, the haze and the environment light.
 *  Mars: butterscotch, redder and brighter toward the horizon (more dust in the path), with a pale, slightly blue
 *  glow around the Sun because dust scatters blue light forward. Moon: black. */
export const SKY_GLSL = /* glsl */ `
vec3 skyRadiance(vec3 d) {
  if (uMoon > 0.5) return vec3(0.0);
  d = normalize(d);
  float up = max(d.y, 0.0), mu = dot(d, uSun);
  float am = 1.0 / (up + 0.035);
  float amS = 1.0 / (max(uSun.y, 0.0) + 0.035);
  vec3 c = mix(uZen, uHor, 1.0 - exp(-uTau * am * 0.22));
  float g = 0.8, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);   // Henyey-Greenstein forward peak
  vec3 aur = mix(vec3(1.0, 0.8, 0.62), vec3(0.86, 0.9, 1.0), smoothstep(4.0, 30.0, hg));
  c += aur * hg * 0.018 * uAur * (1.0 - exp(-uTau * 1.5)) * exp(-uTau * amS * 0.25);
  return c * mix(1.0, 0.75, smoothstep(0.0, -0.2, d.y));                    // below the horizon: a little darker
}
`;

/** Noise with analytic derivatives (integer hash: exact and the same on every GPU, WebGL2 only). */
const NOISE_GLSL = /* glsl */ `
uint whu(ivec2 c) { uvec2 q = uvec2(c + 65536) * uvec2(1597334673u, 3812015801u); return (q.x ^ q.y) * 1597334673u; }
float wh1(ivec2 c) { return float(whu(c)) * 2.3283064e-10; }
// value noise: (value 0..1, d/dx, d/dz) per noise unit
vec3 wnoised(vec2 x) {
  vec2 i = floor(x), fr = x - i;
  vec2 u = fr * fr * fr * (fr * (fr * 6.0 - 15.0) + 10.0), du = 30.0 * fr * fr * (fr * (fr - 2.0) + 1.0);
  ivec2 c = ivec2(i);
  float a = wh1(c), b = wh1(c + ivec2(1, 0)), d = wh1(c + ivec2(0, 1)), e = wh1(c + ivec2(1, 1));
  float k1 = b - a, k2 = d - a, k4 = a - b - d + e;
  return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}
// fractal noise in world metres, normalised to 0..1; the gradient is per metre. fp = metres per pixel:
// octaves smaller than about two pixels fade out, so nothing shimmers and there is no tiling.
vec3 wfbm(vec2 p, float freq, int oct, float fp) {
  vec3 s = vec3(0.0); float a = 0.5, done = 0.0, all = 1.0 - pow(0.5, float(oct));
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float w = 1.0 - smoothstep(0.2, 0.5, fp * freq);
    if (w <= 0.0) break;                       // this octave and all finer ones are below a pixel
    vec3 n = wnoised(p * freq + float(i) * 17.31);
    s += a * vec3(mix(0.5, n.x, w), n.yz * freq * w);
    done += a; a *= 0.5; freq *= 2.07;
  }
  s.x += 0.5 * (all - done);
  return s / all;
}
// pebbles: little domes in random cells. Returns (height m, dh/dx, dh/dz); cell = 1/freq metres.
vec3 wpebbles(vec2 p, float freq, float dens) {
  vec2 q = p * freq, i = floor(q), fr = q - i; vec3 r = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    ivec2 c = ivec2(i) + ivec2(x, y); uint h = whu(c);
    if (float(h & 255u) / 255.0 > dens) continue;
    vec2 o = vec2(float((h >> 8) & 255u), float((h >> 16) & 255u)) / 255.0;
    float rad = 0.18 + 0.3 * float(h >> 24) / 255.0;
    vec2 d = vec2(x, y) + o - fr;
    float k = 1.0 - dot(d, d) / (rad * rad);
    if (k > 0.0) { float hh = rad * sqrt(k) * 0.7; if (hh > r.x) r = vec3(hh, -0.7 * d / (rad * sqrt(max(k, 0.05))) * freq); }
  }
  r.x /= freq; return r;
}
// cells for cracked plates: (distance to nearest, gap to the second nearest = crack distance, cell id 0..1)
vec3 wvor(vec2 p) {
  vec2 i = floor(p), fr = p - i; float d1 = 9.0, d2 = 9.0; uint id = 0u;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    ivec2 c = ivec2(i) + ivec2(x, y); uint h = whu(c);
    vec2 r = vec2(x, y) + vec2(float(h & 65535u), float(h >> 16)) / 65535.0 * 0.85 - fr;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), float(id & 1023u) / 1023.0);
}
// a layer of small craters: (height m, dh/dx, dh/dz, sunlit 0..1). cell in metres; most are soft, old bowls with
// low rims. The Sun test is exact for a bowl: a point is shaded when its own crater's rim, along the line toward the
// Sun, stands higher than the Sun (at the poles a bowl is black inside except its far wall).
vec4 wcraters(vec2 p, float cell, float dens, float salt, float fp) {
  vec2 q = p / cell, i = floor(q), fr = q - i; vec4 r = vec4(0.0, 0.0, 0.0, 1.0);
  vec2 sd = normalize(uSun.xz + 1e-5); float tanS = uSun.y / max(length(uSun.xz), 1e-4);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    ivec2 c = ivec2(i) + ivec2(x, y) + ivec2(int(salt), 0); uint h = whu(c);
    if (float(h & 255u) / 255.0 > dens) continue;
    vec2 o = vec2(float((h >> 8) & 255u), float((h >> 16) & 255u)) / 255.0;
    float rad = 0.12 + 0.34 * pow(float(h >> 24) / 255.0, 2.0);
    vec2 d = vec2(x, y) + o - fr; float dl = length(d) + 1e-5, s = dl / rad;
    if (s > 1.8) continue;
    float fresh = float((h >> 4) & 15u) / 15.0;                  // most are old and shallow, a few fresh and deep
    float depth = rad * cell * (0.05 + 0.08 * fresh + 0.1 * step(0.9, fresh));
    float hh, dh;
    if (s < 1.0) { hh = depth * (s * s - 1.0); dh = depth * 2.0 * s; }
    else { hh = 0.0; dh = 0.0; }
    float e = exp(-(s - 1.0) * (s - 1.0) / 0.14);                // a low, broad rim
    hh += 0.18 * depth * e; dh += 0.18 * depth * e * (-2.0 * (s - 1.0) / 0.14);
    r.xyz += vec3(hh, -dh * d / (dl * rad * cell));
    if (s < 1.0) {
      vec2 u = -d; float b = dot(u, sd), tExit = -b + sqrt(max(b * b - (dot(u, u) - rad * rad), 0.0));
      float clear = depth * (1.0 - s * s);                          // the bowl's edge above this point
      float marg = clear / max(tExit * cell, 1e-3) - tanS;
      r.w = min(r.w, 1.0 - smoothstep(-0.03, 0.03 + fp / cell, marg));
    }
  }
  return r;
}
`;

const HEAD_GLSL = /* glsl */ `
uniform vec3 uSun; uniform float uTime;
uniform sampler2D uHorizon; uniform vec4 uTerr; uniform sampler2D uHorizonFar; uniform vec4 uTerrFar;
uniform vec3 uZen, uHor; uniform float uTau, uAur, uMoon, uFogB, uFogH, uFogRefH;
uniform vec3 uSand, uDark, uRock, uSlab, uPeb;
uniform float uPebDens, uRipple, uPlates, uPlateSize, uDarkAmt, uStreaks, uDust;
uniform float uSurgeB0, uSurgeH;
varying vec3 vTW;   // world position (before curvature)
varying vec3 vNW;   // world normal of the mesh
varying vec3 vOP;   // object-space position (rocks: dust on top, layers)
#ifdef WALK_GROUND
varying float vCav;
#endif
${SKY_GLSL}
${NOISE_GLSL}
// 1 = Sun visible over the terrain, 0 = hidden behind a hill or crater wall
float terrainSun() {
#ifdef WALK_FAR
  vec4 T = uTerrFar;
#else
  vec4 T = uTerr;
#endif
  if (T.w < 0.5) return 1.0;
  vec2 p = (vTW.xz + 0.5 * T.x) / T.x;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return 1.0;
  vec2 uv = (p * (T.y - 1.0) + 0.5) / T.y;
#ifdef WALK_FAR
  float m = texture2D(uHorizonFar, uv).r;
#else
  float m = texture2D(uHorizon, uv).r;
#endif
  return 1.0 - smoothstep(-T.z, T.z, m);
}
`;

const VERT_HEAD = /* glsl */ `
uniform float uInvTwoR;
varying vec3 vTW; varying vec3 vNW; varying vec3 vOP;
#ifdef WALK_GROUND
attribute float cav; varying float vCav;
#endif
`;
const VERT_BODY = /* glsl */ `
{
  vec4 tw = vec4(transformed, 1.0);
  vOP = transformed;
  vec3 nw = objectNormal;
#ifdef USE_INSTANCING
  tw = instanceMatrix * tw;
  nw = mat3(instanceMatrix) * nw;
#endif
  tw = modelMatrix * tw;
  vTW = tw.xyz;
  vNW = normalize(mat3(modelMatrix) * nw);
#ifdef WALK_GROUND
  vCav = cav;
#endif
#ifdef WALK_CURVE
  vec2 dc = tw.xz - cameraPosition.xz;
  transformed.y -= dot(dc, dc) * uInvTwoR;     // the ground mesh has an identity model matrix
#endif
}
`;

/** Moon dust: lunar-Lambert (McEwen 1991) with an opposition surge, replacing three's Lambert diffuse. */
const LUNAR_GLSL = /* glsl */ `
#ifdef WALK_LUNAR
void RE_Direct_Lunar(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir,
                     const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  float mu0 = saturate(dot(geometryNormal, directLight.direction));
  float mu = saturate(dot(geometryNormal, geometryViewDir));
  float ga = acos(clamp(dot(directLight.direction, geometryViewDir), -1.0, 1.0));
  float gd = degrees(ga);
  float L = clamp(1.0 - 0.019 * gd + 2.42e-4 * gd * gd - 1.46e-6 * gd * gd * gd, 0.0, 1.0);
  float fct = L * 2.0 * mu0 / (mu0 + mu + 1e-4) + (1.0 - L) * mu0;
  float B = 1.0 + uSurgeB0 / (1.0 + tan(ga * 0.5) / uSurgeH);
  reflectedLight.directDiffuse += directLight.color * BRDF_Lambert(material.diffuseColor) * fct * B / (1.0 + 0.35 * uSurgeB0);
}
#undef RE_Direct
#define RE_Direct RE_Direct_Lunar
#endif
`;

const SHADOW_FADE_GLSL = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
float getShadowFaded(sampler2D m, vec2 sz, float it, float b, float r, vec4 c) {
  vec2 uv = c.xy / c.w;
  float e = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
  return mix(getShadow(m, sz, it, b, r, c), 1.0, smoothstep(0.8, 0.97, e));
}
#endif
`;

function lightsBegin() {
  let s = THREE.ShaderChunk.lights_fragment_begin;
  const a = 'getDirectionalLightInfo( directionalLight, directLight );';
  const b = 'getShadow( directionalShadowMap[ i ]';
  if (!s.includes(a) || !s.includes(b)) throw new Error('walk shading: three lights chunk changed');
  s = s.replace(a, a + '\n\t\tdirectLight.color *= terrainSun() * wMicroSun;').replace(b, 'getShadowFaded( directionalShadowMap[ i ]');
  return s;
}

/** The ground surface: colour and fine relief, all procedural in world metres. Runs where the normal map would. */
const SURFACE_GLSL = /* glsl */ `
float wMicroSun = 1.0;          // sunlight blocked by small relief drawn by the shader (crater rims)
#ifdef WALK_GROUND
{
  vec2 P = vTW.xz;
  float fp = max(length(fwidth(P)), 1e-3);
  vec3 Nw = normalize(vNW);
  float slope = clamp(1.0 - Nw.y, 0.0, 1.0);
  vec3 big = wfbm(P, 0.0035, 3, fp);          // geology patches, ~300 m
  vec3 mid = wfbm(P + 37.0, 0.07, 3, fp);     // ~15 m
  vec3 sm = wfbm(P - 91.0, 1.3, 4, fp);       // ~1 m and below
  float cav = vCav;
  vec2 g = vec2(0.0);                          // height gradient of the fine relief (m per m)
  float pebMask = 1.0;                         // less gravel on bare rock
  float rockiness = smoothstep(0.1, 0.32, slope * 1.5 + 0.3 * (big.x - 0.5) + 0.2 * (mid.x - 0.5) - 0.2 * cav);
  vec3 alb = uSand * (0.84 + 0.32 * big.x) * (0.9 + 0.2 * mid.x) * (0.92 + 0.16 * sm.x);
  float dk = smoothstep(0.5, 0.66, 0.55 * big.x + 0.45 * mid.x + 0.12 * cav) * uDarkAmt;
  alb = mix(alb, uDark * (0.9 + 0.2 * sm.x), dk);
#ifdef WALK_STREAKS
  // Olympus: long dark wind streaks of loose sand on the bright dust
  float st = wfbm(vec2(P.x * 0.0012 + P.y * 0.0021, (P.y * 0.0012 - P.x * 0.0021) * 7.0) * 100.0, 0.01, 3, fp).x;
  alb = mix(alb, uDark, smoothstep(0.55, 0.68, st) * uStreaks);
#endif
  alb = mix(alb, uRock * (0.8 + 0.4 * sm.x), rockiness);
  alb = mix(alb, uSand * 1.08, smoothstep(0.15, 0.8, cav) * (1.0 - rockiness) * 0.5);   // fine dust settles in hollows
  g += 0.22 * mid.yz + 0.02 * sm.yz;
#ifdef WALK_PLATES
  // Bedrock pavement (Gale's Yellowknife Bay, Jezero's pavers): flat slabs broken by two sets of joints (plates ~1 m
  // inside blocks ~4 m). Each slab sits a little higher or lower than its neighbour and its edges are worn; sand and
  // gravel lie only in the cracks and the hollows. Relief comes from screen derivatives, so it stays out of branches.
  // bedrock is the rule; sand only fills winding channels and the hollows (uPlates = share of bare rock)
  float pt = mix(0.3, 0.72, uPlates);
  float sandy = 0.62 * mid.x + 0.38 * (1.0 - big.x) + 0.25 * max(cav, 0.0) + 0.08 * (sm.x - 0.5);
  float pm = (1.0 - smoothstep(pt - 0.03, pt + 0.03, sandy)) * step(0.01, uPlates) * (1.0 - smoothstep(0.35, 0.6, slope));
  vec2 Pw = P + vec2(mid.x - 0.5, mid.y * 0.0 + big.x - 0.5) * 3.0 + vec2(sm.x - 0.5, 0.5 - sm.x) * 0.25;   // wavy, jagged joints
  vec3 v = wvor(Pw / uPlateSize);
  vec3 vb = wvor(Pw / (uPlateSize * 4.3) + 7.7);
  float cw = 0.02 + 0.7 * fp / uPlateSize, cwb = 0.014 + 0.7 * fp / (uPlateSize * 4.3);
  float hair = (1.0 - smoothstep(cw * 0.5, cw, v.y)) * smoothstep(0.35, 0.6, fract(v.z * 5.3 + vb.z * 2.1));   // only some small cracks
  float joint = 1.0 - smoothstep(cwb * 0.5, cwb, vb.y);
  float crack = max(hair * 0.7, joint);
  float tone = fract(vb.z * 1.7) * 0.7 + fract(v.z * 3.1) * 0.3;
  vec3 plate = uSlab * (0.82 + 0.3 * tone) * (0.9 + 0.2 * sm.x);
  plate = mix(plate, vec3(0.7, 0.68, 0.7) * dot(uSlab, vec3(0.333)), smoothstep(0.85, 0.95, vb.z) * 0.18);   // dust-free blue-grey slabs
  plate *= 0.95 + 0.05 * sin(dot(P, vec2(0.6, 0.8)) * 38.0 + 6.0 * mid.x) * (1.0 - smoothstep(0.01, 0.04, fp));   // laminae
  float veneer = smoothstep(0.52, 0.7, wfbm(P + 71.0, 0.35, 2, fp).x) * 0.6;     // thin dust drifted onto the rock
  plate = mix(plate, uSand * 1.05, veneer);
  alb = mix(alb, mix(plate, uSand * 0.7, crack), pm);
  float Hp = pm * ((v.z - 0.5) * 0.025 + (vb.z - 0.5) * 0.09 - 0.012 * hair - 0.04 * (1.0 - smoothstep(0.0, 0.04, vb.y)));
  vec2 dpx = dFdx(P), dpy = dFdy(P);
  float hx = dFdx(Hp), hy = dFdy(Hp), det = dpx.x * dpy.y - dpx.y * dpy.x;
  vec2 gp = abs(det) > 1e-12 ? vec2(hx * dpy.y - hy * dpx.y, hy * dpx.x - hx * dpy.x) / det : vec2(0.0);
  g = mix(g, g * 0.3, pm) + clamp(gp, -1.5, 1.5) * (1.0 - smoothstep(0.03, 0.12, fp));
  pebMask = 1.0 - pm * (1.0 - veneer * 0.6) * 0.95;
#endif
#ifdef WALK_MOON
  // craters at every scale (each fades out before it gets too small to see), and "elephant hide" lineations on slopes
  float fc1 = 1.0 - smoothstep(0.08, 0.25, fp / 1.5), fc2 = 1.0 - smoothstep(0.08, 0.25, fp / 6.0), fc3 = 1.0 - smoothstep(0.08, 0.25, fp / 24.0);
  if (fc3 > 0.0) { vec4 k = wcraters(P, 24.0, 0.28, 3.0, fp); g += k.yz * fc3; wMicroSun = min(wMicroSun, mix(1.0, k.w, fc3)); }
  if (fc2 > 0.0) { vec4 k = wcraters(P, 6.0, 0.2, 7.0, fp); g += k.yz * fc2; wMicroSun = min(wMicroSun, mix(1.0, k.w, fc2)); }
  if (fc1 > 0.0) { vec4 k = wcraters(P, 1.5, 0.28, 11.0, fp); g += k.yz * fc1; wMicroSun = min(wMicroSun, mix(1.0, k.w, fc1)); }
  float eh = smoothstep(0.04, 0.18, slope) * (1.0 - smoothstep(0.5, 2.0, fp));
  if (eh > 0.0) {
    vec2 d1 = normalize(vec2(0.8, 0.6)), d2 = normalize(vec2(-0.45, 0.9));
    float w1 = 6.2831 / 11.0, w2 = 6.2831 / 8.0, wp = 4.0 * mid.x;
    g += eh * 0.12 * (cos(dot(P, d1) * w1 + wp) * d1 + 0.7 * cos(dot(P, d2) * w2 - wp) * d2);
  }
#endif
  // gravel: pebbles of 2-7 cm and granules under 2 cm, lit little domes darker than the dust (stones of 13 cm and
  // up are real 3D rocks). Far away they average into the ground colour.
  float pw = 1.0 - smoothstep(0.006, 0.04, fp), gw = 1.0 - smoothstep(0.003, 0.014, fp);
  vec3 pb = pw > 0.0 ? wpebbles(P, 14.0, uPebDens) : vec3(0.0);
  vec3 gb = gw > 0.0 ? wpebbles(P + 31.7, 34.0, uPebDens * 0.8) : vec3(0.0);
  float pk = max(smoothstep(0.0, 0.004, pb.x) * pw, smoothstep(0.0, 0.0015, gb.x) * gw * 0.8);
  g += (pb.yz * pw + gb.yz * gw) * (1.0 - rockiness * 0.5) * pebMask;
  vec3 pebCol = uPeb * (0.7 + 0.6 * fract(pb.x * 913.0 + gb.x * 2711.0));
  alb = mix(alb, pebCol, pk * 0.85 * pebMask);
  alb = mix(alb, mix(alb, uPeb, uPebDens * 0.5 * pebMask) * mix(1.0, 0.93, pebMask), (1.0 - pw) * 0.9);   // the gravel's average, with its shading
  if (uRipple > 0.0) {
    // wind ripples, crests across the wind, in sandy patches
    vec2 wd = normalize(vec2(0.8, 0.6));
    vec3 wv = wfbm(P + 13.0, 0.25, 2, fp);                        // sinuous crests that wander and fork
    vec2 wp = P + 1.1 * vec2(wv.x - 0.5, 0.0) * 2.0 + 1.6 * vec2(mid.x, 1.0 - mid.x);
    float lam = 0.65 + 0.25 * mid.x, ph = dot(wp, wd) * 6.2831 / lam;
    float aa = 1.0 - smoothstep(0.25, 0.6, fwidth(ph));         // only where a crest spans 10+ pixels: no converging "rails"
    float rm = uRipple * (1.0 - rockiness) * smoothstep(0.42, 0.62, 1.0 - 0.6 * big.x - 0.4 * mid.x + 0.3 * dk) * aa;
    g += rm * 0.035 * cos(ph + 0.5 * sin(ph)) * (1.0 + 0.5 * cos(ph)) * (6.2831 / lam) * wd;
    alb *= 1.0 + rm * 0.06 * sin(ph + 0.5 * sin(ph));
  }
  diffuseColor.rgb *= alb;
  vec3 nW = normalize(Nw + vec3(-g.x, 0.0, -g.y) * Nw.y);
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}
#endif
#ifdef WALK_ROCK
{
  // rocks: grain and a dusty top (dust settles on surfaces that face up), slightly darker at the base
  vec3 Nw = normalize(vNW);
  float fp = max(length(fwidth(vTW.xz)), 1e-3);
  vec3 n1 = wfbm(vOP.xz * 9.0 + vOP.y * 3.0, 1.0, 3, fp * 9.0);
  vec3 n2 = wfbm(vTW.xz + vTW.y * 1.7, 2.5, 3, fp);
  float cap = smoothstep(0.45, 0.85, Nw.y + 0.35 * (n2.x - 0.5)) * uDust;
  vec3 base = diffuseColor.rgb * (0.8 + 0.4 * n1.x);
  diffuseColor.rgb = mix(base, uSand * (0.9 + 0.2 * n2.x), cap);
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(-0.16, 0.04, vOP.y));   // darker where it meets the ground
  vec3 nW = normalize(Nw + vec3(n2.y, 0.0, n2.z) * 0.035 + vec3(n1.y, 0.0, n1.z) * 0.01);
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}
#endif
`;

/** Aerial perspective: light from the ground dims with distance and sky light is scattered in along the way.
 *  Exponential haze thinning with height (scale height uFogH), in linear light before tone mapping. */
const AERIAL_GLSL = /* glsl */ `
#ifdef WALK_AERIAL
{
  vec3 rel = vTW - cameraPosition;
  float dist = length(rel);
  vec3 wd = rel / max(dist, 1e-3);
  float y0 = cameraPosition.y - uFogRefH, k = wd.y * dist / uFogH;
  float od = uFogB * exp(-y0 / uFogH) * dist * (abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0);
  float T = exp(-od);
  vec3 ins = skyRadiance(normalize(vec3(wd.x, max(wd.y, 0.0) * 0.5 + 0.02, wd.z)));
  outgoingLight = outgoingLight * T + ins * (1.0 - T);
}
#endif
`;

export type PatchFlags = {
  ground?: boolean; moon?: boolean; lunar?: boolean; aerial?: boolean; curve?: boolean; far?: boolean;
  rock?: boolean; plates?: boolean; streaks?: boolean;
};

/** Patch a MeshStandardMaterial with the walk's shading. The key must be unique per flag set. */
export function patchMaterial<M extends THREE.Material>(mat: M, flags: PatchFlags): M {
  const defs = Object.entries({
    WALK_GROUND: flags.ground, WALK_MOON: flags.moon, WALK_LUNAR: flags.lunar, WALK_AERIAL: flags.aerial,
    WALK_CURVE: flags.curve, WALK_FAR: flags.far, WALK_ROCK: flags.rock,
    WALK_PLATES: flags.plates, WALK_STREAKS: flags.streaks,
  }).filter(([, on]) => on).map(([k]) => k);
  const key = 'walk:' + defs.join(',');
  const def = defs.map((d) => `#define ${d}\n`).join('');
  const LB = lightsBegin();
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = def + VERT_HEAD + s.vertexShader.replace('#include <project_vertex>', VERT_BODY + '#include <project_vertex>');
    const rep = (src: string, a: string, b: string) => { if (!src.includes(a)) throw new Error('walk shading: missing ' + a); return src.replace(a, b); };
    let fs = s.fragmentShader;
    fs = rep(fs, '#include <common>', '#include <common>\n' + HEAD_GLSL);
    fs = rep(fs, '#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + LUNAR_GLSL);
    fs = rep(fs, '#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n' + SHADOW_FADE_GLSL);
    fs = rep(fs, '#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + SURFACE_GLSL);
    fs = rep(fs, '#include <lights_fragment_begin>', LB);
    fs = rep(fs, '#include <opaque_fragment>', AERIAL_GLSL + '#include <opaque_fragment>');
    s.fragmentShader = def + fs;
  };
  mat.customProgramCacheKey = () => key;
  mat.needsUpdate = true;
  return mat;
}

/** The visible sky dome (and, with disk = false, the one baked into the environment light). */
export function makeSkyMaterial(disk: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: U as unknown as Record<string, THREE.IUniform>,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform vec3 uZen, uHor; uniform float uTau, uAur, uMoon;
      varying vec3 vP;
      ${SKY_GLSL}
      void main() {
        vec3 d = normalize(vP);
        vec3 c = skyRadiance(d);
        ${disk ? `
        float ang = length(d - uSun);                       // angle from the Sun's centre (radians, small angles)
        float r = uMoon > 0.5 ? 0.00463 : 0.00305;           // 0.53 deg from the Moon, 0.35 deg from Mars
        float ext = uMoon > 0.5 ? 1.0 : exp(-uTau / max(uSun.y + 0.035, 0.035));
        c += vec3(1.0, 0.97, 0.92) * 60.0 * ext * (1.0 - smoothstep(r * 0.85, r * 1.1, ang));
        if (uMoon > 0.5) c += vec3(1.0, 0.98, 0.95) * (0.6 * exp(-ang * 90.0) + 0.04 * exp(-ang * 12.0));   // camera glare
        ` : ''}
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Sheets of blowing dust around you in the storm: three open cylinders locked to the camera whose see-through
 *  pattern streams with the wind, so gusts seem to sweep past at 15, 35 and 80 m. */
export function makeDustSheetMaterial(speed: number, scale: number) {
  return new THREE.ShaderMaterial({
    uniforms: { ...(U as unknown as Record<string, THREE.IUniform>), uSpeed: { value: speed }, uScale: { value: scale } },
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vW; void main() { vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform vec3 uZen, uHor; uniform float uTau, uAur, uMoon, uTime, uSpeed, uScale;
      varying vec3 vP; varying vec3 vW;
      ${SKY_GLSL}
      ${NOISE_GLSL}
      void main() {
        float h = vP.y;
        // the pattern is fixed to the ground and blows downwind, so gusts sweep past rather than spin round you
        vec2 wd = normalize(vec2(0.97, 0.24)), wp = vec2(-wd.y, wd.x);
        float along = dot(vW.xz, wd) - uTime * uSpeed * 14.0, across = dot(vW.xz, wp);
        vec2 q = vec2(along / (7.0 * uScale), h / (4.0 * uScale) + across / (9.0 * uScale) + uTime * 0.05);
        float n = wfbm(q, 1.0, 4, 0.0).x;
        float m = smoothstep(0.3, 0.75, n);
        float alpha = m * 0.6 * (1.0 - smoothstep(2.0, 30.0, h)) * smoothstep(-6.0, 1.0, h);
        vec3 c = skyRadiance(normalize(vec3(vP.x, 0.04, vP.z))) * vec3(1.1, 0.95, 0.85);
        gl_FragColor = vec4(c, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
