/**
 * The Slovey logo mark — the real brand asset (public/slovey-mark.png, the
 * two-tone "S", background removed to transparent). `size` sets the height; the
 * width follows the mark's natural aspect ratio (549×859).
 */
export function LogoGlyph({ size = 30, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/slovey-mark.png"
      alt="Slovey"
      width={Math.round((size * 549) / 859)}
      height={size}
      className={className}
      style={{ display: "block", height: size, width: "auto" }}
    />
  );
}
