import { FLOW_BOARD_MAX_NODES, FLOW_BOARD_STATUS_THRESHOLDS as T } from '../../../config/server-extras';
import type { FlowBoard, FlowFrame, FlowLink, FlowNode, FlowNodeKind, StatusLevel } from '../../../contract/schemas';
import { JAM } from '../../../engine/constants';
import type { Frame, Link, Scenario, SimResult, Zone, ZoneType } from '../../../engine/types';

export type { FlowBoard, FlowFrame, FlowLink, FlowNode, FlowNodeKind, StatusLevel } from '../../../contract/schemas';

const FRAME_STEP_MIN = 5;
const ORIGIN_OVERFLOW_ID = 'origin_overflow';

function nodeKind(type: ZoneType): FlowNodeKind {
  switch (type) {
    case 'venue':
      return 'venue';
    case 'gate':
      return 'gate';
    case 'hotel':
      return 'hotel';
    case 'food':
      return 'food';
    case 'transit':
      return 'origin';
    default:
      return 'transport'; // parking/plaza: supporting infrastructure, never a crowd source
  }
}

function nodeService(zone: Zone): string | null {
  if (zone.type === 'gate' || zone.type === 'food') return zone.id;
  if (zone.type === 'hotel') return 'hotels';
  return null;
}

function statusForLoad(load: number): StatusLevel {
  if (load >= T.actNow) return 'act_now';
  if (load >= T.watch) return 'watch';
  return 'calm';
}

/** Same holding-capacity math engine/simulate.ts uses internally (areaM2 * JAM) for every zone
 * that has one; venue and hotel zones carry their own declared capacity/rooms instead, since
 * neither has an areaM2 from contract/engine-adapter.ts. */
function zoneCapacity(zone: Zone): number {
  if (zone.type === 'venue' && zone.capacity) return zone.capacity;
  if (zone.type === 'hotel') return zone.rooms ?? 0;
  return zone.areaM2 ? zone.areaM2 * JAM : 0;
}

/** Hotels are never routed through by the engine (contract/engine-adapter.ts's documented gap) —
 * their occupancy is the static rooms/occupied the venue owner entered, not a simulated number. */
function zoneOccupancy(zone: Zone, zoneIdx: number, frame: Frame): number {
  if (zone.type === 'hotel') return zone.occupied ?? 0;
  return frame.zoneOcc[zoneIdx] ?? 0;
}

/** capNow() in engine/simulate.ts, re-derived from the static scenario (no interventions — this
 * is the base board): lanes*laneRate for a gate link, the link's own cap otherwise. */
function linkCapacity(link: Link, scenario: Scenario): number {
  if (link.mode === 'gate') {
    const gate = scenario.zones.find((z) => z.id === link.gate);
    return gate?.lanes ? gate.lanes * scenario.laneRate : 0;
  }
  return link.cap ?? 0;
}

function load(value: number, capacity: number): number {
  return capacity > 0 ? value / capacity : 0;
}

/**
 * Pure mapping from one simulate() run into a FlowBoard: which nodes and links exist (derived
 * only from the scenario's own zones/links — no invented topology), and one frame every 5
 * simulated minutes giving each node/link a load (occupancy or flow, over its own capacity) and a
 * status color from FLOW_BOARD_STATUS_THRESHOLDS (config/server-extras.ts, assumption).
 *
 * Grouping: every transport-point zone is already one node per real-world transport point (see
 * contract/engine-adapter.ts) — this only merges further if a venue has so many that the board
 * would exceed FLOW_BOARD_MAX_NODES, folding the smallest-index overflow transport points into
 * one "other approaches" node so the total node count never exceeds the cap. A zone with no link
 * touching it (e.g. a display-only parking lot) has no flow to show and is left out entirely.
 */
export function buildFlowBoard(scenario: Scenario, simResult: SimResult): FlowBoard {
  const linkedZoneIds = new Set<string>();
  for (const link of scenario.links) {
    linkedZoneIds.add(link.from);
    linkedZoneIds.add(link.to);
  }
  const graphZones = scenario.zones.filter((z) => linkedZoneIds.has(z.id));

  // effective id every node/link actually uses — identity unless folded into the overflow node
  const effectiveId = new Map<string, string>(graphZones.map((z) => [z.id, z.id]));
  const originZones = graphZones.filter((z) => z.type === 'transit');
  const nonOriginCount = graphZones.length - originZones.length;
  const originBudget = Math.max(1, FLOW_BOARD_MAX_NODES - nonOriginCount);
  if (originZones.length > originBudget) {
    const keepCount = Math.max(0, originBudget - 1); // reserve one slot for the merged node
    const kept = new Set(originZones.slice(0, keepCount).map((z) => z.id));
    for (const z of originZones) if (!kept.has(z.id)) effectiveId.set(z.id, ORIGIN_OVERFLOW_ID);
  }

  const zoneIdx = new Map(scenario.zones.map((z, i) => [z.id, i]));
  const nodeZones = new Map<string, Zone[]>();
  for (const zone of graphZones) {
    const id = effectiveId.get(zone.id)!;
    const list = nodeZones.get(id) ?? [];
    list.push(zone);
    nodeZones.set(id, list);
  }

  const nodes: FlowNode[] = [];
  for (const [id, zones] of nodeZones) {
    const isOverflow = id === ORIGIN_OVERFLOW_ID;
    const first = zones[0];
    nodes.push({
      id,
      label: isOverflow ? 'Other approaches' : first.name,
      kind: isOverflow ? 'origin' : nodeKind(first.type),
      service: isOverflow ? null : nodeService(first),
    });
  }

  const links: FlowLink[] = [];
  const seenLinkIds = new Set<string>();
  for (const link of scenario.links) {
    const from = effectiveId.get(link.from);
    const to = effectiveId.get(link.to);
    if (!from || !to || from === to || seenLinkIds.has(link.id)) continue;
    seenLinkIds.add(link.id);
    links.push({ id: link.id, from, to });
  }

  const nodeCapacity = new Map<string, number>();
  for (const [id, zones] of nodeZones) nodeCapacity.set(id, zones.reduce((sum, z) => sum + zoneCapacity(z), 0));

  const linkFlowIdx = new Map(scenario.links.map((l, i) => [l.id, i]));
  const linkCap = new Map(scenario.links.map((l) => [l.id, linkCapacity(l, scenario)]));

  const frames: FlowFrame[] = [];
  for (let minute = 0; minute < simResult.frames.length; minute += FRAME_STEP_MIN) {
    const frame = simResult.frames[minute];
    if (!frame) continue;

    const frameNodes: FlowFrame['nodes'] = {};
    for (const [id, zones] of nodeZones) {
      const occ = zones.reduce((sum, z) => sum + zoneOccupancy(z, zoneIdx.get(z.id)!, frame), 0);
      const l = load(occ, nodeCapacity.get(id) ?? 0);
      frameNodes[id] = { load: Math.round(l * 100) / 100, status: statusForLoad(l) };
    }

    const frameLinks: FlowFrame['links'] = {};
    for (const flowLink of links) {
      const flow = frame.linkFlow[linkFlowIdx.get(flowLink.id)!] ?? 0;
      const l = load(flow, linkCap.get(flowLink.id) ?? 0);
      frameLinks[flowLink.id] = { load: Math.round(l * 100) / 100, status: statusForLoad(l) };
    }

    frames.push({ minute, nodes: frameNodes, links: frameLinks });
  }

  return { nodes, links, frames };
}
