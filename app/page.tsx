import HomeEntry from '../components/home/HomeEntry';
import { listEvents } from '../lib/server/home/listEvents';

export default async function Home() {
  const events = await listEvents();
  return (
    <div className="min-h-screen bg-[#101715] text-[#F5F5F0] antialiased">
      <HomeEntry events={events} />
    </div>
  );
}
