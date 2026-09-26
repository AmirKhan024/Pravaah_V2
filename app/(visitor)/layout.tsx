import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pravaah - Visitor Plan',
  description: 'Personalized event arrival and crowd plan',
};

export default function VisitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#101715] text-[#E5E7EB] flex flex-col items-center justify-start p-4 py-6">
      <div className="w-full max-w-[360px] min-w-[320px] flex flex-col gap-6">
        {children}
      </div>
    </div>
  );
}
