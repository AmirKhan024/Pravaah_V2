import { UploadResultSchema, type Event, type UploadResult, type Venue, type VenueDocument, type VenueDocumentType } from "@/contract/schemas";
import eventSample from "@/contract/samples/event-stadium.json";
import documentSample from "@/contract/samples/venue-document.json";
import venueSample from "@/contract/samples/venue-stadium.json";

export const sampleVenue = venueSample as Venue;
export const sampleEvent = eventSample as Event;

export async function saveVenue(_venue: Venue): Promise<Venue> {
  return sampleVenue;
}

export async function uploadDocument(_file: File, type: VenueDocumentType): Promise<VenueDocument> {
  return { ...(documentSample as VenueDocument), type };
}

export async function saveEvent(_event: Event): Promise<Event> {
  return sampleEvent;
}

export async function uploadRegistrations(file: File, event: Event, venue: Venue): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
  body.set("event", JSON.stringify(event));
  body.set("venue", JSON.stringify(venue));
  const response = await fetch("/api/registrations/upload", { method: "POST", body });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload ? String(payload.error) : "Upload failed";
    throw new Error(message);
  }
  return UploadResultSchema.parse(payload);
}
