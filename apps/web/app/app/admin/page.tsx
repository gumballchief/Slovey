"use client";

import { useEffect, useState } from "react";
import { adminSetPlan, fetchAdminOrgs, type AdminOrg, type OrgPlan } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ShieldCheck } from "lucide-react";

const PLAN_TONE: Record<OrgPlan, string> = {
  free: "text-[var(--text-muted)]",
  pro: "text-[var(--primary)]",
  enterprise: "text-[var(--cb-text)] font-semibold",
};

export default function AdminPage() {
  const [orgs, setOrgs] = useState<AdminOrg[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, OrgPlan>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminOrgs()
      .then(setOrgs)
      .catch((e) => {
        if (e instanceof Error && (e.message === "403" || e.message === "401")) setForbidden(true);
        else setNotice("Could not load organizations — try a refresh.");
        setOrgs([]);
      });
  }, []);

  async function save(org: AdminOrg) {
    const plan = drafts[org.id];
    if (!plan || plan === org.plan) return;
    setBusy(org.id);
    setNotice(null);
    try {
      await adminSetPlan(org.id, plan);
      setOrgs((os) => (os ? os.map((o) => (o.id === org.id ? { ...o, plan } : o)) : os));
      setNotice(`${org.name} is now on ${plan}.`);
    } catch {
      setNotice(`Failed to update ${org.name} — plan unchanged.`);
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="p-8 text-sm text-[var(--text-muted)]">
        This page is for Slovey staff only.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
        <h1 className="text-lg font-semibold text-[var(--cb-text)]">Admin — plans</h1>
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Set any workspace&apos;s plan, including Enterprise. Changes apply instantly and are audit-logged.
      </p>

      {notice && (
        <div className="mb-4 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[var(--cb-text)]">
          {notice}
        </div>
      )}

      {orgs === null ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : orgs.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No organizations yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)]">
                <th className="px-4 py-2.5 font-medium">Workspace</th>
                <th className="px-4 py-2.5 font-medium">Members</th>
                <th className="px-4 py-2.5 font-medium">Repos</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Change to</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-3">
                    <div className="text-[var(--cb-text)] font-medium">{org.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{org.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {org.members.length === 0
                      ? "—"
                      : org.members.map((m) => `${m.login} (${m.role})`).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{org.repos}</td>
                  <td className="px-4 py-3">
                    <Badge>
                      <span className={PLAN_TONE[org.plan]}>{org.plan}</span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={drafts[org.id] ?? org.plan}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [org.id]: e.target.value as OrgPlan }))
                      }
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--cb-text)] text-sm px-2 py-1.5"
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === org.id || (drafts[org.id] ?? org.plan) === org.plan}
                      onClick={() => save(org)}
                    >
                      {busy === org.id ? "Saving…" : "Save"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
