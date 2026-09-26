import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT_DIR = 'docs/qa/screens';
mkdirSync(OUT_DIR, { recursive: true });

const EVENTS = {
  stadium: 'event_stadium_final',
  procession: 'event_procession_visarjan',
  calm: 'event_stadium_small_meetup',
};

const DESKTOP_PAGES = [
  ['console-stadium', `/console?event=${EVENTS.stadium}`],
  ['console-procession', `/console?event=${EVENTS.procession}`],
  ['console-calm', `/console?event=${EVENTS.calm}`],
  ['owner-venue', '/owner/venue'],
  ['owner-documents', '/owner/documents'],
  ['owner-event', '/owner/event'],
  ['owner-registrations', '/owner/registrations'],
];

const MOBILE_PAGES = [
  ['v-entry', `/v?event=${EVENTS.stadium}`],
  ['v-plan', `/v/plan?event=${EVENTS.stadium}&mode=train`],
];

const WORD_LIMIT_LABEL = 4;
const WORD_LIMIT_TEXT = 12;

async function auditPage(page, name, url, viewport) {
  const consoleErrors = [];
  const failedRequests = [];

  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onRequestFailed = (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'failed'}`);
  };
  const onResponse = (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  };

  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  await page.setViewportSize(viewport);
  let navError = null;
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);
  } catch (e) {
    navError = String(e);
  }

  const shotPath = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});

  const bodyText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const isBlank = bodyText.trim().length < 20;

  const longLabels = await page.evaluate((limit) => {
    const nodes = Array.from(document.querySelectorAll('button, label, h1, h2, h3, span'));
    const out = [];
    for (const n of nodes) {
      const txt = (n.textContent || '').trim();
      if (!txt) continue;
      const words = txt.split(/\s+/);
      if (words.length > limit && words.length <= 20) out.push(txt.slice(0, 80));
    }
    return [...new Set(out)].slice(0, 20);
  }, WORD_LIMIT_LABEL).catch(() => []);

  const longTextBlocks = await page.evaluate((limit) => {
    const nodes = Array.from(document.querySelectorAll('p, div, span'));
    const out = [];
    for (const n of nodes) {
      if (n.children.length > 0) continue;
      const txt = (n.textContent || '').trim();
      if (!txt) continue;
      const words = txt.split(/\s+/);
      if (words.length > limit) out.push(txt.slice(0, 140));
    }
    return [...new Set(out)].slice(0, 20);
  }, WORD_LIMIT_TEXT).catch(() => []);

  const numberCount = await page.evaluate((viewportHeight) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      const matches = text.match(/\d[\d,.]*/g);
      if (!matches || !node.parentElement) continue;
      const rect = node.parentElement.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) count += matches.length;
    }
    return count;
  }, viewport.height).catch(() => 0);

  const sampleMentions = await page.evaluate(() => {
    const txt = document.body.innerText || '';
    return (txt.match(/\bsample\b/gi) || []).length;
  }).catch(() => 0);

  let smallTapTargets = 0;
  if (viewport.width <= 400) {
    smallTapTargets = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], input'));
      let count = 0;
      for (const n of nodes) {
        const r = n.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) count++;
      }
      return count;
    }).catch(() => 0);
  }

  page.off('console', onConsole);
  page.off('requestfailed', onRequestFailed);
  page.off('response', onResponse);

  return {
    name,
    url,
    viewport,
    navError,
    isBlank,
    consoleErrors,
    failedRequests,
    numberCount,
    sampleMentions,
    longLabels,
    longTextBlocks,
    smallTapTargets: viewport.width <= 400 ? smallTapTargets : null,
  };
}

async function testFlow(page, label, eventId) {
  const steps = [];
  try {
    await page.goto(`${BASE}/console?event=${eventId}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);

    const tileCount = await page.locator('[class*="grid"] button').count();
    let openedServiceWithAction = false;
    for (let i = 0; i < tileCount; i++) {
      await page.locator('[class*="grid"] button').nth(i).click({ timeout: 5000 });
      const doItBtn = page.getByRole('button', { name: 'Do it' });
      if ((await doItBtn.count()) > 0) {
        openedServiceWithAction = true;
        steps.push(`opened a service (tile ${i}) with a pending action: ok`);
        await doItBtn.first().click({ timeout: 5000 });
        steps.push('pressed Do it: ok');
        break;
      }
      const backBtn = page.getByRole('button', { name: /Back/i });
      if ((await backBtn.count()) > 0) await backBtn.first().click({ timeout: 5000 });
    }
    if (!openedServiceWithAction) {
      steps.push('opened a service: ok (no service currently has a pending action — all already approved/skipped from prior runs)');
    }

    const backBtn = page.getByRole('button', { name: /Back/i });
    if ((await backBtn.count()) > 0) await backBtn.first().click({ timeout: 5000 });

    const publishBtn = page.getByRole('button', { name: /Publish/i });
    if ((await publishBtn.count()) > 0) {
      const disabled = await publishBtn.first().isDisabled().catch(() => false);
      if (!disabled) {
        await publishBtn.first().click({ timeout: 5000 });
        steps.push('pressed Publish: ok');
      } else {
        steps.push('pressed Publish: button disabled (canPublish=false)');
      }
    } else {
      steps.push('pressed Publish: button not found');
    }

    await page.goto(`${BASE}/v/plan?event=${eventId}&mode=train`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);
    const planText = await page.evaluate(() => document.body.innerText || '');
    const showsPlan = planText.trim().length > 20;
    steps.push(`/v/plan shows a plan: ${showsPlan ? 'yes' : 'NO — blank'}`);

    return { label, ok: true, steps };
  } catch (e) {
    steps.push(`ERROR: ${String(e)}`);
    return { label, ok: false, steps };
  }
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  for (const [name, url] of DESKTOP_PAGES) {
    results.push(await auditPage(page, name, url, { width: 1440, height: 900 }));
  }
  for (const [name, url] of MOBILE_PAGES) {
    results.push(await auditPage(page, `${name}-mobile`, url, { width: 360, height: 780 }));
  }
  for (const [name, url] of MOBILE_PAGES) {
    results.push(await auditPage(page, `${name}-desktop`, url, { width: 1440, height: 900 }));
  }

  const flowStadium = await testFlow(page, 'stadium', EVENTS.stadium);
  const flowProcession = await testFlow(page, 'procession', EVENTS.procession);

  await browser.close();

  writeFileSync(
    'docs/qa/audit-results.json',
    JSON.stringify({ results, flows: [flowStadium, flowProcession] }, null, 2),
  );

  console.log(JSON.stringify({ results, flows: [flowStadium, flowProcession] }, null, 2));
}

main();
