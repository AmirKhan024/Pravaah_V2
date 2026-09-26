"use client";

import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  EventSchema,
  VenueSchema,
  type Event,
  type EventHotel,
  type Trust,
  type UploadResult,
  type Venue,
  type VenueDocument,
  type VenueDocumentType,
  type VenueEntrance,
  type VenueGate,
  type VenueParking,
} from "@/contract/schemas";
import { APP_NAME } from "@/config/app";
import {
  loadSampleRegistrations,
  runForecast,
  sampleDocument,
  sampleEvent,
  sampleVenue,
  saveEvent,
  saveVenue,
  uploadDocument,
  uploadRegistrations,
} from "@/lib/owner/api";
import { TrustBadge } from "./TrustBadge";

const screens = ["venue", "documents", "event", "registrations"] as const;
type Screen = (typeof screens)[number];
const labels: Record<Screen, string> = {
  venue: "Venue",
  documents: "Documents",
  event: "Event",
  registrations: "Registrations",
};
type PreviewRow = Record<string, string>;

function Card({ children }: { children: ReactNode }) {
  return <section className="mb-5 rounded-xl border border-white/10 bg-white/[.035] p-5">{children}</section>;
}

function Field({
  label,
  value,
  trust,
  type = "text",
  readOnly = false,
  onChange,
}: {
  label: string;
  value: string | number;
  trust?: Trust;
  type?: string;
  readOnly?: boolean;
  onChange?: (val: string) => void;
}) {
  return (
    <div className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/60">{label}</span>
        {trust && <TrustBadge trust={trust} />}
      </div>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-md border border-white/15 bg-[#101715] px-3 py-2.5 text-sm outline-none focus:border-[#C9A961] read-only:text-white/75"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="block">
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[.12em] text-white/60">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-white/15 bg-[#101715] px-3 py-2.5 text-sm outline-none focus:border-[#C9A961]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Action({
  children,
  disabled,
  onClick,
  variant = "primary",
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary: "bg-[#C9A961] text-[#101715] hover:bg-[#d6b76f]",
    secondary: "border border-white/20 bg-white/5 text-white/80 hover:bg-white/10",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return <div className="mb-4 text-sm text-red-400">{children}</div>;
}

function formatDateDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts.map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mName = months[(m ?? 1) - 1] ?? "";
  return `${d} ${mName} ${y}`;
}

export function OwnerScreen({ screen }: { screen: string }) {
  const router = useRouter();
  const current = screens.includes(screen as Screen) ? (screen as Screen) : "venue";
  const [status, setStatus] = useState("");

  // Venue state
  const [venue, setVenue] = useState<Venue | null>(null);
  const [savedVenue, setSavedVenue] = useState<Venue | null>(null);

  // Event state
  const [event, setEvent] = useState<Event | null>(null);
  const [savedEvent, setSavedEvent] = useState<Event | null>(null);
  const [transportId, setTransportId] = useState("");
  const [entryIndex, setEntryIndex] = useState("0");

  // Documents state
  const [documentType, setDocumentType] = useState<VenueDocumentType>("fire_noc");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [document, setDocument] = useState<VenueDocument | null>(null);

  // Registrations state
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [forecasting, setForecasting] = useState(false);

  // Effective Venue working object
  const activeVenue: Venue = venue ?? {
    id: "venue_custom",
    name: "",
    city: "",
    lat: 19.0453,
    lng: 73.0328,
    totalAreaM2: { value: 0, trust: "claimed" },
    capacity: { value: 0, trust: "claimed" },
    gates: [],
    parking: [],
    transportPoints: [
      { id: "tp_metro", name: "Metro station", type: "metro_station", lat: 19.047, lng: 73.067 },
      { id: "tp_station", name: "Train station", type: "train_station", lat: 18.989, lng: 73.117 },
      { id: "tp_bus", name: "Bus stop", type: "bus_stop", lat: 19.048, lng: 73.065 },
    ],
    entrances: [],
  };

  // Effective Event working object
  const activeEvent: Event = event ?? {
    id: "event_custom",
    name: "",
    venueId: activeVenue.id,
    date: "2026-11-14",
    gatesOpen: "17:00",
    showStart: "19:30",
    endTime: "22:30",
    hotels: [],
    transportOptions: [
      {
        id: "opt_metro",
        mode: "metro",
        transportPointId: activeVenue.transportPoints[0]?.id ?? "tp_metro",
        timetable: [{ arrivalTime: "17:10", pulseSize: { value: 2000, trust: "claimed" } }],
      },
    ],
  };

  const transport = activeEvent.transportOptions.find((item) => item.id === transportId) ?? activeEvent.transportOptions[0];
  const entry = transport?.timetable[Number(entryIndex)] ?? transport?.timetable[0];

  function getTpName(id: string): string {
    const list = activeVenue.transportPoints;
    return list.find((t) => t.id === id)?.name ?? "Transport point";
  }

  function getGateLabel(id: string): string {
    return activeVenue.gates.find((g) => g.id === id)?.name ?? "Gate";
  }

  // Sample loaders
  function handleUseSampleVenue() {
    setVenue(sampleVenue);
    setSavedVenue(sampleVenue);
    setStatus("");
  }

  function handleUseSampleEvent() {
    setEvent(sampleEvent);
    setSavedEvent(sampleEvent);
    setTransportId(sampleEvent.transportOptions[0]?.id ?? "");
    setEntryIndex("0");
    setStatus("");
  }

  function handleUseSampleDocument() {
    setDocument(sampleDocument);
    setStatus("");
  }

  async function handleUseSampleRegistrations() {
    setStatus("");
    try {
      const file = await loadSampleRegistrations();
      await chooseRegistrations(file);
      const res = await uploadRegistrations(file, event ?? sampleEvent, venue ?? sampleVenue);
      setUpload(res);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    }
  }

  // Save venue
  async function handleSaveVenue() {
    setStatus("");
    const parsed = VenueSchema.safeParse(activeVenue);
    if (!parsed.success) {
      setStatus("Check venue");
      return;
    }
    const saved = await saveVenue(parsed.data);
    setVenue(saved);
    setSavedVenue(saved);
    setStatus("Venue saved");
  }

  // Save event
  async function handleSaveEvent() {
    setStatus("");
    const parsed = EventSchema.safeParse(activeEvent);
    if (!parsed.success) {
      setStatus("Check event");
      return;
    }
    const saved = await saveEvent(parsed.data);
    setEvent(saved);
    setSavedEvent(saved);
    setStatus("Event saved");
  }

  // Check document
  async function checkDocument() {
    if (!documentFile) return;
    setChecking(true);
    setStatus("");
    try {
      setDocument(await uploadDocument(documentFile, documentType));
    } catch {
      setStatus("Check failed");
    } finally {
      setChecking(false);
    }
  }

  // Registrations handlers
  async function chooseRegistrations(file?: File) {
    setStatus("");
    setUpload(null);
    setPreview([]);
    setHeaders([]);
    setRegistrationFile(null);
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      setStatus("Save as CSV");
      return;
    }
    if (!name.endsWith(".csv")) {
      setStatus("Choose CSV");
      return;
    }
    const text = await file.text();
    const parsed = Papa.parse<PreviewRow>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) {
      setStatus("Check CSV");
      return;
    }
    setHeaders(parsed.meta.fields ?? []);
    setPreview(parsed.data.slice(0, 5));
    setRegistrationFile(file);
  }

  async function handleUploadRegistrations() {
    if (!registrationFile) return;
    setStatus("");
    try {
      const res = await uploadRegistrations(registrationFile, event ?? sampleEvent, venue ?? sampleVenue);
      setUpload(res);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function handleRunForecast() {
    const eventId = event?.id ?? sampleEvent.id;
    setForecasting(true);
    setStatus("");
    try {
      await runForecast(eventId);
      router.push(`/console?event=${eventId}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Forecast failed");
      setForecasting(false);
    }
  }

  // Table add/remove helpers for Venue
  function addGate() {
    const newGate: VenueGate = {
      id: `gate_${Date.now()}`,
      name: `Gate ${String.fromCharCode(65 + activeVenue.gates.length)}`,
      lanes: { value: 6, trust: "claimed" },
      laneRate: { value: 24, trust: "claimed" },
      forecourtAreaM2: { value: 1500, trust: "claimed" },
    };
    setVenue({ ...activeVenue, gates: [...activeVenue.gates, newGate] });
  }

  function removeGate(index: number) {
    const next = activeVenue.gates.filter((_, i) => i !== index);
    setVenue({ ...activeVenue, gates: next });
  }

  function addParking() {
    const newParking: VenueParking = {
      id: `parking_${Date.now()}`,
      name: `Parking ${activeVenue.parking.length + 1}`,
      capacity: { value: 500, trust: "claimed" },
      areaM2: { value: 12000, trust: "claimed" },
    };
    setVenue({ ...activeVenue, parking: [...activeVenue.parking, newParking] });
  }

  function removeParking(index: number) {
    const next = activeVenue.parking.filter((_, i) => i !== index);
    setVenue({ ...activeVenue, parking: next });
  }

  function addEntrance() {
    const newEntrance: VenueEntrance = {
      id: `entrance_${Date.now()}`,
      name: `Entrance ${activeVenue.entrances.length + 1}`,
      transportPointIds: [activeVenue.transportPoints[0]?.id ?? "tp_metro"],
      gateIds: [activeVenue.gates[0]?.id ?? "gate_a"],
    };
    setVenue({ ...activeVenue, entrances: [...activeVenue.entrances, newEntrance] });
  }

  function removeEntrance(index: number) {
    const next = activeVenue.entrances.filter((_, i) => i !== index);
    setVenue({ ...activeVenue, entrances: next });
  }

  // Table add/remove helpers for Event
  function addHotel() {
    const newHotel: EventHotel = {
      id: `hotel_${Date.now()}`,
      name: `Hotel ${activeEvent.hotels.length + 1}`,
      rooms: { value: 100, trust: "claimed" },
      occupied: { value: 50, trust: "claimed" },
      distanceToVenueM: { value: 2500, trust: "claimed" },
      coachOption: false,
      coachCapacity: null,
    };
    setEvent({ ...activeEvent, hotels: [...activeEvent.hotels, newHotel] });
  }

  function removeHotel(index: number) {
    const next = activeEvent.hotels.filter((_, i) => i !== index);
    setEvent({ ...activeEvent, hotels: next });
  }

  // Check whether form data is missing
  const isMissingVenue = venue === null || venue.name === "";
  const isMissingEvent = event === null || event.name === "";
  const isMissingDocument = document === null && documentFile === null;
  const isMissingRegistrations = upload === null && registrationFile === null;

  return (
    <main className="min-h-screen bg-[#101715] px-6 py-8 text-[#f5f6f3] lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[190px_1fr]">
        <aside className="border-b border-white/10 pb-6 lg:border-b-0 lg:border-r lg:pb-0">
          <p className="mb-8 text-xs font-bold uppercase tracking-[.22em] text-[#C9A961]">{APP_NAME}</p>
          <nav className="flex gap-2 lg:block lg:space-y-2">
            {screens.map((item, index) => (
              <a
                key={item}
                href={`/owner/${item}`}
                className={`block rounded-lg px-3 py-2 text-sm ${item === current ? "bg-[#C9A961] text-[#101715]" : "text-white/60 hover:bg-white/5"}`}
              >
                <span className="mr-3 text-xs">0{index + 1}</span>
                {labels[item]}
              </a>
            ))}
          </nav>
        </aside>

        <section>
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-medium">{labels[current]}</h1>
            <div className="flex gap-3">
              {current === "venue" && isMissingVenue && <Action onClick={handleUseSampleVenue}>Use sample</Action>}
              {current === "event" && isMissingEvent && <Action onClick={handleUseSampleEvent}>Use sample</Action>}
              {current === "documents" && isMissingDocument && <Action onClick={handleUseSampleDocument}>Use sample</Action>}
              {current === "registrations" && isMissingRegistrations && <Action onClick={handleUseSampleRegistrations}>Use sample</Action>}
            </div>
          </div>

          {status && <ErrorLine>{status}</ErrorLine>}

          {/* VENUE SCREEN */}
          {current === "venue" && (
            <>
              <Card>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Venue name"
                    value={activeVenue.name}
                    onChange={(val) => setVenue({ ...activeVenue, name: val })}
                  />
                  <Field
                    label="City"
                    value={activeVenue.city}
                    onChange={(val) => setVenue({ ...activeVenue, city: val })}
                  />
                  <Field
                    label="Total area square metres"
                    value={activeVenue.totalAreaM2.value || ""}
                    trust={savedVenue?.totalAreaM2.trust}
                    type="number"
                    onChange={(val) =>
                      setVenue({
                        ...activeVenue,
                        totalAreaM2: { value: Number(val), trust: savedVenue ? "claimed" : activeVenue.totalAreaM2.trust },
                      })
                    }
                  />
                  <Field
                    label="Capacity people"
                    value={activeVenue.capacity.value || ""}
                    trust={savedVenue?.capacity.trust}
                    type="number"
                    onChange={(val) =>
                      setVenue({
                        ...activeVenue,
                        capacity: { value: Number(val), trust: savedVenue ? "claimed" : activeVenue.capacity.trust },
                      })
                    }
                  />
                </div>
              </Card>

              {/* Gates Table */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Gates</span>
                  <Action onClick={addGate} variant="secondary">
                    Add gate
                  </Action>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                      <tr>
                        <th className="pb-3 pr-4 font-medium">Gate name</th>
                        <th className="pb-3 pr-4 font-medium">Lanes</th>
                        <th className="pb-3 pr-4 font-medium">Rate people per minute</th>
                        <th className="pb-3 pr-4 font-medium">Forecourt square metres</th>
                        <th className="pb-3 pr-4 font-medium">Trust</th>
                        <th className="pb-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeVenue.gates.map((g, idx) => {
                        const savedGate = savedVenue?.gates.find((saved) => saved.id === g.id);
                        return (
                          <tr key={g.id} className="border-b border-white/5">
                            <td className="py-2.5 pr-4">
                              <input
                                type="text"
                                value={g.name}
                                onChange={(e) => {
                                  const next = [...activeVenue.gates];
                                  next[idx] = { ...g, name: e.target.value };
                                  setVenue({ ...activeVenue, gates: next });
                                }}
                                className="w-28 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={g.lanes.value}
                                onChange={(e) => {
                                  const next = [...activeVenue.gates];
                                  next[idx] = { ...g, lanes: { value: Number(e.target.value), trust: "claimed" } };
                                  setVenue({ ...activeVenue, gates: next });
                                }}
                                className="w-20 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={g.laneRate.value}
                                onChange={(e) => {
                                  const next = [...activeVenue.gates];
                                  next[idx] = { ...g, laneRate: { value: Number(e.target.value), trust: "claimed" } };
                                  setVenue({ ...activeVenue, gates: next });
                                }}
                                className="w-20 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={g.forecourtAreaM2.value}
                                onChange={(e) => {
                                  const next = [...activeVenue.gates];
                                  next[idx] = { ...g, forecourtAreaM2: { value: Number(e.target.value), trust: "claimed" } };
                                  setVenue({ ...activeVenue, gates: next });
                                }}
                                className="w-24 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              {savedGate && <TrustBadge trust={savedGate.lanes.trust} />}
                            </td>
                            <td className="py-2.5">
                              <Action onClick={() => removeGate(idx)} variant="danger">
                                Remove
                              </Action>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Parking Table */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Parking</span>
                  <Action onClick={addParking} variant="secondary">
                    Add parking
                  </Action>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                      <tr>
                        <th className="pb-3 pr-4 font-medium">Parking name</th>
                        <th className="pb-3 pr-4 font-medium">Spaces</th>
                        <th className="pb-3 pr-4 font-medium">Area square metres</th>
                        <th className="pb-3 pr-4 font-medium">Trust</th>
                        <th className="pb-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeVenue.parking.map((p, idx) => {
                        const savedP = savedVenue?.parking.find((saved) => saved.id === p.id);
                        return (
                          <tr key={p.id} className="border-b border-white/5">
                            <td className="py-2.5 pr-4">
                              <input
                                type="text"
                                value={p.name}
                                onChange={(e) => {
                                  const next = [...activeVenue.parking];
                                  next[idx] = { ...p, name: e.target.value };
                                  setVenue({ ...activeVenue, parking: next });
                                }}
                                className="w-32 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={p.capacity.value}
                                onChange={(e) => {
                                  const next = [...activeVenue.parking];
                                  next[idx] = { ...p, capacity: { value: Number(e.target.value), trust: "claimed" } };
                                  setVenue({ ...activeVenue, parking: next });
                                }}
                                className="w-24 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={p.areaM2.value}
                                onChange={(e) => {
                                  const next = [...activeVenue.parking];
                                  next[idx] = { ...p, areaM2: { value: Number(e.target.value), trust: "claimed" } };
                                  setVenue({ ...activeVenue, parking: next });
                                }}
                                className="w-24 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              {savedP && <TrustBadge trust={savedP.capacity.trust} />}
                            </td>
                            <td className="py-2.5">
                              <Action onClick={() => removeParking(idx)} variant="danger">
                                Remove
                              </Action>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Entrances Table */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Entrances</span>
                  <Action onClick={addEntrance} variant="secondary">
                    Add entrance
                  </Action>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                      <tr>
                        <th className="pb-3 pr-4 font-medium">Entrance name</th>
                        <th className="pb-3 pr-4 font-medium">Transport links</th>
                        <th className="pb-3 pr-4 font-medium">Gate links</th>
                        <th className="pb-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeVenue.entrances.map((ent, idx) => (
                        <tr key={ent.id} className="border-b border-white/5">
                          <td className="py-2.5 pr-4">
                            <input
                              type="text"
                              value={ent.name}
                              onChange={(e) => {
                                const next = [...activeVenue.entrances];
                                next[idx] = { ...ent, name: e.target.value };
                                setVenue({ ...activeVenue, entrances: next });
                              }}
                              className="w-32 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                            />
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-white/80">
                            {ent.transportPointIds.map((id) => getTpName(id)).join(", ") || "None"}
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-white/80">
                            {ent.gateIds.map((id) => getGateLabel(id)).join(", ") || "None"}
                          </td>
                          <td className="py-2.5">
                            <Action onClick={() => removeEntrance(idx)} variant="danger">
                              Remove
                            </Action>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="flex gap-4">
                <Action onClick={handleSaveVenue}>Save venue</Action>
              </div>
            </>
          )}

          {/* DOCUMENTS SCREEN */}
          {current === "documents" && (
            <>
              <Card>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Document type"
                    value={documentType}
                    onChange={(value) => setDocumentType(value as VenueDocumentType)}
                    options={[
                      { value: "fire_noc", label: "Fire NOC" },
                      { value: "occupancy_cert", label: "Occupancy certificate" },
                    ]}
                  />
                  <div className="block">
                    <span className="mb-2 block text-[11px] font-medium uppercase tracking-[.12em] text-white/60">File</span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-white/65"
                    />
                  </div>
                </div>
              </Card>

              {checking && <div className="mb-5 text-sm text-[#C9A961]">Checking...</div>}

              {document && (
                <Card>
                  <div className="grid gap-4 md:grid-cols-3">
                    {Object.entries(document.extractedFields).map(([key, value]) => (
                      <Field key={key} label={key.replaceAll("_", " ")} value={value} readOnly />
                    ))}
                  </div>
                  {document.mismatchFlags.map((flag) => (
                    <ErrorLine key={flag}>{flag.replaceAll("_", " ")}</ErrorLine>
                  ))}
                </Card>
              )}

              <Action onClick={checkDocument} disabled={!documentFile || checking}>
                Check document
              </Action>
            </>
          )}

          {/* EVENT SCREEN */}
          {current === "event" && (
            <>
              <Card>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field
                    label="Event name"
                    value={activeEvent.name}
                    onChange={(val) => setEvent({ ...activeEvent, name: val })}
                  />
                  <Field label="Venue" value={activeVenue.name || "Default venue"} readOnly />
                  <div className="block">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/60">Date</span>
                      <span className="font-mono text-xs text-[#C9A961]">{formatDateDisplay(activeEvent.date)}</span>
                    </div>
                    <input
                      type="date"
                      value={activeEvent.date}
                      onChange={(e) => setEvent({ ...activeEvent, date: e.target.value })}
                      className="w-full rounded-md border border-white/15 bg-[#101715] px-3 py-2.5 text-sm outline-none focus:border-[#C9A961]"
                    />
                  </div>
                  <Field
                    label="Gates open"
                    value={activeEvent.gatesOpen}
                    type="time"
                    onChange={(val) => setEvent({ ...activeEvent, gatesOpen: val })}
                  />
                  <Field
                    label="Start time"
                    value={activeEvent.showStart}
                    type="time"
                    onChange={(val) => setEvent({ ...activeEvent, showStart: val })}
                  />
                  <Field
                    label="End time"
                    value={activeEvent.endTime}
                    type="time"
                    onChange={(val) => setEvent({ ...activeEvent, endTime: val })}
                  />
                </div>
              </Card>

              {/* Hotels Table */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Hotels</span>
                  <Action onClick={addHotel} variant="secondary">
                    Add hotel
                  </Action>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                      <tr>
                        <th className="pb-3 pr-4 font-medium">Hotel name</th>
                        <th className="pb-3 pr-4 font-medium">Rooms</th>
                        <th className="pb-3 pr-4 font-medium">Occupied rooms</th>
                        <th className="pb-3 pr-4 font-medium">Distance metres</th>
                        <th className="pb-3 pr-4 font-medium">Coach</th>
                        <th className="pb-3 pr-4 font-medium">Coach capacity people</th>
                        <th className="pb-3 pr-4 font-medium">Trust</th>
                        <th className="pb-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEvent.hotels.map((h, idx) => {
                        const savedHotel = savedEvent?.hotels.find((saved) => saved.id === h.id);
                        return (
                          <tr key={h.id} className="border-b border-white/5">
                            <td className="py-2.5 pr-4">
                              <input
                                type="text"
                                value={h.name}
                                onChange={(e) => {
                                  const next = [...activeEvent.hotels];
                                  next[idx] = { ...h, name: e.target.value };
                                  setEvent({ ...activeEvent, hotels: next });
                                }}
                                className="w-28 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={h.rooms.value}
                                onChange={(e) => {
                                  const next = [...activeEvent.hotels];
                                  next[idx] = { ...h, rooms: { value: Number(e.target.value), trust: "claimed" } };
                                  setEvent({ ...activeEvent, hotels: next });
                                }}
                                className="w-20 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={h.occupied.value}
                                onChange={(e) => {
                                  const next = [...activeEvent.hotels];
                                  next[idx] = { ...h, occupied: { value: Number(e.target.value), trust: "claimed" } };
                                  setEvent({ ...activeEvent, hotels: next });
                                }}
                                className="w-20 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={h.distanceToVenueM.value}
                                onChange={(e) => {
                                  const next = [...activeEvent.hotels];
                                  next[idx] = { ...h, distanceToVenueM: { value: Number(e.target.value), trust: "claimed" } };
                                  setEvent({ ...activeEvent, hotels: next });
                                }}
                                className="w-24 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961]"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              <select
                                value={h.coachOption ? "yes" : "no"}
                                onChange={(e) => {
                                  const next = [...activeEvent.hotels];
                                  next[idx] = { ...h, coachOption: e.target.value === "yes" };
                                  setEvent({ ...activeEvent, hotels: next });
                                }}
                                className="rounded border border-white/15 bg-[#101715] px-2 py-1 text-xs outline-none focus:border-[#C9A961]"
                              >
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                              </select>
                            </td>
                            <td className="py-2.5 pr-4">
                              <input
                                type="number"
                                value={h.coachCapacity?.value ?? 0}
                                disabled={!h.coachOption}
                                onChange={(e) => {
                                  const next = [...activeEvent.hotels];
                                  next[idx] = {
                                    ...h,
                                    coachCapacity: h.coachOption ? { value: Number(e.target.value), trust: "claimed" } : null,
                                  };
                                  setEvent({ ...activeEvent, hotels: next });
                                }}
                                className="w-20 rounded border border-white/15 bg-[#101715] px-2 py-1 text-sm outline-none focus:border-[#C9A961] disabled:opacity-40"
                              />
                            </td>
                            <td className="py-2.5 pr-4">
                              {savedHotel && <TrustBadge trust={savedHotel.rooms.trust} />}
                            </td>
                            <td className="py-2.5">
                              <Action onClick={() => removeHotel(idx)} variant="danger">
                                Remove
                              </Action>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Transport Card */}
              <Card>
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField
                    label="Transport mode"
                    value={transportId}
                    onChange={(value) => {
                      setTransportId(value);
                      setEntryIndex("0");
                    }}
                    options={activeEvent.transportOptions.map((item) => ({
                      value: item.id,
                      label: `${item.mode} (${getTpName(item.transportPointId)})`,
                    }))}
                  />
                  {transport && (
                    <SelectField
                      label="Timetable"
                      value={entryIndex}
                      onChange={setEntryIndex}
                      options={transport.timetable.map((item, index) => ({
                        value: String(index),
                        label: item.arrivalTime,
                      }))}
                    />
                  )}
                  {entry && (
                    <Field
                      label="Pulse size people"
                      value={entry.pulseSize.value}
                      trust={savedEvent ? entry.pulseSize.trust : undefined}
                      type="number"
                      readOnly
                    />
                  )}
                </div>
              </Card>

              <div className="flex gap-4">
                <Action onClick={handleSaveEvent}>Save event</Action>
              </div>
            </>
          )}

          {/* REGISTRATIONS SCREEN */}
          {current === "registrations" && (
            <>
              <Card>
                <div className="block">
                  <span className="mb-2 block text-[11px] font-medium uppercase tracking-[.12em] text-white/60">
                    Registration CSV
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => chooseRegistrations(event.target.files?.[0])}
                    className="block w-full text-sm text-white/65"
                  />
                </div>
              </Card>

              {preview.length > 0 && (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-white/45">
                        <tr>
                          {headers.map((header) => (
                            <th key={header} className="pb-3 pr-5 font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, index) => (
                          <tr key={index} className="border-t border-white/10">
                            {headers.map((header) => (
                              <td key={header} className="py-3 pr-5">
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* At most 3 big numbers after upload */}
              {upload && (
                <Card>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div className="rounded-lg border border-white/10 bg-[#101715] p-5">
                      <div className="text-3xl font-bold text-[#C9A961]">{upload.keptRows}</div>
                      <div className="mt-1 text-xs uppercase tracking-wider text-white/60">Kept people</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#101715] p-5">
                      <div className="text-3xl font-bold text-white/80">{upload.dropped}</div>
                      <div className="mt-1 text-xs uppercase tracking-wider text-white/60">Dropped people</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#101715] p-5">
                      <div className="text-3xl font-bold text-red-400">{upload.unroutedTotal}</div>
                      <div className="mt-1 text-xs uppercase tracking-wider text-white/60">Unrouted people</div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-4">
                    <Action onClick={handleRunForecast} disabled={forecasting}>
                      {forecasting ? "Working..." : "Run forecast"}
                    </Action>
                    {forecasting && <span className="text-sm text-[#C9A961]">Working...</span>}
                  </div>
                </Card>
              )}

              {!upload && (
                <Action onClick={handleUploadRegistrations} disabled={!registrationFile}>
                  Upload
                </Action>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
