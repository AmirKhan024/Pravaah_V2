import { UploadResultSchema, type Event, type UploadResult, type Venue, type VenueDocument, type VenueDocumentType } from "@/contract/schemas";
import eventSample from "@/contract/samples/event-stadium.json";
import documentSample from "@/contract/samples/venue-document.json";
import venueSample from "@/contract/samples/venue-stadium.json";

export const sampleVenue = venueSample as Venue;
export const sampleEvent = eventSample as Event;
export const sampleDocument = documentSample as VenueDocument;

export async function saveVenue(venue: Venue): Promise<Venue> {
  const normalizeTrusted = <T>(item: { value: T; trust?: string }): { value: T; trust: "claimed" | "documented" | "observed" } => ({
    value: item.value,
    trust: (item.trust === "documented" || item.trust === "observed") ? item.trust : "claimed",
  });

  const saved: Venue = {
    ...venue,
    totalAreaM2: normalizeTrusted(venue.totalAreaM2),
    capacity: normalizeTrusted(venue.capacity),
    gates: venue.gates.map((g) => ({
      ...g,
      lanes: normalizeTrusted(g.lanes),
      laneRate: normalizeTrusted(g.laneRate),
      forecourtAreaM2: normalizeTrusted(g.forecourtAreaM2),
    })),
    parking: venue.parking.map((p) => ({
      ...p,
      capacity: normalizeTrusted(p.capacity),
      areaM2: normalizeTrusted(p.areaM2),
    })),
  };
  return saved;
}

export async function uploadDocument(_file: File, type: VenueDocumentType): Promise<VenueDocument> {
  return { ...(documentSample as VenueDocument), type };
}

export async function saveEvent(event: Event): Promise<Event> {
  const normalizeTrusted = <T>(item: { value: T; trust?: string }): { value: T; trust: "claimed" | "documented" | "observed" } => ({
    value: item.value,
    trust: (item.trust === "documented" || item.trust === "observed") ? item.trust : "claimed",
  });

  const saved: Event = {
    ...event,
    hotels: event.hotels.map((h) => ({
      ...h,
      rooms: normalizeTrusted(h.rooms),
      occupied: normalizeTrusted(h.occupied),
      distanceToVenueM: normalizeTrusted(h.distanceToVenueM),
      coachCapacity: h.coachCapacity ? normalizeTrusted(h.coachCapacity) : null,
    })),
    transportOptions: event.transportOptions.map((t) => ({
      ...t,
      timetable: t.timetable.map((entry) => ({
        ...entry,
        pulseSize: normalizeTrusted(entry.pulseSize),
      })),
    })),
  };
  return saved;
}

export async function uploadRegistrations(file: File, event: Event, venue: Venue): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
  body.set("event", JSON.stringify(event));
  body.set("venue", JSON.stringify(venue));
  const response = await fetch("/api/registrations/upload", { method: "POST", body });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload ? String((payload as { error?: unknown }).error) : "Upload failed";
    throw new Error(message);
  }
  return UploadResultSchema.parse(payload);
}

export async function runForecast(eventId: string): Promise<void> {
  let response = await fetch(`/api/events/${eventId}/simulate`, { method: "POST" });
  if (response.status === 405 || !response.ok) {
    const fallback = await fetch(`/api/events/${eventId}/simulate`, { method: "GET" });
    if (fallback.ok) response = fallback;
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = typeof payload === "object" && payload !== null && "error" in payload ? String((payload as { error?: unknown }).error) : "Forecast failed";
    throw new Error(message);
  }
}

export async function loadSampleRegistrations(): Promise<File> {
  const sampleCsv = `Full Name,Phone,Origin City,Mode of Travel,Hotel Name,Group Size,Gate Pref
Rohan Mehta,9885246579,Kharghar,Metro,None,2,Gate A
Vikram Rao,9831946174,Panvel,bus,Panvel Inn,2,Gate B
Sneha Kulkarni,9832295779,Vashi,Cab,None,3,Gate A
Amit Deshmukh,9807469462,Nerul,walk,None,5,Gate A
Kavita Naik,9809364134,Sanpada,train,None,2,Gate C`;
  return new File([sampleCsv], "registrations-sample.csv", { type: "text/csv" });
}
