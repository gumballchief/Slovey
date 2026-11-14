"use client";

import { GithubLogoIcon, SignOutIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createSupabaseBrowser, isAuthConfigured } from "@/lib/supabase-browser";
import { Page } from "@/features/shell/Page";
import { useRepo } from "@/features/shell/RepoProvider";
import { Badge, Button, ErrorState, RowsSkeleton, errorMessage, timeAgo } from "@/ui/kit";

export function Profile() {
  const { me, loading, error, reload } = useRepo();
  const auth = isAuthConfigured();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  // A custom name and picture live in the sign-in profile (Supabase user metadata).
  useEffect(() => {
    if (!auth) return;
    void createSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        const meta = (data.user?.user_metadata ?? {}) as { display_name?: string; full_name?: string; avatar_url?: string };
        setName(meta.display_name ?? meta.full_name ?? "");
        setAvatar(meta.avatar_url ?? null);
      });
  }, [auth]);

  async function upload(f: File) {
    if (!f.type.startsWith("image/")) return toast.error("Use a PNG or JPG.");
    if (f.size > 2 * 1024 * 1024) return toast.error("That image is over 2 MB.");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/me/avatar", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || `Upload failed (${res.status})`);
      setAvatar(body.url);
      toast.success("Picture updated.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  const picture = avatar ?? me?.avatarUrl ?? null;
  return (
    <Page eyebrow="Profile" title={me?.login ?? "Profile"} narrow>
      {loading && <RowsSkeleton rows={3} />}
      {error != null && <ErrorState error={error} onRetry={reload} title="Your profile didn't load" />}
      {me && (
        <div style={{ display: "grid", gap: 44 }}>
          <section className="ui-card ui-card--pad" style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              <span className="app-avatar" style={{ width: 72, height: 72, fontSize: 26 }} aria-hidden>
                {picture ? <img src={picture} alt="" /> : me.login.slice(0, 1).toUpperCase()}
              </span>
              <div style={{ display: "grid", gap: 4 }}>
                <div className="ui-h3" style={{ fontSize: 18 }}>{name || me.login}</div>
                <div className="ui-small">
                  {me.email ?? "No email on file"}
                  {me.githubId ? " · GitHub connected" : ""}
                </div>
              </div>
              {auth && (
                <div style={{ marginLeft: "auto" }}>
                  <input
                    ref={file}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" loading={uploading} icon={<UploadSimpleIcon size={14} />} onClick={() => file.current?.click()}>
                    Change picture
                  </Button>
                </div>
              )}
            </div>
            {auth && (
              <form
                style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  try {
                    const { error: err } = await createSupabaseBrowser().auth.updateUser({ data: { display_name: name.trim() } });
                    if (err) throw err;
                    toast.success("Saved.");
                  } catch (er) {
                    toast.error(errorMessage(er));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <label className="ui-field" style={{ flex: 1, minWidth: 220 }}>
                  <span>Display name</span>
                  <input className="ui-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={me.login} />
                </label>
                <Button type="submit" loading={saving}>
                  Save
                </Button>
              </form>
            )}
          </section>

          <section className="ui-section">
            <h2 className="ui-title ui-title--sm">Workspaces</h2>
            {me.memberships.length === 0 ? (
              <p className="ui-small">You&apos;re not in a workspace yet. Install the GitHub app on a repository to create one.</p>
            ) : (
              <ul className="ui-rows">
                {me.memberships.map((m) => (
                  <li key={m.orgId} className="ui-row" style={{ cursor: "default", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
                    <span>
                      <span className="ui-row-title" style={{ display: "block" }}>{m.orgName}</span>
                      <span className="ui-row-sub">@{m.orgSlug} · joined {timeAgo(m.joinedAt)}</span>
                    </span>
                    <Badge tone={m.role === "owner" ? "blue" : undefined}>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {auth && (
            <section className="ui-section">
              <h2 className="ui-title ui-title--sm">Sign-in</h2>
              <div className="ui-card" style={{ padding: "4px 20px" }}>
                <div className="ui-setting">
                  <div>
                    <div className="t">GitHub</div>
                    <div className="d">
                      {me.githubId
                        ? "Connected. Reconnect if your repositories or organizations look out of date."
                        : "Connect GitHub to see your repositories. Google and email sign-ins can't reach them."}
                    </div>
                  </div>
                  <Button
                    icon={<GithubLogoIcon size={15} weight="fill" />}
                    onClick={() =>
                      void createSupabaseBrowser().auth.signInWithOAuth({
                        provider: "github",
                        options: { redirectTo: `${window.location.origin}/auth/callback?next=/app/profile` },
                      })
                    }
                  >
                    {me.githubId ? "Reconnect" : "Connect GitHub"}
                  </Button>
                </div>
                <div className="ui-setting">
                  <div>
                    <div className="t">Sign out</div>
                    <div className="d">Signs you out on this browser.</div>
                  </div>
                  <Button
                    icon={<SignOutIcon size={15} />}
                    onClick={async () => {
                      await createSupabaseBrowser().auth.signOut();
                      window.location.assign("/");
                    }}
                  >
                    Sign out
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
