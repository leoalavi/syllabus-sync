import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUILDING_PIXEL_OFFSET_X, buildings, MAP_CONFIG } from '../features/map/lib/buildings.ts';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const syllabusRoot = path.resolve(__dirname, '..');
const flutterRoot = path.resolve(syllabusRoot, '../mq_navigation');

const flutterDataDir = path.join(flutterRoot, 'assets', 'data');
const flutterMapsDir = path.join(flutterRoot, 'assets', 'maps');
const outputBuildingsPath = path.join(flutterDataDir, 'buildings.json');
const outputOverlayMetaPath = path.join(flutterDataDir, 'campus_overlay_meta.json');
const outputAliasPath = path.join(flutterDataDir, 'building_aliases.json');
const geospatialCalibrationPath = path.join(
  syllabusRoot,
  'features',
  'map',
  'lib',
  'geospatialCalibration.ts',
);
const sourceOverlayPath = path.join(syllabusRoot, 'public', 'maps', 'raster', 'mq-campus.png');
const outputOverlayPath = path.join(flutterMapsDir, 'mq-campus.png');

function invert3x3(matrix) {
  const det =
    matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[2][1] * matrix[1][2]) -
    matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
    matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);

  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const invDet = 1 / det;
  const inverse = Array.from({ length: 3 }, () => Array(3).fill(0));

  inverse[0][0] = (matrix[1][1] * matrix[2][2] - matrix[2][1] * matrix[1][2]) * invDet;
  inverse[0][1] = (matrix[0][2] * matrix[2][1] - matrix[0][1] * matrix[2][2]) * invDet;
  inverse[0][2] = (matrix[0][1] * matrix[1][2] - matrix[0][2] * matrix[1][1]) * invDet;
  inverse[1][0] = (matrix[1][2] * matrix[2][0] - matrix[1][0] * matrix[2][2]) * invDet;
  inverse[1][1] = (matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0]) * invDet;
  inverse[1][2] = (matrix[1][0] * matrix[0][2] - matrix[0][0] * matrix[1][2]) * invDet;
  inverse[2][0] = (matrix[1][0] * matrix[2][1] - matrix[2][0] * matrix[1][1]) * invDet;
  inverse[2][1] = (matrix[2][0] * matrix[0][1] - matrix[0][0] * matrix[2][1]) * invDet;
  inverse[2][2] = (matrix[0][0] * matrix[1][1] - matrix[1][0] * matrix[0][1]) * invDet;

  return inverse;
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function solveMultipleRegression(inputs, outputs) {
  const xtx = Array.from({ length: 3 }, () => Array(3).fill(0));
  const xty = Array(3).fill(0);

  for (let i = 0; i < inputs.length; i += 1) {
    const row = inputs[i];
    for (let j = 0; j < 3; j += 1) {
      xty[j] += row[j] * outputs[i];
      for (let k = 0; k < 3; k += 1) {
        xtx[j][k] += row[j] * row[k];
      }
    }
  }

  const inverse = invert3x3(xtx);
  return inverse ? multiplyMatrixVector(inverse, xty) : null;
}

async function loadGroundControlPoints() {
  const source = await readFile(geospatialCalibrationPath, 'utf8');
  const match = source.match(/export const GROUND_CONTROL_POINTS:[^=]*=\s*(\[[\s\S]*?\n\]);/);
  if (!match) {
    throw new Error('Unable to locate GROUND_CONTROL_POINTS in geospatialCalibration.ts');
  }

  return Function(`"use strict"; return (${match[1]});`)();
}

