'use client';

import { useT } from '../../lib/organiser/messages';
import type { OrderStatus } from '../../contract/schemas';
import type { OrderView } from '../../lib/organiser/types';
import SampleTag from './SampleTag';

const STATUS_TEXT_COLOR: Record<OrderStatus, string> = {
  pending: 'text-[#F5F5F0]/50',
  sent: 'text-[#F0B429]',
  confirmed: 'text-[#3DDC84]',
  failed: 'text-[#E5484D]',
};

type Props = {
  orders: OrderView[];
  onBack: () => void;
};

export default function OrdersScreen({ orders, onBack }: Props) {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start text-sm text-[#F5F5F0]/60 hover:text-[#F5F5F0]">
        {`< ${t('nav.back')}`}
      </button>

      <div className="flex flex-col divide-y divide-white/5 rounded-2xl border border-white/5">
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <span className="text-sm text-[#F5F5F0]/60">{order.serviceLabel}</span>
            <span className="flex-1 truncate text-[#F5F5F0]">{order.text}</span>
            <SampleTag sample={order.sample} />
            <span className={`text-sm font-medium capitalize ${STATUS_TEXT_COLOR[order.status]}`}>{order.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
