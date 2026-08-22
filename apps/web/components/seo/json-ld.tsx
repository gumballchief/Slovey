/**
 * Renders structured data as JSON-LD. Emitted server-side so crawlers that do
 * not execute JavaScript still see it.
 */
export function JsonLd({ schema }: { schema: object | readonly object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
