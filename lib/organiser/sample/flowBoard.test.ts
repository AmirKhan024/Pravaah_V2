import { describe, expect, it } from 'vitest';
import { calmConsoleState } from './calm';
import { processionConsoleState } from './procession';
import { stadiumConsoleState } from './stadium';

describe('sample flow boards', () => {
  const boards = {
    stadium: stadiumConsoleState().flowBoard,
    procession: processionConsoleState().flowBoard,
    calm: calmConsoleState().flowBoard,
  };

  it('every sample event carries a flowBoard', () => {
    expect(boards.stadium).toBeDefined();
    expect(boards.procession).toBeDefined();
    expect(boards.calm).toBeDefined();
  });

  it('each board has a different node-id shape', () => {
    const idSets = Object.values(boards).map((b) => new Set(b!.nodes.map((n) => n.id)));
    for (let i = 0; i < idSets.length; i++) {
      for (let j = i + 1; j < idSets.length; j++) {
        expect(idSets[i]).not.toEqual(idSets[j]);
      }
    }
  });

  it('each board has a different node count', () => {
    const counts = Object.values(boards).map((b) => b!.nodes.length);
    expect(new Set(counts).size).toBe(counts.length);
  });

  it('exactly one venue node per board, and every link ends at a real node', () => {
    for (const board of Object.values(boards)) {
      const venueNodes = board!.nodes.filter((n) => n.kind === 'venue');
      expect(venueNodes).toHaveLength(1);
      const ids = new Set(board!.nodes.map((n) => n.id));
      for (const link of board!.links) {
        expect(ids.has(link.from)).toBe(true);
        expect(ids.has(link.to)).toBe(true);
      }
    }
  });

  it('every frame covers every node and link', () => {
    for (const board of Object.values(boards)) {
      for (const frame of board!.frames) {
        for (const node of board!.nodes) expect(frame.nodes[node.id]).toBeDefined();
        for (const link of board!.links) expect(frame.links[link.id]).toBeDefined();
      }
    }
  });

  it('the calm event has no pending actions anywhere', () => {
    const state = calmConsoleState();
    expect(state.services.every((s) => s.actions.length === 0)).toBe(true);
    expect(state.canPublish).toBe(false);
  });
});
