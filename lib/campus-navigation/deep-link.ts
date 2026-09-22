/**
 * Canonical Campus Navigation deep links.
 *
 * This is the ONLY place Syllabus Sync constructs a navigation URL. The shape
 * is defined by Campus Navigation's public contract
 * (MQ_Navigation/lib/features/deep_link/deep_link_contract.dart) — keep the two
 * in step.
 *
 * Building identity is NOT duplicated here. Syllabus Sync sends the building id
 * it already holds and Campus Navigation resolves it against its own canonical
 * table plus an alias map (assets/data/building_aliases.json). That keeps one
 * authority for campus identity instead of two that can drift.
 */
import {
  CAMPUS_NAV_HOST,
  CAMPUS_NAV_OPEN_PATH,
  CAMPUS_NAV_SCHEME,
} from "./config";

export type CampusNavTarget =
  | { kind: "building"; buildingId: string }
  | { kind: "search"; query: string }
  | { kind: "coords"; lat: number; lng: number };

/** Query-parameter names from the contract. Renaming these breaks the handoff. */
const PARAM = {
  destination: "destination",
  query: "q",
  lat: "lat",
  lng: "lng",
} as const;

function paramsFor(target: CampusNavTarget): URLSearchParams {
  const p = new URLSearchParams();
  switch (target.kind) {
    case "building":
      p.set(PARAM.destination, target.buildingId);
      break;
    case "search":
      p.set(PARAM.query, target.query);
      break;
    case "coords":
      p.set(PARAM.lat, String(target.lat));
      p.set(PARAM.lng, String(target.lng));
      break;
  }
  return p;
}

/**
 * `mqnav://open?...` — the primary handoff.
 *
 * A custom scheme needs no domain verification, so it works as soon as the app
 * is installed. This is what we actually attempt.
 */
export function buildCampusNavAppLink(target: CampusNavTarget): string {
  return `${CAMPUS_NAV_SCHEME}://open?${paramsFor(target).toString()}`;
}

/**
 * `https://mqnavigation.app/open?...` — the shareable form.
 *
 * Resolves straight into the app only once the domain serves its
 * assetlinks.json / apple-app-site-association. Used for copyable links, never
 * as the install fallback: Campus Navigation has no web build, so in a browser
 * this is a dead end by design.
 */
export function buildCampusNavUniversalLink(target: CampusNavTarget): string {
  const url = new URL(CAMPUS_NAV_OPEN_PATH, `https://${CAMPUS_NAV_HOST}`);
  url.search = paramsFor(target).toString();
  return url.toString();
}

/** Convenience for the common case. */
export function buildingTarget(
  buildingId: string,
  room?: string,
): CampusNavTarget {
  // Room is not part of the contract; Campus Navigation resolves to the
  // building and the user picks the room inside. Encoding it into the id would
  // produce an id Campus Navigation cannot resolve.
  void room;
  return { kind: "building", buildingId };
}
