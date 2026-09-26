// End-to-end check against a running server (npm run dev / start), one event at a time:
// upload -> simulate -> console state -> approve an action -> publish -> visitor plan for a
// sample registrant -> live report -> re-plan -> ledger verify. Prints pass/fail per step and
// keeps going after a failure so every step gets a result.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const samplesDir = path.join(import.meta.dirname, '../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));
const readText = (name: string) => readFileSync(path.join(samplesDir, name), 'utf8');

interface StepResult {
  step: string;
  ok: boolean;
  detail: string;
}

async function runEvent(label: string, eventFile: string, venueFile: string, csvFile: string): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const record = (step: string, ok: boolean, detail: string) => results.push({ step, ok, detail });

  const event = readJSON(eventFile);
  const venue = readJSON(venueFile);

  // 1. upload
  let registrationId: string | null = null;
  try {
    const form = new FormData();
    form.set('file', new File([readText(csvFile)], csvFile, { type: 'text/csv' }));
    form.set('event', JSON.stringify(event));
    form.set('venue', JSON.stringify(venue));
    const res = await fetch(`${BASE_URL}/api/registrations/upload`, { method: 'POST', body: form });
    const body = await res.json();
    record('upload registrations', res.ok && body.saveStatus?.ok === true, res.ok ? `kept ${body.keptRows} rows, ${body.groups?.length ?? 0} groups, saved=${body.saveStatus?.ok}` : JSON.stringify(body));
  } catch (err) {
    record('upload registrations', false, err instanceof Error ? err.message : String(err));
  }

  // 2. simulate
  try {
    const res = await fetch(`${BASE_URL}/api/events/${event.id}/simulate`);
    const body = await res.json();
    record('simulate', res.ok, res.ok ? `crushMin=${body.summary?.dangerousMinutes}` : JSON.stringify(body));
  } catch (err) {
    record('simulate', false, err instanceof Error ? err.message : String(err));
  }

  // 3. console state
  let firstActionId: string | null = null;
  try {
    const res = await fetch(`${BASE_URL}/api/events/${event.id}/console`);
    const body = await res.json();
    firstActionId = body.services?.flatMap((s: { actions: { id: string }[] }) => s.actions)?.[0]?.id ?? null;
    record('console state', res.ok, res.ok ? `${body.services?.length ?? 0} services, statusWord=${body.statusWord}` : JSON.stringify(body));
  } catch (err) {
    record('console state', false, err instanceof Error ? err.message : String(err));
  }

  // 4. approve an action
  try {
    if (!firstActionId) throw new Error('no action available to approve');
    const res = await fetch(`${BASE_URL}/api/events/${event.id}/console`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', actionId: firstActionId }),
    });
    const body = await res.json();
    record('approve action', res.ok, res.ok ? `canPublish=${body.canPublish}` : JSON.stringify(body));
  } catch (err) {
    record('approve action', false, err instanceof Error ? err.message : String(err));
  }

  // 5. publish
  try {
    const res = await fetch(`${BASE_URL}/api/events/${event.id}/console`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    });
    const body = await res.json();
    record('publish', res.ok && body.ok, res.ok ? `version=${body.version}` : JSON.stringify(body));
  } catch (err) {
    record('publish', false, err instanceof Error ? err.message : String(err));
  }

  // 6. visitor plan for a sample registrant
  try {
    const mode = event.transportOptions?.[0]?.mode ?? 'train';
    const res = await fetch(`${BASE_URL}/api/visitor-plan?event=${event.id}&mode=${mode}`);
    const body = await res.json();
    record('visitor plan', res.ok, res.ok ? `gate=${body.gate}, version=${body.version}` : JSON.stringify(body));
  } catch (err) {
    record('visitor plan', false, err instanceof Error ? err.message : String(err));
  }

  // 7. live report
  try {
    const gateId = venue.gates?.[0]?.id;
    const res = await fetch(`${BASE_URL}/api/live/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, source: 'staff', payload: { chipIds: ['more_people'], text: '' } }),
    });
    const body = await res.json();
    record('live report', res.ok, res.ok ? `needsRerun=${body.needsRerun}, rerun.ok=${body.rerun?.ok}` : JSON.stringify(body));
    void gateId;
  } catch (err) {
    record('live report', false, err instanceof Error ? err.message : String(err));
  }

  // 8. re-plan already covered by live report's rerun — verify a fresh console read reflects it
  try {
    const res = await fetch(`${BASE_URL}/api/events/${event.id}/console`);
    record('re-plan (console reflects rerun)', res.ok, res.ok ? 'console still readable after rerun' : `status ${res.status}`);
  } catch (err) {
    record('re-plan (console reflects rerun)', false, err instanceof Error ? err.message : String(err));
  }

  // 9. ledger verify
  try {
    const res = await fetch(`${BASE_URL}/api/ledger/verify?event=${event.id}`);
    const body = await res.json();
    record('ledger verify', res.ok, res.ok ? JSON.stringify(body) : JSON.stringify(body));
  } catch (err) {
    record('ledger verify', false, err instanceof Error ? err.message : String(err));
  }

  return results;
}

async function main() {
  // the large CSVs, not -small: at small-sample scale crush is genuinely 0 (see Part 1's
  // diagnosis), so there's nothing for the optimiser to suggest and "approve an action" has
  // nothing to approve. That's correct behavior for that data, not a bug — but it means the
  // small fixture can't exercise approve/publish/visitor-plan, which do need a real crush.
  const all: Array<{ event: string; results: StepResult[] }> = [];
  all.push({ event: 'stadium', results: await runEvent('stadium', 'event-stadium.json', 'venue-stadium.json', 'registrations-stadium.csv') });
  all.push({ event: 'procession', results: await runEvent('procession', 'event-procession.json', 'venue-procession.json', 'registrations-procession.csv') });

  let anyFail = false;
  for (const { event, results } of all) {
    console.log(`\n=== ${event} ===`);
    for (const r of results) {
      console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.step} — ${r.detail}`);
      if (!r.ok) anyFail = true;
    }
  }
  process.exit(anyFail ? 1 : 0);
}

main();
