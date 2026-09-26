"use client";

import Papa from "papaparse";
import { useMemo, useState, type ReactNode } from "react";
import { EventSchema, VenueSchema, type Trust, type UploadResult, type VenueDocument, type VenueDocumentType } from "@/contract/schemas";
import { APP_NAME } from "@/config/app";
import { sampleEvent, sampleVenue, saveEvent, saveVenue, uploadDocument, uploadRegistrations } from "@/lib/owner/api";
import { TrustBadge } from "./TrustBadge";

const screens = ["venue", "documents", "event", "registrations"] as const;
type Screen = (typeof screens)[number];
const labels: Record<Screen, string> = { venue: "Venue", documents: "Documents", event: "Event", registrations: "Registrations" };
type PreviewRow = Record<string, string>;

function Card({ children }: { children: ReactNode }) { return <section className="mb-5 rounded-xl border border-white/10 bg-white/[.035] p-5">{children}</section>; }
function Field({ label, value, trust, type = "text", readOnly = false }: { label: string; value: string | number; trust?: Trust; type?: string; readOnly?: boolean }) { return <label className="block"><span className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[.12em] text-white/60">{label}{trust && <TrustBadge trust={trust} />}</span><input type={type} defaultValue={value} readOnly={readOnly} className="w-full rounded-md border border-white/15 bg-[#101715] px-3 py-2.5 text-sm outline-none focus:border-[#C9A961] read-only:text-white/75" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="block"><span className="mb-2 block text-[11px] font-medium uppercase tracking-[.12em] text-white/60">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-white/15 bg-[#101715] px-3 py-2.5 text-sm outline-none focus:border-[#C9A961]">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Action({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} disabled={disabled} className="rounded-md bg-[#C9A961] px-5 py-2.5 text-sm font-semibold text-[#101715] disabled:cursor-not-allowed disabled:opacity-50">{children}</button>; }
function ErrorLine({ children }: { children: ReactNode }) { return <div className="mb-4 text-sm text-red-400">{children}</div>; }

export function OwnerScreen({ screen }: { screen: string }) {
  const current = screens.includes(screen as Screen) ? screen as Screen : "venue";
  const [status, setStatus] = useState("");
  const [gateId, setGateId] = useState(sampleVenue.gates[0]?.id ?? "");
  const [parkingId, setParkingId] = useState(sampleVenue.parking[0]?.id ?? "");
  const [entranceId, setEntranceId] = useState(sampleVenue.entrances[0]?.id ?? "");
  const [hotelId, setHotelId] = useState(sampleEvent.hotels[0]?.id ?? "");
  const [transportId, setTransportId] = useState(sampleEvent.transportOptions[0]?.id ?? "");
  const [entryIndex, setEntryIndex] = useState("0");
  const [documentType, setDocumentType] = useState<VenueDocumentType>("fire_noc");
  const [documentFile, setDocumentFile] = useState<File>();
  const [checking, setChecking] = useState(false);
  const [document, setDocument] = useState<VenueDocument>();
  const [registrationFile, setRegistrationFile] = useState<File>();
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [upload, setUpload] = useState<UploadResult>();

  const gate = sampleVenue.gates.find((item) => item.id === gateId) ?? sampleVenue.gates[0];
  const parking = sampleVenue.parking.find((item) => item.id === parkingId) ?? sampleVenue.parking[0];
  const entrance = sampleVenue.entrances.find((item) => item.id === entranceId) ?? sampleVenue.entrances[0];
  const hotel = sampleEvent.hotels.find((item) => item.id === hotelId) ?? sampleEvent.hotels[0];
  const transport = sampleEvent.transportOptions.find((item) => item.id === transportId) ?? sampleEvent.transportOptions[0];
  const entry = transport?.timetable[Number(entryIndex)] ?? transport?.timetable[0];
  const groupCount = useMemo(() => upload?.groups.length, [upload]);

  async function save() {
    setStatus("");
    if (current === "venue") {
      const parsed = VenueSchema.safeParse(sampleVenue);
      if (!parsed.success) { setStatus("Check venue"); return; }
      await saveVenue(parsed.data);
      setStatus("Venue saved");
    } else if (current === "event") {
      const parsed = EventSchema.safeParse(sampleEvent);
      if (!parsed.success) { setStatus("Check event"); return; }
      await saveEvent(parsed.data);
      setStatus("Event saved");
    }
  }

  async function checkDocument() {
    if (!documentFile) return;
    setChecking(true); setStatus("");
    try { setDocument(await uploadDocument(documentFile, documentType)); }
    catch { setStatus("Check failed"); }
    finally { setChecking(false); }
  }

  async function chooseRegistrations(file?: File) {
    setStatus(""); setUpload(undefined); setPreview([]); setHeaders([]); setRegistrationFile(undefined);
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) { setStatus("Save as CSV"); return; }
    if (!name.endsWith(".csv")) { setStatus("Choose CSV"); return; }
    const text = await file.text();
    const parsed = Papa.parse<PreviewRow>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) { setStatus("Check CSV"); return; }
    setHeaders(parsed.meta.fields ?? []); setPreview(parsed.data.slice(0, 5)); setRegistrationFile(file);
  }

  async function uploadFile() {
    if (!registrationFile) return;
    setStatus("");
    try { setUpload(await uploadRegistrations(registrationFile, sampleEvent, sampleVenue)); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Upload failed"); }
  }

  return <main className="min-h-screen bg-[#101715] px-6 py-8 text-[#f5f6f3] lg:px-12"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[190px_1fr]"><aside className="border-b border-white/10 pb-6 lg:border-b-0 lg:border-r lg:pb-0"><p className="mb-8 text-xs font-bold uppercase tracking-[.22em] text-[#C9A961]">{APP_NAME}</p><nav className="flex gap-2 lg:block lg:space-y-2">{screens.map((item, index) => <a key={item} href={`/owner/${item}`} className={`block rounded-lg px-3 py-2 text-sm ${item === current ? "bg-[#C9A961] text-[#101715]" : "text-white/60 hover:bg-white/5"}`}><span className="mr-3 text-xs">0{index + 1}</span>{labels[item]}</a>)}</nav></aside><section><h1 className="mb-8 text-3xl font-medium">{labels[current]}</h1>{status && <ErrorLine>{status}</ErrorLine>}
    {current === "venue" && <><Card><div className="grid gap-4 md:grid-cols-2"><Field label="Venue name" value={sampleVenue.name}/><Field label="City" value={sampleVenue.city}/><Field label="Total area" value={sampleVenue.totalAreaM2.value} trust={sampleVenue.totalAreaM2.trust} type="number"/><Field label="Capacity" value={sampleVenue.capacity.value} trust={sampleVenue.capacity.trust} type="number"/></div></Card><Card><div className="grid gap-4 md:grid-cols-3"><SelectField label="Gate" value={gateId} onChange={setGateId} options={sampleVenue.gates.map((item) => ({ value: item.id, label: item.name }))}/>{gate && <><Field label="Lanes" value={gate.lanes.value} trust={gate.lanes.trust} type="number"/><Field label="Forecourt area" value={gate.forecourtAreaM2.value} trust={gate.forecourtAreaM2.trust} type="number"/></>}</div></Card><Card><div className="grid gap-4 md:grid-cols-3"><SelectField label="Parking" value={parkingId} onChange={setParkingId} options={sampleVenue.parking.map((item) => ({ value: item.id, label: item.name }))}/>{parking && <><Field label="Parking spaces" value={parking.capacity.value} trust={parking.capacity.trust} type="number"/><Field label="Parking area" value={parking.areaM2.value} trust={parking.areaM2.trust} type="number"/></>}</div></Card><Card><div className="grid gap-4 md:grid-cols-3"><SelectField label="Entrance" value={entranceId} onChange={setEntranceId} options={sampleVenue.entrances.map((item) => ({ value: item.id, label: item.name }))}/>{entrance && <><Field label="Transport links" value={entrance.transportPointIds.join(", ")} readOnly/><Field label="Gate links" value={entrance.gateIds.join(", ")} readOnly/></>}</div></Card><Action onClick={save}>Save venue</Action></>}
    {current === "documents" && <><Card><div className="grid gap-4 md:grid-cols-2"><SelectField label="Document type" value={documentType} onChange={(value) => setDocumentType(value as VenueDocumentType)} options={[{ value: "fire_noc", label: "Fire NOC" }, { value: "occupancy_cert", label: "Occupancy certificate" }]}/><label><span className="mb-2 block text-[11px] font-medium uppercase tracking-[.12em] text-white/60">File</span><input type="file" accept="application/pdf,image/*" onChange={(event) => setDocumentFile(event.target.files?.[0])} className="block w-full text-sm text-white/65" /></label></div></Card>{checking && <div className="mb-5 text-sm text-[#C9A961]">Checking...</div>}{document && <Card><div className="grid gap-4 md:grid-cols-3">{Object.entries(document.extractedFields).map(([key, value]) => <Field key={key} label={key.replaceAll("_", " ")} value={value} readOnly/>)}</div>{document.mismatchFlags.map((flag) => <ErrorLine key={flag}>{flag.replaceAll("_", " ")}</ErrorLine>)}</Card>}<Action onClick={checkDocument} disabled={!documentFile || checking}>Check document</Action></>}
    {current === "event" && <><Card><div className="grid gap-4 md:grid-cols-3"><Field label="Event name" value={sampleEvent.name}/><Field label="Venue" value={sampleVenue.name} readOnly/><Field label="Date" value={sampleEvent.date} type="date"/><Field label="Gates open" value={sampleEvent.gatesOpen} type="time"/><Field label="Start time" value={sampleEvent.showStart} type="time"/><Field label="End time" value={sampleEvent.endTime} type="time"/></div></Card><Card><div className="grid gap-4 md:grid-cols-3"><SelectField label="Hotel" value={hotelId} onChange={setHotelId} options={sampleEvent.hotels.map((item) => ({ value: item.id, label: item.name }))}/>{hotel && <><Field label="Rooms" value={hotel.rooms.value} trust={hotel.rooms.trust} type="number"/><Field label="Occupied" value={hotel.occupied.value} trust={hotel.occupied.trust} type="number"/><Field label="Distance" value={hotel.distanceToVenueM.value} trust={hotel.distanceToVenueM.trust} type="number"/><Field label="Coach option" value={hotel.coachOption ? "Yes" : "No"} readOnly/></>}</div></Card><Card><div className="grid gap-4 md:grid-cols-3"><SelectField label="Transport" value={transportId} onChange={(value) => { setTransportId(value); setEntryIndex("0"); }} options={sampleEvent.transportOptions.map((item) => ({ value: item.id, label: item.mode }))}/>{transport && <SelectField label="Timetable" value={entryIndex} onChange={setEntryIndex} options={transport.timetable.map((item, index) => ({ value: String(index), label: item.arrivalTime }))}/>} {entry && <Field label="Pulse size" value={entry.pulseSize.value} trust={entry.pulseSize.trust} type="number"/>}</div></Card><Action onClick={save}>Save event</Action></>}
    {current === "registrations" && <><Card><label><span className="mb-2 block text-[11px] font-medium uppercase tracking-[.12em] text-white/60">Registration CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => chooseRegistrations(event.target.files?.[0])} className="block w-full text-sm text-white/65" /></label></Card>{preview.length > 0 && <Card><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-white/45"><tr>{headers.map((header) => <th key={header} className="pb-3 pr-5 font-medium">{header}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t border-white/10">{headers.map((header) => <td key={header} className="py-3 pr-5">{row[header]}</td>)}</tr>)}</tbody></table></div></Card>}{upload && <Card><div className="grid gap-4 md:grid-cols-3"><Field label="Kept" value={upload.keptRows} readOnly/><Field label="Dropped" value={upload.dropped} readOnly/><Field label="Unrouted" value={upload.unroutedTotal} readOnly/><Field label="Group count" value={groupCount ?? 0} readOnly/></div></Card>}<Action onClick={uploadFile} disabled={!registrationFile}>Upload</Action></>}
  </section></div></main>;
}
