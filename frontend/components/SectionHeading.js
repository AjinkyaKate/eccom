export default function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="space-y-3">
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-palette-primary/65">{eyebrow}</p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-palette-dark md:text-4xl">{title}</h2>
      {description ? <p className="max-w-3xl text-base leading-8 text-palette-dark/75">{description}</p> : null}
    </div>
  );
}
