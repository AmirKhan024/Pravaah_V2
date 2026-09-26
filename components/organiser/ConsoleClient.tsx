'use client';

import { useCallback, useEffect, useState } from 'react';
import { approveAction, getConsoleState, getFrames, getOrders, publishPlan, skipAction, submitReport } from '../../lib/organiser/api';
import { APP_NAME } from '../../config/app';
import type { ConsoleState, GroundReportSubmission, OrderView, ZoneFrame } from '../../lib/organiser/types';
import ConsoleNav, { type ConsoleScreen } from './ConsoleNav';
import GroundReportScreen from './GroundReportScreen';
import OrdersScreen from './OrdersScreen';
import OverviewScreen from './OverviewScreen';
import ServiceDetailScreen from './ServiceDetailScreen';
import TimeScreen from './TimeScreen';

type Props = {
  eventId: string;
};

export default function ConsoleClient({ eventId }: Props) {
  const [state, setState] = useState<ConsoleState | null>(null);
  const [frames, setFrames] = useState<ZoneFrame[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [screen, setScreen] = useState<ConsoleScreen>('overview');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const loadAll = useCallback(() => Promise.all([getConsoleState(eventId), getFrames(eventId), getOrders(eventId)]), [eventId]);

  const refresh = useCallback(async () => {
    const [nextState, nextFrames, nextOrders] = await loadAll();
    setState(nextState);
    setFrames(nextFrames);
    setOrders(nextOrders);
  }, [loadAll]);

  useEffect(() => {
    let ignore = false;
    loadAll().then(([nextState, nextFrames, nextOrders]) => {
      if (ignore) return;
      setState(nextState);
      setFrames(nextFrames);
      setOrders(nextOrders);
    });
    return () => {
      ignore = true;
    };
  }, [loadAll]);

  if (!state) {
    return <div className="p-10 text-[#F5F5F0]/50">Loading…</div>;
  }

  function selectScreen(next: ConsoleScreen) {
    setSelectedServiceId(null);
    setScreen(next);
  }

  function selectService(serviceId: string) {
    setSelectedServiceId(serviceId);
    setScreen('service');
  }

  async function handleDo(actionId: string) {
    await approveAction(eventId, actionId);
    await refresh();
  }

  async function handleSkip(actionId: string) {
    await skipAction(eventId, actionId);
    await refresh();
  }

  async function handlePublish() {
    await publishPlan(eventId);
    await refresh();
  }

  async function handleReport(report: GroundReportSubmission) {
    await submitReport(eventId, report);
  }

  const selectedService = state.services.find((service) => service.id === selectedServiceId) ?? null;

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-[#F5F5F0]/50">{APP_NAME}</span>
        <span className="text-sm text-[#F5F5F0]/50">{state.eventName}</span>
      </header>

      <ConsoleNav active={screen} onSelect={selectScreen} />

      {screen === 'overview' ? <OverviewScreen state={state} onSelectService={selectService} onPublish={handlePublish} /> : null}

      {screen === 'service' && selectedService ? (
        <ServiceDetailScreen service={selectedService} onDo={handleDo} onSkip={handleSkip} onBack={() => selectScreen('overview')} />
      ) : null}

      {screen === 'time' ? <TimeScreen services={state.services} frames={frames} onBack={() => selectScreen('overview')} /> : null}

      {screen === 'ground' ? <GroundReportScreen onSubmit={handleReport} onBack={() => selectScreen('overview')} /> : null}

      {screen === 'orders' ? <OrdersScreen orders={orders} onBack={() => selectScreen('overview')} /> : null}
    </div>
  );
}
