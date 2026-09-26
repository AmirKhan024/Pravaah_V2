'use client';

import { useT } from '../../lib/organiser/messages';

type Props = {
  canPublish: boolean;
  published: boolean;
  onPublish: () => void;
};

export default function PublishButton({ canPublish, published, onPublish }: Props) {
  const t = useT();
  const disabled = !canPublish || published;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPublish}
      className={`w-full rounded-2xl py-4 text-lg font-semibold transition ${
        disabled ? 'cursor-not-allowed bg-white/5 text-[#F5F5F0]/30' : 'bg-[#C9A961] text-[#101715] hover:brightness-110'
      }`}
    >
      {published ? t('overview.published') : t('overview.publish')}
    </button>
  );
}
