/**
 * The Slovey logo glyph — the landing nav's white graph mark (three nodes,
 * three edges). Use inside a rounded square filled with var(--primary).
 */
export function LogoGlyph({ size = 19, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="6" cy="7.5" r="2.1" />
      <circle cx="18" cy="7.5" r="2.1" />
      <circle cx="12" cy="16.5" r="2.1" />
      <path d="M7.8 9.1 10.5 14.6" />
      <path d="M16.2 9.1 13.5 14.6" />
      <path d="M8.1 7.5h7.8" />
    </svg>
  );
}
