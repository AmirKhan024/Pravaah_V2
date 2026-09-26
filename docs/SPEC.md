# SPEC

## The three parts

- **ORGANISER** (the head): sets up the event, manages hotels, travel, gates, routes, food.
  Approves plans. Nothing goes live without this approval.
- **SYSTEM**: simulates the evening (engine/), finds crowd problems, suggests fixes (levers),
  computes every number. Never approves anything, never guesses a number.
- **VISITOR**: sees only the plan the head approved and published — their gate, travel, hotel,
  leave time, food, in their language.

## Data flow

1. Organiser enters/uploads **Venue** (gates, parking, entrances, transport points) and **Event**
   (date, gatesOpen/showStart, hotels, transport timetables). Venue documents (fire NOC, occupancy
   certificate) get parsed by the LLM into `VenueDocument.extractedFields`, flagged if they
   mismatch the claimed venue numbers.
2. **Registrations** arrive as messy raw rows (any column names) and get normalized (origin,
   travel mode, hotel, group size, gate hint) — by the LLM, validated by zod, template fallback on
   two failed attempts.
3. Normalized registrations become **CrowdGroups** — a 1:1 mapping onto the engine's `Cohort`
   shape (mean/std derived from Event's timetables and gates-open/show-start window; path/alt
   derived by walking the Venue graph from entrance to gate — see `contract/engine-adapter.ts`'s
   documented rule).
4. `toEngineScenario(event, venue, groups)` assembles a `Scenario` and hands it to `engine/`
   unchanged. The engine simulates, finds problems, and proposes levers (its own `Intervention`
   type, reused verbatim by **Plan**).
5. The head approves a **Plan** → **Orders** go out to hotels/travel/gates/routes/food →
   **VisitorPlan** gets published per registrant.
6. During the event, **LiveReports** (gate scans, staff, visitor location) feed back into the
   monitor loop. Every decision along the way is appended to the **LedgerEntry** hash chain — an
   append-only, tamper-evident "what did we know, and when."

## Trust levels

Every venue/event number carries `claimed | documented | observed`. Only `contract/` ever writes
that label; `config/trust.ts` is the only place it turns into a discount, applied once, inside
`toEngineScenario()`. Unverified ("claimed") capacity is never fully trusted by the simulation;
only documented or observed data gets full credit. Anything not `observed` is shown as an
"assumption" in the UI — never silently treated as fact.

## The rules (enforced everywhere, see root CLAUDE.md)

No hardcoded venue/gate/hotel/number in code or UI copy — everything comes from Supabase, except
the labeled sample fixtures in `contract/samples/`. The LLM reads, structures, and drafts text; it
never produces a number, density, cost, or probability, and never approves anything — the engine
computes, the head approves. `engine/` is never edited and never imports from `app/`, components,
or browser APIs.
