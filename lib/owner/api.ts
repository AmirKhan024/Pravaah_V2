import type { Event, Registration, Venue, VenueDocument, VenueDocumentType } from "@/contract/schemas";
import eventSample from "@/contract/samples/event-stadium.json";
import documentSample from "@/contract/samples/venue-document.json";
import venueSample from "@/contract/samples/venue-stadium.json";

export const sampleVenue = venueSample as Venue;
export const sampleEvent = eventSample as Event;
export async function saveVenue(value: Venue): Promise<Venue> { return value; }
export async function uploadDocument(_file: File, type: VenueDocumentType): Promise<VenueDocument> { return { ...(documentSample as VenueDocument), type }; }
export async function saveEvent(value: Event): Promise<Event> { return value; }
export async function uploadRegistrations(_file: File): Promise<Registration[]> {
  return Array.from({ length: 5 }, (_, i) => ({ id: `sample-${i}`, eventId: sampleEvent.id, raw: { Row: i + 1, Status: "Ready" }, normalized: { originArea: "", travelMode: "other", hotelId: null, groupSize: 1, gateHint: null } }));
}
