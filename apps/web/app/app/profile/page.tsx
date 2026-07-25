"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { fetchMe, type Me } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/utils";
import { Building2, ImagePlus, LogOut, Mail, User } from "lucide-react";

const ROLE_VARIANT: Record<string, "primary" | "approved" | "default" | "suggested"> = {
  owner: "primary",
  admin: "approved",
  member: "default",
  viewer: "suggested",
};

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    setSaved(null);
    if (!file.type.startsWith("image/")) {
      setSaved("That file isn't an image — use a PNG or JPG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSaved("Image is too large — 2 MB max.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/me/avatar", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Upload failed");
      setAvatarUrl(body.url); // already saved server-side; state just updates the preview
      setSaved("Profile picture updated.");
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((m) => !cancelled && setMe(m))
      .finally(() => !cancelled && setLoading(false));
    // Load any custom name/avatar the user has already set (Supabase user_metadata).
    createSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled) return;
        const meta = (data.user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; avatar_url?: string };
        setDisplayName(meta.display_name ?? meta.full_name ?? "");
        setAvatarUrl(meta.avatar_url ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    setSaved(null);
    const { error } = await createSupabaseBrowser().auth.updateUser({
      data: { display_name: displayName.trim() || null, avatar_url: avatarUrl.trim() || null },
    });
    setSaving(false);
    setSaved(error ? `Couldn't save — ${error.message}` : "Saved. Your name and picture are updated.");
  }

  const memberships = me?.memberships ?? [];
  const shownAvatar = avatarUrl.trim() || me?.avatarUrl;
  const shownName = displayName.trim() || (me?.login ? `@${me.login}` : loading ? "…" : "unknown");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Identity */}
      <section className="card p-5 flex items-center gap-4">
        {shownAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shownAvatar} alt="" className="w-16 h-16 rounded-full shrink-0 object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center shrink-0">
            <User size={24} className="text-[var(--text-muted)]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--cb-text)] truncate">
            {shownName}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[var(--text-muted)]">
            {me?.email && (
              <span className="flex items-center gap-1">
                <Mail size={12} />
                {me.email}
              </span>
            )}
            {me?.githubId && (
              <span className="label-mono">GitHub ID {me.githubId}</span>
            )}
            {me?.isDev && <Badge variant="suggested">dev mode</Badge>}
          </div>
        </div>
      </section>

      {/* Edit profile */}
      <section className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--cb-text)]">Edit profile</h3>
        <label className="block">
          <span className="text-xs text-[var(--text-muted)]">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--cb-text)] focus:outline-none focus:border-[var(--primary)]"
          />
        </label>
        <div>
          <span className="text-xs text-[var(--text-muted)]">Profile picture</span>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) uploadAvatar(file);
            }}
            className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                : "border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[var(--primary)]"
            }`}
          >
            <ImagePlus size={20} className="text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--cb-text)]">
              {uploading ? "Uploading…" : "Drop an image here, or click to choose a file"}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">PNG, JPG, WebP, or GIF — up to 2 MB</span>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAvatar(file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && <span className="text-xs text-[var(--text-muted)]">{saved}</span>}
        </div>
      </section>

      {/* Memberships */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--cb-text)]">
            Organizations{" "}
            <span className="text-[var(--text-muted)] font-normal">({memberships.length})</span>
          </h3>
        </div>
        {memberships.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            {loading
              ? "Loading…"
              : me?.isDev
                ? "Running in dev mode — sign in with GitHub to see your organizations."
                : "You aren't a member of any organization yet."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {memberships.map((m) => (
              <li key={m.orgId} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
                  <Building2 size={14} className="text-[var(--primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--cb-text)] truncate">{m.orgName}</p>
                  <p className="label-mono text-xs text-[var(--text-muted)]">@{m.orgSlug}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)] hidden sm:block">
                  joined {formatRelativeTime(m.joinedAt)}
                </span>
                <Badge variant={ROLE_VARIANT[m.role] ?? "default"}>{m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sign out */}
      {!me?.isDev && (
        <section className="card p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--cb-text)]">Sign out</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">End your session on this device.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              createSupabaseBrowser()
                .auth.signOut()
                .then(() => window.location.assign("/"))
            }
          >
            <LogOut size={13} />
            Sign out
          </Button>
        </section>
      )}
    </div>
  );
}
