interface Props {
  size?: number;
  className?: string;
}

export function CornerTicks({ size = 10, className = '' }: Props) {
  const s = `${size}px`;
  const stroke = 'var(--accent-yellow)';
  const common = 'absolute pointer-events-none';
  return (
    <>
      <span
        className={`${common} ${className}`}
        style={{
          top: 0,
          left: 0,
          width: s,
          height: s,
          borderTop: `1px solid ${stroke}`,
          borderLeft: `1px solid ${stroke}`,
        }}
      />
      <span
        className={`${common} ${className}`}
        style={{
          top: 0,
          right: 0,
          width: s,
          height: s,
          borderTop: `1px solid ${stroke}`,
          borderRight: `1px solid ${stroke}`,
        }}
      />
      <span
        className={`${common} ${className}`}
        style={{
          bottom: 0,
          left: 0,
          width: s,
          height: s,
          borderBottom: `1px solid ${stroke}`,
          borderLeft: `1px solid ${stroke}`,
        }}
      />
      <span
        className={`${common} ${className}`}
        style={{
          bottom: 0,
          right: 0,
          width: s,
          height: s,
          borderBottom: `1px solid ${stroke}`,
          borderRight: `1px solid ${stroke}`,
        }}
      />
    </>
  );
}
