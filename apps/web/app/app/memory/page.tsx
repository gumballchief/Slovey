"use client";

import { useEffect, useMemo, useState } from "react";
import type { Decision } from "@/lib/data";
import { useRepo } from "@/app/app/RepoProvider";
import {
  fetchDecisions,
  createDecision,
  updateDecision,
  deleteDecision,
  importDocs,
} from "@/lib/api-client";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BookOpen,
  ExternalLink,
  CheckCircle,
  Sparkles,
  Filter,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  github_pr: "GitHub PR",
  doc: "Docs",
  linear: "Linear",
  notion: "Notion",
  slack: "Slack",
  jira: "Jira",
  confluence: "Confluence",
  discord: "Discord",
  repo_analysis: "Repo Analysis",
  manual: "Manual",
};

const SOURCE_COLORS: Record<string, "default" | "primary" | "approved" | "suggested"> = {
  github_pr: "primary",
  doc: "approved",
  linear: "default",
  notion: "default",
  slack: "default",
  jira: "default",
  confluence: "default",
  discord: "default",
  repo_analysis: "suggested",
  manual: "primary",
};

interface FormState {
  id?: string;
  decision: string;
  why: string;
  evidence: string;
}

const EMPTY_FORM: FormState = { decision: "", why: "", evidence: "" };