function computeAffineCoefficients(gcps) {
  if (gcps.length < 3) {
    throw new Error('Need at least 3 GCPs for affine transformation');
  }

  const lats = gcps.map((gcp) => gcp.gps.lat);
  const lngs = gcps.map((gcp) => gcp.gps.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const normalize = (value, min, max) => (value - min) / (max - min);

  const inputs = gcps.map((gcp) => [
    1,
    normalize(gcp.gps.lng, minLng, maxLng),
    normalize(gcp.gps.lat, minLat, maxLat),
  ]);

  const xParams = solveMultipleRegression(
    inputs,
    gcps.map((gcp) => gcp.pixel[0]),
  );
  const yParams = solveMultipleRegression(
    inputs,
    gcps.map((gcp) => gcp.pixel[1]),
  );

  if (!xParams || !yParams) {
    throw new Error('Failed to solve affine coefficients from GCP dataset');
  }

  return {
    x: xParams,
    y: yParams,
    normalization: { minLat, maxLat, minLng, maxLng },
  };
}

const affineCoefficients = computeAffineCoefficients(await loadGroundControlPoints());

const normalizedBuildings = buildings.map((building) => ({
  id: building.id,
  code: building.id,
  name: building.name,
  description: building.description ?? null,
  address: building.address ?? null,
  category: building.category ?? 'other',
  latitude: building.location?.lat ?? null,
  longitude: building.location?.lng ?? null,
  entranceLatitude: building.entranceLocation?.lat ?? null,
  entranceLongitude: building.entranceLocation?.lng ?? null,
  googlePlaceId: building.googlePlaceId ?? null,
  campusX: building.position?.[0] ?? null,
  campusY: building.position?.[1] ?? null,
  aliases: building.aliases ?? [],
  tags: building.tags ?? [],
  searchTokens: building.searchTokens ?? [],
  gridRef: building.gridRef ?? null,
  levels: building.levels ?? null,
  wheelchair: building.wheelchair ?? false,
}));

const campusOverlayMeta = {
  imageAsset: 'assets/maps/mq-campus.png',
  width: MAP_CONFIG.width,
  height: MAP_CONFIG.height,
  pixelBounds: {
    south: 0,
    west: 0,
    north: MAP_CONFIG.height,
    east: MAP_CONFIG.width,
  },
  pixelOffsetX: BUILDING_PIXEL_OFFSET_X,
  buildingPixelOffsetX: BUILDING_PIXEL_OFFSET_X,
  gpsBounds: MAP_CONFIG.bounds,
  initialFitPadding: 20,
  minZoomOffset: 1.5,
  maxZoom: 3,
  gpsProjection: {
    method: 'gcp_affine',
    affine: affineCoefficients,
  },
};

await mkdir(flutterDataDir, { recursive: true });
await mkdir(flutterMapsDir, { recursive: true });

// ---------------------------------------------------------------------------
// Merge, don't overwrite.
//
// Campus Navigation's buildings.json is NOT a pure build artefact any more: it
// carries records this file has no source for (bike racks, smoking areas) and
// fields this exporter does not model (facultyGroup, studentServicesGroups,
// campusHubGroups). A wholesale overwrite silently deleted 35 buildings and 3
// fields, so the export now merges onto whatever Campus Navigation already has.
//
// Identity rule: Campus Navigation owns canonical building ids. Where Syllabus
// Sync uses a different id for the same place (`1WW` for Ainsworth), that is
// recorded as an ALIAS rather than added as a second building - otherwise the
// same location would exist twice under two ids, and a deep link could land on
// either one.
// ---------------------------------------------------------------------------

/** Fields this exporter is the source of truth for. Anything else is preserved. */
const EXPORTED_FIELDS = [
  'code', 'name', 'description', 'address', 'category',
  'latitude', 'longitude', 'entranceLatitude', 'entranceLongitude',
  'googlePlaceId', 'campusX', 'campusY', 'aliases', 'tags', 'searchTokens',
  'gridRef', 'levels', 'wheelchair',
];

/** Aliases that name matching cannot infer. */
const MANUAL_ALIASES = {
  '75TR': '75TAL', BIKEHUB: 'BIKEHUBC', '11GR': 'LIGHT',
  '5GR': 'OBS', EAST2: 'PEAST2', EAST3: 'PEAST3', '25CWW': 'GALEHIST',
};

/**
 * Coordinate moves larger than this are reported rather than applied silently.
 *
 * Campus Navigation's coordinates have in places been hand-refined to a higher
 * precision than the OpenStreetMap values here, so an export can quietly drag a
 * map marker tens of metres. Surfacing the move lets a human decide which value
 * is actually right instead of discovering it on the map.
 */
const COORD_WARN_METRES = 10;

const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Whether to push this file's field values onto buildings Campus Navigation
 * already has.
 *
 * Off by default. The two datasets have genuinely diverged and Campus
 * Navigation's copy is richer in places - it carries "29 Wally's Walk (Faculty
 * of Arts)" where this file has "29WW", and categorises car parks as `parking`
 * where this file says `services`, which the map filters on. Blindly exporting
 * would regress the app, so by default the export only adds what is missing
 * (aliases, new buildings, overlay, raster) and REPORTS the differences.
 *
 * Run with --apply-fields once a human has reconciled the two.
 */
const APPLY_FIELDS = process.argv.includes('--apply-fields');

let existing = [];
try {
  existing = JSON.parse(await readFile(outputBuildingsPath, 'utf8'));
} catch {
  console.warn('No existing buildings.json - writing a fresh one.');
}
const existingById = new Map(existing.map((b) => [b.id, b]));

// Lookup over the CURRENT canonical set, for alias inference.
const canonicalIndex = new Map();
for (const b of existing) {
  for (const key of [b.name, b.address, b.code, ...(b.aliases ?? []), ...(b.searchTokens ?? [])]) {
    const k = norm(key);
    if (k && !canonicalIndex.has(k)) canonicalIndex.set(k, b.id);
  }
}

function inferCanonicalId(entry) {
  if (existingById.has(entry.id)) return entry.id;
  if (MANUAL_ALIASES[entry.id]) return MANUAL_ALIASES[entry.id];
  // Names are often "18WW (Service Connect)" - the leading code is the real id.
  const embedded = /^([0-9A-Z]{2,8})\s*\(/.exec(entry.name ?? '');
  if (embedded && existingById.has(embedded[1])) return embedded[1];
  const friendly = String(entry.name ?? '').replace(/^[0-9A-Z]{2,8}\s*\(|\)$/g, '').trim();
  return canonicalIndex.get(norm(friendly)) ?? canonicalIndex.get(norm(entry.name)) ?? null;
}

const merged = new Map(existing.map((b) => [b.id, { ...b }]));
const aliases = {};
const unmatched = [];
const coordMoves = [];
const divergences = [];

for (const entry of normalizedBuildings) {
  const canonical = inferCanonicalId(entry);
  if (!canonical) {
    unmatched.push(`${entry.id} (${entry.name})`);
    continue;
  }
  if (canonical !== entry.id) {
    // An alias records that a partner id REFERS TO this building; it does not
    // mean the two records describe the same point. `CHAP` (the Chaplaincy)
    // resolves to `10HA` (10 Hadenfeld Avenue, which houses it), but merging
    // the Chaplaincy's coordinates onto the building would drag its map marker
    // 353m. So an aliased record contributes its id and nothing else.
    aliases[entry.id] = canonical;
    continue;
  }
  const target = merged.get(canonical);
  if (!target) {
    merged.set(canonical, { ...entry, id: canonical, code: canonical });
    continue;
  }
  if (
    typeof target.latitude === 'number' && typeof entry.latitude === 'number' &&
    typeof target.longitude === 'number' && typeof entry.longitude === 'number'
  ) {
    const metres = Math.hypot(
      (entry.latitude - target.latitude) * 111_000,
      (entry.longitude - target.longitude) * 93_000,
    );
    if (metres > COORD_WARN_METRES) {
      coordMoves.push(`${canonical} ${metres.toFixed(0)}m`);
    }
  }
  for (const f of EXPORTED_FIELDS) {
    const incoming = entry[f];
    // Never replace a real value with a null/empty one.
    if (incoming === null || incoming === undefined) continue;
    if (Array.isArray(incoming) && incoming.length === 0) continue;
    if (JSON.stringify(target[f]) === JSON.stringify(incoming)) continue;
    if (!APPLY_FIELDS) {
      divergences.push(
        `${canonical}.${f}: ${JSON.stringify(target[f])} -> ${JSON.stringify(incoming)}`,
      );
      continue;
    }
    target[f] = incoming;
  }
}

const mergedBuildings = [...merged.values()];
const dropped = existing.filter((b) => !merged.has(b.id));
if (dropped.length) throw new Error(`Refusing to drop ${dropped.length} buildings`);

// Preserve hand-tuned overlay values instead of silently reverting them.
let overlayOut = campusOverlayMeta;
try {
  const prev = JSON.parse(await readFile(outputOverlayMetaPath, 'utf8'));
  const diverged = ['maxZoom', 'minZoomOffset', 'initialFitPadding'].filter(
    (k) => prev[k] !== undefined && prev[k] !== campusOverlayMeta[k],
  );
  if (diverged.length) {
    overlayOut = { ...campusOverlayMeta };
    for (const k of diverged) overlayOut[k] = prev[k];
    console.warn(
      `Kept hand-tuned overlay values (${diverged
        .map((k) => `${k}=${prev[k]} not ${campusOverlayMeta[k]}`)
        .join(', ')}). Edit this exporter if the generated value is meant to win.`,
    );
  }
} catch {
  /* no previous file - use the generated values */
}

await mkdir(flutterDataDir, { recursive: true });
await mkdir(flutterMapsDir, { recursive: true });

await writeFile(outputBuildingsPath, `${JSON.stringify(mergedBuildings, null, 2)}\n`, 'utf8');
await writeFile(outputOverlayMetaPath, `${JSON.stringify(overlayOut, null, 2)}\n`, 'utf8');
await writeFile(
  outputAliasPath,
  `${JSON.stringify(
    {
      _comment:
        'Partner/legacy building-id aliases -> canonical Campus Navigation building id. ' +
        "Lets sister apps (Syllabus Sync) deep-link using the ids they already hold, " +
        "instead of duplicating this app's building identity on their side. " +
        'Canonical ids in buildings.json always win; this map is consulted only on a miss. ' +
        'GENERATED by syllabus-sync tools/export_buildings.mjs.',
      aliases: Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b))),
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await copyFile(sourceOverlayPath, outputOverlayPath);

console.log(
  `Merged ${normalizedBuildings.length} source buildings into ${mergedBuildings.length} canonical records; ` +
    `${Object.keys(aliases).length} aliases.`,
);
if (divergences.length) {
  console.warn(
    `\n${divergences.length} field(s) differ between Syllabus Sync and Campus Navigation ` +
      'and were LEFT ALONE. Re-run with --apply-fields to push them, but check each one ' +
      'first - Campus Navigation currently holds the richer value in several cases:',
  );
  for (const d of divergences.slice(0, 20)) console.warn(`  ${d}`);
  if (divergences.length > 20) console.warn(`  ...and ${divergences.length - 20} more`);
}
if (coordMoves.length) {
  console.warn(
    `${coordMoves.length} building(s) moved more than ${COORD_WARN_METRES}m: ${coordMoves.join(', ')}. ` +
      'Confirm the Syllabus Sync coordinates are the more accurate ones before shipping.',
  );
}
if (unmatched.length) {
  console.warn(
    `${unmatched.length} Syllabus Sync building(s) have no Campus Navigation counterpart ` +
      `and were NOT added (add them to buildings.json first): ${unmatched.join(', ')}`,
  );
}

console.log(
  `Exported ${normalizedBuildings.length} buildings, overlay metadata, and raster image to ${flutterRoot}`,
);
