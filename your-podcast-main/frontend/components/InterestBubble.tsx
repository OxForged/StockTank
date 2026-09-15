'use client';

export function InterestBubble({
  label,
  size,
  isSelected,
  onToggle,
}: {
  readonly label: string;
  readonly size: number;
  readonly isSelected: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      style={{ width: size, height: size }}
      className={`rounded-full border border-border-warm shadow-[0px_10px_15px_rgba(0,0,0,0.1),0px_4px_6px_rgba(0,0,0,0.1)] flex flex-col gap-2 items-center justify-center transition-colors ${
        isSelected ? 'bg-black text-white' : 'bg-white text-[#111]'
      }`}
    >
      <span className="font-serif text-sm leading-tight text-center px-2">
        {label}
      </span>
      <div
        aria-hidden="true"
        className={`h-1 w-4 rounded-full ${
          isSelected ? 'bg-white/20' : 'bg-[#111]/20'
        }`}
      />
    </button>
  );
}