export default function MemoryPage() {
  const { activeRepoId } = useRepo();
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function doImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const r = await importDocs(activeRepoId, importText);
      setImportMsg(
        `Imported ${r.extracted} decision${r.extracted !== 1 ? "s" : ""} from ${r.docs} doc${r.docs !== 1 ? "s" : ""} → review them in Review.`,
      );
      setImportText("");
      load();
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function load() {
    fetchDecisions(activeRepoId).then(setDecisions);
  }
  useEffect(load, [activeRepoId]);

  const filtered = useMemo(() => {
    return decisions.filter((d) => {
      const matchesQuery =
        !query ||
        d.decision.toLowerCase().includes(query.toLowerCase()) ||
        d.why.toLowerCase().includes(query.toLowerCase()) ||
        d.evidence.some((e) => e.toLowerCase().includes(query.toLowerCase()));
      const matchesSource = sourceFilter === "all" || d.source === sourceFilter;
      return matchesQuery && matchesSource;
    });
  }, [decisions, query, sourceFilter]);

  const sources = ["all", ...Array.from(new Set(decisions.map((d) => d.source)))];

  async function save() {
    if (!form || !form.decision.trim()) return;
    setSaving(true);
    setError(null);
    const evidence = form.evidence
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    try {
      if (form.id) {
        await updateDecision(activeRepoId, form.id, {
          decision: form.decision.trim(),
          why: form.why.trim(),
          evidence,
        });
      } else {
        await createDecision(activeRepoId, {
          decision: form.decision.trim(),
          why: form.why.trim(),
          evidence,
          source: "manual",
        });
      }
      setForm(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this decision from memory?")) return;
    try {
      await deleteDecision(activeRepoId, id);
      load();
    } catch {
      /* no-op; list stays as-is */
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          placeholder="Search decisions, reasons, PRs…"
          value={query}
          onChange={setQuery}
          className="flex-1"
        />
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={14} className="text-[var(--text-muted)]" />
          <div className="flex gap-1">
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
                  sourceFilter === s
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--cb-text)] border border-[var(--border)]"
                }`}
              >
                {s === "all" ? "All" : (SOURCE_LABELS[s] ?? s)}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setImportOpen((v) => !v);
              setImportMsg(null);
            }}
          >
            <Upload size={13} />
            Import
          </Button>
          <Button size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
            <Plus size={13} />
            Add
          </Button>
        </div>
      </div>

      {/* Import docs → proposed decisions (review queue) */}
      {importOpen && (
        <div className="card p-5 space-y-3 border-[var(--primary)]/30">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--cb-text)]">Import existing docs</h2>
            <button
              onClick={() => setImportOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--cb-text)] cursor-pointer"
              aria-label="Close import"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Paste ADRs, RFCs, or architecture docs (Markdown). Split into one document per{" "}
            <code className="font-mono">#</code> heading. Extracted decisions enter as{" "}
            <strong>proposed</strong> and appear in <strong>Review</strong> for confirmation.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"# ADR 1: Use PostgreSQL\nWe chose Postgres over Mongo because…\n\n# ADR 2: Reject Redis\nRedis was rejected because…"}
            rows={8}
            className="w-full text-sm font-mono rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
          />
          {importMsg && <p className="text-xs text-[var(--primary)]">{importMsg}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(false)}>
              Close
            </Button>
            <Button size="sm" disabled={importing || !importText.trim()} onClick={doImport}>
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      )}

      {/* Add / edit form */}
      {form && (
        <div className="card p-5 space-y-3 border-[var(--primary)]/30">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--cb-text)]">
              {form.id ? "Edit decision" : "New decision"}
            </h2>
            <button
              onClick={() => setForm(null)}
              className="text-[var(--text-muted)] hover:text-[var(--cb-text)] cursor-pointer"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            value={form.decision}
            onChange={(e) => setForm({ ...form, decision: e.target.value })}
            placeholder="The decision, e.g. “No platform deploy configs (fly.toml, vercel.json) in the repo.”"
            rows={2}
            className="w-full text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
          />
          <textarea
            value={form.why}
            onChange={(e) => setForm({ ...form, why: e.target.value })}
            placeholder="Why (the rationale the warning will cite)"
            rows={2}
            className="w-full text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
          />
          <input
            value={form.evidence}
            onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            placeholder="Evidence, comma-separated (e.g. PR #1234, https://…)"
            className="w-full text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[var(--cb-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
          />
          {error && <p className="text-xs text-[#F43F5E]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving || !form.decision.trim()} onClick={save}>
              {saving ? "Saving…" : form.id ? "Save changes" : "Add decision"}
            </Button>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-[var(--text-muted)]">
        {filtered.length} decision{filtered.length !== 1 ? "s" : ""} in memory
        {query && ` matching "${query}"`}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title="No decisions found"
          description="Try a different search term, or add one manually."
        />
      ) : (
        <ul className="space-y-3 stagger" key={query + sourceFilter}>
          {filtered.map((d) => (
            <li key={d.id} className="card card-hover p-5 space-y-3">
              {/* Top row */}
              <div className="flex items-start gap-3 justify-between">
                <p className="text-sm font-semibold text-[var(--cb-text)] leading-snug flex-1">
                  {d.decision}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={SOURCE_COLORS[d.source] ?? "default"}>
                    {SOURCE_LABELS[d.source] ?? d.source}
                  </Badge>
                  {d.status && (
                    <Badge variant={d.status === "approved" ? "approved" : "suggested"}>
                      {d.status === "approved" ? (
                        <CheckCircle size={10} />
                      ) : (
                        <Sparkles size={10} />
                      )}
                      {d.status}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Why */}
              {d.why && (
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{d.why}</p>
              )}

              {/* Examples */}
              {d.examples.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Examples</p>
                  <ul className="space-y-1">
                    {d.examples.map((ex, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[var(--cb-text)]">
                        <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] mt-1.5 shrink-0" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Evidence + date + actions */}
              <div className="flex items-center justify-between pt-1 gap-3">
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {d.evidence.map((ev) => (
                    <span
                      key={ev}
                      className="font-mono text-xs bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded flex items-center gap-1"
                    >
                      <ExternalLink size={10} />
                      {ev}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[var(--text-muted)]">{formatDate(d.createdAt)}</span>
                  <button
                    onClick={() =>
                      setForm({
                        id: d.id,
                        decision: d.decision,
                        why: d.why,
                        evidence: d.evidence.join(", "),
                      })
                    }
                    className="text-[var(--text-muted)] hover:text-[var(--primary)] cursor-pointer"
                    aria-label="Edit decision"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="text-[var(--text-muted)] hover:text-[#F43F5E] cursor-pointer"
                    aria-label="Delete decision"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
