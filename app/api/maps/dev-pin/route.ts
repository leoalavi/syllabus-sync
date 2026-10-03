/**
 * DEV-ONLY API: Patch a building's pixel position in buildings.ts on disk.
 *
 * Guarded by NODE_ENV === 'development'. Returns 403 in production/preview.
 * Used by the Dev Pin Editor panel on the campus map page.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Force Node.js runtime so fs is available
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev-only endpoint' }, { status: 403 });
  }

  let body: { buildingId: string; position: [number, number] };
  try {
    body = (await req.json()) as { buildingId: string; position: [number, number] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { buildingId, position } = body;

  if (
    !buildingId ||
    !Array.isArray(position) ||
    position.length !== 2 ||
    typeof position[0] !== 'number' ||
    typeof position[1] !== 'number' ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1])
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const x = Math.round(position[0]);
  const y = Math.round(position[1]);

  const filePath = join(process.cwd(), 'features', 'map', 'lib', 'buildings.ts');

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Could not read buildings.ts' }, { status: 500 });
  }

  // Escape any regex special chars in the building id
  const escaped = buildingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find the id: 'BUILDINGID' or id: "BUILDINGID" occurrence
  const idPattern = new RegExp(`id:\\s*['"]${escaped}['"]`);
  const idMatch = content.match(idPattern);

  if (!idMatch || idMatch.index === undefined) {
    return NextResponse.json({ error: `Building '${buildingId}' not found` }, { status: 404 });
  }

  const before = content.slice(0, idMatch.index);
  const fromId = content.slice(idMatch.index);

  // From that point, replace the first position: [x, y] (with optional whitespace and comments)
  const posPattern = /position:\s*\[\s*\d+\s*,\s*\d+\s*\]/;

  if (!posPattern.test(fromId)) {
    return NextResponse.json(
      { error: `position field not found for '${buildingId}'` },
      { status: 404 },
    );
  }

  const updated = fromId.replace(posPattern, `position: [${x}, ${y}]`);

  try {
    writeFileSync(filePath, before + updated, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Could not write buildings.ts' }, { status: 500 });
  }

  return NextResponse.json({ success: true, buildingId, position: [x, y] });
}
