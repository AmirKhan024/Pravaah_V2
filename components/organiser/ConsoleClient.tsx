'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { approveAction, getConsoleState, getFrames, getOrders, publishPlan, skipAction, submitReport } from '../../lib/organiser/api';
import { buildFallbackFlowBoard } from '../../lib/organiser/flowBoardFallback';
import { LangContext, t } from '../../lib/organiser/messages';
import type { ConsoleLang, ConsoleState, GroundReportSubmission, OrderView, ZoneFrame } from '../../lib/organiser/types';
import Drawer from './Drawer';
import FlowBoard from './FlowBoard';
import GroundReportScreen from './GroundReportScreen';
import NowPanel from './NowPanel';
import OrdersScreen from './OrdersScreen';
import TimeStrip from './TimeStrip';
import TopBar from './TopBar';

type Props = {
  eventId: string;
};

export default function ConsoleClient({ eventId }: Props) {
  const [state, setState] = useState<ConsoleState | null>(null);
  const [frames, setFrames] = useState<ZoneFrame[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [lang, setLang] = useState<ConsoleLang>('en');
  const [minuteIndex, setMinuteIndex] = useState(0);
  const [focusedServiceId, setFocusedServiceId] = useState<string | null>(null);
  const [groundOpen, setGroundOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

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

  const flowBoard = useMemo(() => {
    if (!state) return null;
    return state.flowBoard ?? buildFallbackFlowBoard(state.services, frames, t('flow.venue_node', lang));
  }, [state, frames, lang]);

  if (!state || !flowBoard) {
    return <div className="p-10 text-[#F5F5F0]/50">{t('common.loading', lang)}</div>;
  }

  function selectService(serviceId: string) {
    const exists = state!.services.some((s) => s.id === serviceId);
    setFocusedServiceId((prev) => (!exists ? null : prev === serviceId ? null : serviceId));
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

  const index = Math.min(minuteIndex, Math.max(flowBoard.frames.length - 1, 0));

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-6 py-6">
        <TopBar state={state} onPublish={handlePublish} onOpenGroundReport={() => setGroundOpen(true)} onOpenOrders={() => setOrdersOpen(true)} />

        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          <div className="lg:w-[65%]">
            <FlowBoard nodes={flowBoard.nodes} links={flowBoard.links} frame={flowBoard.frames[index]} focusedServiceId={focusedServiceId} onSelectService={selectService} />
          </div>
          <div className="lg:w-[35%]">
            <NowPanel statusWord={state.statusWord} services={state.services} focusedServiceId={focusedServiceId} onDo={handleDo} onSkip={handleSkip} />
          </div>
        </div>

        <TimeStrip frames={frames} index={index} onChange={setMinuteIndex} />
      </div>

      <Drawer open={groundOpen} onClose={() => setGroundOpen(false)}>
        <GroundReportScreen onSubmit={handleReport} onBack={() => setGroundOpen(false)} />
      </Drawer>

      <Drawer open={ordersOpen} onClose={() => setOrdersOpen(false)}>
        <OrdersScreen orders={orders} onBack={() => setOrdersOpen(false)} />
      </Drawer>
    </LangContext.Provider>
  );
}
