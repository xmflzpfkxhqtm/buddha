'use client';

export default function MarbleOverlay() {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="w-full h-full bg-[url('/marble.png')] bg-repeat opacity-40 mix-blend-multiply" />
    </div>
  );
}
