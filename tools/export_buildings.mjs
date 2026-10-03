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

await writeFile(outputBuildingsPath, `${JSON.stringify(normalizedBuildings, null, 2)}\n`, 'utf8');
await writeFile(outputOverlayMetaPath, `${JSON.stringify(campusOverlayMeta, null, 2)}\n`, 'utf8');
await copyFile(sourceOverlayPath, outputOverlayPath);

console.log(
  `Exported ${normalizedBuildings.length} buildings, overlay metadata, and raster image to ${flutterRoot}`,
);
