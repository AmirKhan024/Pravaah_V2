// One-off generator for the messy registration CSV fixtures (contract/samples/). Not part of the
// app; run once with `node scripts/gen-registration-samples.mjs` and delete if no longer needed.
import { writeFileSync } from 'node:fs';

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const maybeBlank = (rng, v, blankChance = 0.12) => (rng() < blankChance ? '' : v);

// ---- stadium event: registrants pick a hotel, a gate hint, mixed column-naming conventions ----
function genStadium() {
  const rng = mulberry32(42);
  const header = ['Full Name', 'Phone', 'Origin City', 'Mode of Travel', 'Hotel Name', 'Group Size', 'Gate Pref', 'Notes'];
  const origins = ['Panvel', 'Kharghar', 'Vashi', 'Thane', 'Pune', 'Nashik', 'Nerul', 'Belapur', 'Sanpada', 'Kalyan'];
  const modes = ['Train', 'train', 'Metro', 'metro', 'BUS', 'bus', 'Car', 'car', 'Cab', ''];
  const hotels = ['Kharghar Grand', 'Panvel Inn', 'N/A', '', 'None'];
  const gates = ['Gate A', 'Gate B', 'Gate C', '', '', ''];
  const names = ['Rahul Sharma', 'Priya Patil', 'Amit Deshmukh', 'Sneha Kulkarni', 'Vikram Rao', 'Anjali Joshi', 'Rohan Mehta', 'Kavita Naik', 'Suresh Iyer', 'Divya Nair'];
  const rows = [header.join(',')];
  for (let i = 1; i <= 200; i++) {
    const name = maybeBlank(rng, pick(rng, names) + ' ' + i, 0.03);
    const phone = maybeBlank(rng, '98' + String(Math.floor(rng() * 100000000)).padStart(8, '0'), 0.15);
    const origin = maybeBlank(rng, pick(rng, origins), 0.05);
    const mode = maybeBlank(rng, pick(rng, modes), 0.1);
    const hotel = maybeBlank(rng, pick(rng, hotels), 0.2);
    const groupSize = maybeBlank(rng, String(1 + Math.floor(rng() * 5)), 0.08);
    const gate = maybeBlank(rng, pick(rng, gates), 0.5);
    const notes = maybeBlank(rng, pick(rng, ['wheelchair access needed', 'senior citizen group', 'first time visitor', '']), 0.7);
    rows.push([name, phone, origin, mode, hotel, groupSize, gate, notes].join(','));
  }
  return rows.join('\n') + '\n';
}

// ---- procession event: no hotels, no gate hints, an even messier/looser header ----
function genProcession() {
  const rng = mulberry32(7);
  const header = ['name', 'mobile', 'area', 'transport', 'group size', 'notes'];
  const origins = ['Lalbaug', 'Girgaon', 'Dadar', 'Parel', 'Byculla', 'Chowpatty', 'Grant Road', 'Charni Road'];
  const modes = ['train', 'Train', 'bus', 'Bus', 'walk', 'Walk', ''];
  const names = ['Ganesh More', 'Sunita Pawar', 'Ajay Bhosale', 'Meena Salvi', 'Prakash Gaikwad', 'Rekha Shinde', 'Nitin Kadam', 'Vaishali Chavan'];
  const rows = [header.join(',')];
  for (let i = 1; i <= 200; i++) {
    const name = maybeBlank(rng, pick(rng, names) + ' ' + i, 0.04);
    const mobile = maybeBlank(rng, '9' + String(Math.floor(rng() * 1000000000)).padStart(9, '0'), 0.2);
    const area = maybeBlank(rng, pick(rng, origins), 0.06);
    const transport = maybeBlank(rng, pick(rng, modes), 0.15);
    const groupSize = maybeBlank(rng, String(1 + Math.floor(rng() * 8)), 0.1);
    const notes = maybeBlank(rng, pick(rng, ['carrying idol', 'elderly in group', 'children in group', '']), 0.75);
    rows.push([name, mobile, area, transport, groupSize, notes].join(','));
  }
  return rows.join('\n') + '\n';
}

writeFileSync(new URL('../contract/samples/registrations-stadium.csv', import.meta.url), genStadium());
writeFileSync(new URL('../contract/samples/registrations-procession.csv', import.meta.url), genProcession());
console.log('wrote registrations-stadium.csv and registrations-procession.csv');
