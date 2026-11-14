"use client";

import { PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { useState } from "react";

const CONTACT_EMAIL = "support@slovey.dev";

/** Opens the visitor's mail app with the message filled in (there is no form backend). */
export function ContactForm({ sales }: { sales?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  return (
    <form
      style={{ display: "grid", gap: 16, maxWidth: 560 }}
      onSubmit={(e) => {
        e.preventDefault();
        const subject = sales ? "Slovey for our team" : "Hello from slovey.dev";
        const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }}
    >
      <label className="ui-field">
        <span>Name</span>
        <input className="ui-input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </label>
      <label className="ui-field">
        <span>Work email</span>
        <input className="ui-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </label>
      <label className="ui-field">
        <span>Message</span>
        <textarea
          className="ui-textarea"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={sales ? "How big is the team, and which tools do you use?" : "How can we help?"}
        />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button type="submit" className="ui-btn ui-btn--light ui-btn--lg">
          <PaperPlaneTiltIcon size={16} weight="fill" /> Send message
        </button>
        <span className="ui-small">
          Or write to <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--ice)" }}>{CONTACT_EMAIL}</a>
        </span>
      </div>
    </form>
  );
}
