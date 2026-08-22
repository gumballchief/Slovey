import faqs from "@/components/landing/faqs.json";

import { SITE_URL } from "./site";

const DESCRIPTION =
  "Slovey records your team's engineering decisions as a structured graph and gates every AI-generated change before commit — blocking work that contradicts a decision the team already made.";

/** Site-wide identity. Rendered once, in the root layout. */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Slovey",
  url: SITE_URL,
  logo: `${SITE_URL}/slovey-logo.png`,
  description: DESCRIPTION,
  sameAs: ["https://github.com/gumballchief/slovey"],
} as const;

export const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Slovey",
  url: SITE_URL,
  description: DESCRIPTION,
} as const;

/**
 * The product itself. Deliberately carries no aggregateRating: there are no
 * reviews yet, and inventing them is both a Google structured-data violation
 * and a lie.
 */
export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Slovey",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Cross-platform (Node.js)",
  url: SITE_URL,
  description: DESCRIPTION,
  softwareHelp: `${SITE_URL}/docs`,
  license: "https://opensource.org/licenses/MIT",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "0",
      priceCurrency: "USD",
      description: "One repository, pre-commit review, basic decision graph.",
    },
    {
      "@type": "Offer",
      name: "Team",
      price: "19",
      priceCurrency: "USD",
      description:
        "Per user, per month, billed annually. Unlimited repositories, full decision graph, rule enforcement, MCP and API access.",
    },
  ],
} as const;

/**
 * Built from the same JSON the page renders, so the markup cannot drift out of
 * sync with the visible answers (which would make it ineligible for rich
 * results).
 */
export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: (faqs as Array<{ q: string; a: string }>).map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
} as const;
