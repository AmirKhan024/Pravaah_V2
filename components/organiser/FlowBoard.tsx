import type { FlowFrame, FlowNode, FlowNodeKind } from '../../lib/organiser/types';
import { STATUS_COLOR } from './statusColor';

const MAIN_COL: Partial<Record<FlowNodeKind, number>> = { origin: 0, transport: 1, gate: 2, venue: 3 };
const COL_WIDTH = 220;
const ROW_HEIGHT = 100;
const NODE_W = 168;
const NODE_H = 60;
const SIDE_GAP = 50;

type Position = { x: number; y: number };

function layout(nodes: FlowNode[]): { positions: Map<string, Position>; width: number; height: number } {
  const colRowCount: Record<number, number> = {};
  const positions = new Map<string, Position>();

  const mainNodes = nodes.filter((n) => n.kind in MAIN_COL);
  const sideNodes = nodes.filter((n) => !(n.kind in MAIN_COL));

  for (const n of mainNodes) {
    const col = MAIN_COL[n.kind] as number;
    const row = colRowCount[col] ?? 0;
    positions.set(n.id, { x: col * COL_WIDTH, y: row * ROW_HEIGHT });
    colRowCount[col] = row + 1;
  }

  const mainRows = Math.max(1, ...Object.values(colRowCount), 0);
  sideNodes.forEach((n, i) => {
    const col = 1 + (i % 3);
    const row = mainRows + Math.floor(i / 3);
    positions.set(n.id, { x: col * COL_WIDTH, y: row * ROW_HEIGHT + SIDE_GAP });
  });

  const usedCols = [...Object.keys(colRowCount).map(Number), ...sideNodes.map((_, i) => 1 + (i % 3))];
  const maxCol = Math.max(3, ...usedCols, 0);
  const sideRows = Math.ceil(sideNodes.length / 3);
  const width = (maxCol + 1) * COL_WIDTH;
  const height = (mainRows + sideRows) * ROW_HEIGHT + (sideNodes.length ? SIDE_GAP : 0) + NODE_H;

  return { positions, width, height };
}

type Props = {
  nodes: FlowNode[];
  links: { id: string; from: string; to: string }[];
  frame: FlowFrame | undefined;
  focusedServiceId: string | null;
  onSelectService: (serviceId: string) => void;
};

export default function FlowBoard({ nodes, links, frame, focusedServiceId, onSelectService }: Props) {
  const { positions, width, height } = layout(nodes);

  return (
    <div className="w-full overflow-auto rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="h-auto w-full min-w-[720px]" role="img">
        {links.map((link) => {
          const from = positions.get(link.from);
          const to = positions.get(link.to);
          if (!from || !to) return null;
          const stat = frame?.links[link.id];
          const color = STATUS_COLOR[stat?.status ?? 'calm'];
          const strokeWidth = 2 + Math.min(1, stat?.load ?? 0.3) * 10;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          return (
            <line key={link.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color.hex} strokeWidth={strokeWidth} strokeLinecap="round" opacity={0.8}>
              {stat?.status === 'act_now' ? (
                <animate attributeName="stroke-opacity" values="0.9;0.35;0.9" dur="1.1s" repeatCount="indefinite" />
              ) : null}
            </line>
          );
        })}

        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const stat = frame?.nodes[node.id];
          const color = STATUS_COLOR[stat?.status ?? 'calm'];
          const load = Math.max(0, Math.min(1, stat?.load ?? 0.3));
          const focused = focusedServiceId === node.service;

          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`} className="cursor-pointer" onClick={() => onSelectService(node.service)}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={12}
                fill="#101715"
                stroke={color.hex}
                strokeWidth={focused ? 3 : 1.5}
                opacity={focused || !focusedServiceId ? 1 : 0.45}
              />
              <rect x={4} y={NODE_H - 10} width={(NODE_W - 8) * load} height={6} rx={3} fill={color.hex} opacity={0.9} />
              <text x={NODE_W / 2} y={NODE_H / 2 - 4} textAnchor="middle" fill="#F5F5F0" fontSize={15} fontWeight={600}>
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
