import type { Metadata } from "next";
import { ContactForm } from "@/features/site/ContactForm";
import { SitePage } from "@/features/site/Site";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact",
  description: "Talk to the Slovey team about questions, sales or feedback. We read every message.",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const sales = topic === "sales";
  return (
    <SitePage
      eyebrow={sales ? "Sales" : "Contact"}
      title={
        sales ? (
          <>
            Bring Slovey <span className="dim">to your team.</span>
          </>
        ) : (
          <>
            Talk to us. <span className="dim">We read everything.</span>
          </>
        )
      }
      lede={
        sales
          ? "Tell us what you're working with and we'll help you plan a rollout."
          : "Questions, feedback or partnership ideas. Send a note and we'll get back to you."
      }
      art="/art/obj-1.webp"
    >
      <ContactForm sales={sales} />
    </SitePage>
  );
}
