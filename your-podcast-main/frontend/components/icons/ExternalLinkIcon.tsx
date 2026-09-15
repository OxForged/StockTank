export function ExternalLinkIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 3H3.5C2.67 3 2 3.67 2 4.5v8c0 .83.67 1.5 1.5 1.5h8c.83 0 1.5-.67 1.5-1.5V10M9.5 2H14v4.5M14 2L6.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
