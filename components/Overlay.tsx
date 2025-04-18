'use client';

export default function MarbleOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="w-full h-full bg-[url('/marble.png')] bg-repeat opacity-5 mix-blend-multiply" />
    </div>
  );
}
