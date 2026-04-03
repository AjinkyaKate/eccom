export default function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="space-y-1">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-palette-primary/65">{eyebrow}</p>
      ) : null}
      <h2 className="text-xl font-semibold tracking-tight text-palette-dark">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-6 text-palette-dark/75">{description}</p> : null}
    </div>
  );
}
