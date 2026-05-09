export function ScanlineOverlay() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40 grain" />
      <div className="pointer-events-none fixed inset-0 z-40 scanlines" />
    </>
  );
}
