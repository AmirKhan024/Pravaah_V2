'use client';

import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** A side drawer for Ground report / Orders — the console has no tabs any more. */
export default function Drawer({ open, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-[#101715] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
