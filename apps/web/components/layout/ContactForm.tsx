"use client";

import { useState } from "react";

// PLACEHOLDER inbox — replace with your real address. The form has no backend;
// it opens the visitor's mail client pre-filled via mailto:.
const CONTACT_EMAIL = "hello@slovey.dev";

export function ContactForm({ salesIntent }: { salesIntent?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = salesIntent ? "Talk to sales — Slovey" : "Slovey enquiry";
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[15px] text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)]";

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      <div>
        <label htmlFor="cf-name" className="text-sm font-medium text-[var(--cb-text)]">Name</label>
        <input id="cf-name" required value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Your name" autoComplete="name" />
      </div>
      <div>
        <label htmlFor="cf-email" className="text-sm font-medium text-[var(--cb-text)]">Work email</label>
        <input id="cf-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@company.com" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="cf-message" className="text-sm font-medium text-[var(--cb-text)]">Message</label>
        <textarea id="cf-message" required value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={field} placeholder={salesIntent ? "Tell us about your team and what you're evaluating." : "How can we help?"} />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-[44px] items-center rounded-lg bg-[var(--primary)] px-5 py-2.5 font-medium text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        Send message
      </button>
      <p className="text-sm text-[var(--text-muted)]">
        Or email us directly at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--primary)] underline">{CONTACT_EMAIL}</a>.
      </p>
    </form>
  );
}
