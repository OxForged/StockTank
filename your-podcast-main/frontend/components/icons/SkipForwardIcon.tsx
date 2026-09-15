export function SkipForwardIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Circular arrow pointing right/forward */}
      <path
        d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"
        fill="currentColor"
      />
      {/* "1" as path */}
      <path
        d="M9.5 16h1.3v-5.2L9.1 11.4v-1.1l1.8-.7h1v6.4h1.2v1H9.5v-1z"
        fill="currentColor"
      />
      {/* "5" as path */}
      <path
        d="M14.3 16.1c-.4.3-.9.4-1.5.4-.5 0-1-.1-1.3-.4-.4-.3-.6-.7-.6-1.2h1.2c0 .2.1.4.2.5.2.1.3.2.6.2.3 0 .5-.1.6-.3.2-.2.2-.5.2-.8 0-.3-.1-.6-.3-.8-.2-.2-.4-.3-.7-.3-.2 0-.4 0-.5.1l-.3.3h-1l.4-4h3.8v1h-2.9l-.2 1.8c.3-.2.6-.3 1-.3.6 0 1.1.2 1.4.6.4.4.5.9.5 1.5 0 .6-.2 1.1-.6 1.5z"
        fill="currentColor"
      />
    </svg>
  );
}
