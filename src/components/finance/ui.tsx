type Tone = 'primary' | 'secondary' | 'error' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  error: 'text-error',
  neutral: 'text-ink',
};

export function StatCard({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="glass-panel p-4 sm:p-5 min-w-0">
      <p className="text-ink/50 text-xs font-label uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-headline text-xl sm:text-2xl font-bold break-words ${TONE_CLASSES[tone]}`}>{value}</p>
      {hint && <p className="text-ink/40 text-xs font-label mt-1">{hint}</p>}
    </div>
  );
}
