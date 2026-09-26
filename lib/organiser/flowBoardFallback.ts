import type { FlowBoard, FlowNodeKind, ServiceStatus, StatusLevel, ZoneFrame } from './types';

function inferKind(label: string): FlowNodeKind {
  const l = label.toLowerCase();
  if (l.includes('hotel')) return 'hotel';
  if (l.includes('food')) return 'food';
  if (l.includes('gate')) return 'gate';
  return 'transport';
}

function loadForStatus(status: StatusLevel): number {
  if (status === 'act_now') return 1;
  if (status === 'watch') return 0.65;
  return 0.3;
}

const VENUE_NODE_ID = 'venue';

/**
 * A simple stand-in flow board built from the existing ZoneFrame/ServiceStatus data, used only
 * when ConsoleState.flowBoard is absent (see lib/organiser/types.ts's FlowBoard comment) — one node
 * per service, all feeding a single venue node, so the console never breaks while the real graph
 * isn't wired up yet.
 */
export function buildFallbackFlowBoard(services: ServiceStatus[], frames: ZoneFrame[], venueLabel: string): FlowBoard {
  const nodes: FlowBoard['nodes'] = [
    ...services.map((s) => ({ id: s.id, label: s.label, kind: inferKind(s.label), service: s.id })),
    { id: VENUE_NODE_ID, label: venueLabel, kind: 'venue' as const, service: VENUE_NODE_ID },
  ];

  const links: FlowBoard['links'] = services.map((s) => ({ id: `link_${s.id}_${VENUE_NODE_ID}`, from: s.id, to: VENUE_NODE_ID }));

  const sourceFrames = frames.length > 0 ? frames : [{ minuteOffset: 0, timeLabel: '', serviceStatus: {}, zones: [], sample: true }];

  const flowFrames: FlowBoard['frames'] = sourceFrames.map((frame) => {
    const nodeEntries: FlowBoard['frames'][number]['nodes'] = {};
    const linkEntries: FlowBoard['frames'][number]['links'] = {};
    let worst: StatusLevel = 'calm';

    for (const s of services) {
      const status = frame.serviceStatus[s.id] ?? s.statusColor;
      if (status === 'act_now' || (status === 'watch' && worst === 'calm')) worst = status;
      const load = loadForStatus(status);
      nodeEntries[s.id] = { load, status };
      linkEntries[`link_${s.id}_${VENUE_NODE_ID}`] = { load, status };
    }
    nodeEntries[VENUE_NODE_ID] = { load: loadForStatus(worst), status: worst };

    return { minute: frame.minuteOffset, nodes: nodeEntries, links: linkEntries };
  });

  return { nodes, links, frames: flowFrames };
}
