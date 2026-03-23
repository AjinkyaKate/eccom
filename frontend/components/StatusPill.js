const toneClasses = {
  soft: 'border-palette-light bg-palette-lighter text-palette-dark',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
};

export default function StatusPill({ children, tone = 'soft' }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold capitalize ${toneClasses[tone] || toneClasses.soft}`}
    >
      {children}
    </span>
  );
}
