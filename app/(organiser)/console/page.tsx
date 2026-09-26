import ConsoleClient from '../../../components/organiser/ConsoleClient';
import { DEFAULT_EVENT_ID } from '../../../lib/organiser/sample';

export default async function ConsolePage({ searchParams }: PageProps<'/console'>) {
  const params = await searchParams;
  const eventParam = params.event;
  const eventId = typeof eventParam === 'string' ? eventParam : DEFAULT_EVENT_ID;

  return <ConsoleClient key={eventId} eventId={eventId} />;
}
