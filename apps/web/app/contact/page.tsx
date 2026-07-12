import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { ContactForm } from "@/components/layout/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Slovey",
  description: "Talk to the Slovey team — questions, sales, or feedback. We read every message.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const salesIntent = topic === "sales";

  return (
    <PageShell
      eyebrow="Company"
      title={salesIntent ? "Talk to sales" : "Contact us"}
      intro={
        salesIntent
          ? "Evaluating Slovey for your team? Tell us what you're working with and we'll help you scope a rollout."
          : "Questions, feedback, or partnership ideas — send us a note and we'll get back to you."
      }
    >
      <ContactForm salesIntent={salesIntent} />
    </PageShell>
  );
}
