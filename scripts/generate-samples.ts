// Generates the large, deterministic registration fixtures used to check buildGroups' merge
// behavior and unrouted rate at realistic scale (contract/contract.test.ts and the small *-small
// files stay the fast, exact-count fixtures for everyday tests). Not part of the app; re-run with
// `npx tsx scripts/generate-samples.ts` any time the mode weights need retuning.
import { writeFileSync } from 'node:fs';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(rng: () => number, table: Array<[T, number]>): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, w] of table) {
    r -= w;
    if (r <= 0) return value;
  }
  return table[table.length - 1][0];
}

const maybeBlank = (rng: () => number, v: string, blankChance = 0.12) => (rng() < blankChance ? '' : v);

function genStadium(rows: number): string {
  const rng = mulberry32(1001);
  const header = ['Full Name', 'Phone', 'Origin City', 'Mode of Travel', 'Hotel Name', 'Group Size', 'Gate Pref', 'Notes'];
  const origins = ['Panvel', 'Kharghar', 'Vashi', 'Thane', 'Pune', 'Nashik', 'Nerul', 'Belapur', 'Sanpada', 'Kalyan', 'Mumbai Central', 'Dombivli'];
  // messy on purpose (mixed case, spelling variants) but weighted so <5% of rows end up on a mode
  // the sample event has no transport option for (see contract/samples/event-stadium.json)
  const modes: Array<[string, number]> = [
    ['Metro', 22], ['metro', 8], ['METRO', 2], ['Metro rail', 2],
    ['Train', 14], ['train', 6], ['Local train', 2], ['Rail', 2],
    ['Bus', 10], ['bus', 6], ['BEST bus', 2],
    ['Car', 12], ['car', 6], ['Cab', 6], ['cab', 3], ['Self drive', 2],
    ['', 1], ['Other', 1], ['N/A', 1],
  ];
  const hotels = ['Kharghar Grand', 'Panvel Inn', 'N/A', '', 'None'];
  const gates = ['Gate A', 'Gate B', 'Gate C', '', '', ''];
  const names = ['Rahul Sharma', 'Priya Patil', 'Amit Deshmukh', 'Sneha Kulkarni', 'Vikram Rao', 'Anjali Joshi', 'Rohan Mehta', 'Kavita Naik', 'Suresh Iyer', 'Divya Nair'];
  const lines = [header.join(',')];
  for (let i = 1; i <= rows; i++) {
    const name = maybeBlank(rng, weightedPick(rng, names.map((n) => [n, 1] as [string, number])) + ' ' + i, 0.03);
    const phone = maybeBlank(rng, '98' + String(Math.floor(rng() * 100000000)).padStart(8, '0'), 0.15);
    const origin = maybeBlank(rng, weightedPick(rng, origins.map((o) => [o, 1] as [string, number])), 0.05);
    const mode = maybeBlank(rng, weightedPick(rng, modes), 0);
    const hotel = maybeBlank(rng, weightedPick(rng, hotels.map((h) => [h, 1] as [string, number])), 0.2);
    const groupSize = maybeBlank(rng, String(1 + Math.floor(rng() * 5)), 0.08);
    const gate = maybeBlank(rng, weightedPick(rng, gates.map((g) => [g, 1] as [string, number])), 0.5);
    const notes = maybeBlank(rng, weightedPick(rng, ['wheelchair access needed', 'senior citizen group', 'first time visitor', ''].map((n) => [n, 1] as [string, number])), 0.7);
    lines.push([name, phone, origin, mode, hotel, groupSize, gate, notes].join(','));
  }
  return lines.join('\n') + '\n';
}

function genProcession(rows: number): string {
  const rng = mulberry32(2002);
  const header = ['name', 'mobile', 'area', 'transport', 'group size', 'notes'];
  const origins = ['Lalbaug', 'Girgaon', 'Dadar', 'Parel', 'Byculla', 'Chowpatty', 'Grant Road', 'Charni Road', 'Bhoiwada', 'Kalbadevi'];
  // 'walk' is the majority mode for a procession — matches the 'walk' transport option added to
  // event-procession.json — leaving only a small blank/unknown residual
  const modes: Array<[string, number]> = [
    ['Train', 16], ['train', 8], ['Local', 2], ['Rail', 2],
    ['Bus', 12], ['bus', 6], ['BEST', 2],
    ['Walk', 26], ['walk', 12], ['On foot', 4], ['Walking', 2],
    ['', 1], ['Other', 1], ['N/A', 1],
  ];
  const names = ['Ganesh More', 'Sunita Pawar', 'Ajay Bhosale', 'Meena Salvi', 'Prakash Gaikwad', 'Rekha Shinde', 'Nitin Kadam', 'Vaishali Chavan'];
  const lines = [header.join(',')];
  for (let i = 1; i <= rows; i++) {
    const name = maybeBlank(rng, weightedPick(rng, names.map((n) => [n, 1] as [string, number])) + ' ' + i, 0.04);
    const mobile = maybeBlank(rng, '9' + String(Math.floor(rng() * 1000000000)).padStart(9, '0'), 0.2);
    const area = maybeBlank(rng, weightedPick(rng, origins.map((o) => [o, 1] as [string, number])), 0.06);
    const transport = maybeBlank(rng, weightedPick(rng, modes), 0);
    const groupSize = maybeBlank(rng, String(1 + Math.floor(rng() * 8)), 0.1);
    const notes = maybeBlank(rng, weightedPick(rng, ['carrying idol', 'elderly in group', 'children in group', ''].map((n) => [n, 1] as [string, number])), 0.75);
    lines.push([name, mobile, area, transport, groupSize, notes].join(','));
  }
  return lines.join('\n') + '\n';
}

const samplesDir = new URL('../contract/samples/', import.meta.url);
writeFileSync(new URL('registrations-stadium.csv', samplesDir), genStadium(20000));
writeFileSync(new URL('registrations-procession.csv', samplesDir), genProcession(10000));
console.log('wrote registrations-stadium.csv (20000 rows) and registrations-procession.csv (10000 rows)');
