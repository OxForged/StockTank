export function CompassIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <polygon
        points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
        fill="currentColor"
      />
    </svg>
  );
}
