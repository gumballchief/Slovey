import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer, supabaseConfigured } from "@/lib/server/supabase";
import { HttpError, handle, ok } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Upload a profile picture. Stores the file in the public `avatars` bucket as
 * <auth-user-id>.<ext> (re-upload replaces it) and writes the public URL into
 * the user's metadata, so no client-side save step is needed afterwards.
 */
export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    if (!supabaseConfigured()) throw new HttpError(400, "Auth not configured");
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) throw new HttpError(401, "Unauthorized");

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
    const ext = ALLOWED[file.type];
    if (!ext) throw new HttpError(400, "Use a PNG, JPG, WebP, or GIF image");
    if (file.size > MAX_BYTES) throw new HttpError(400, "Image is too large — 2 MB max");

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new HttpError(500, "Storage not configured");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { persistSession: false },
    });

    // Bucket is created lazily on first upload; "already exists" is fine.
    await admin.storage.createBucket(BUCKET, { public: true }).catch(() => undefined);

    const path = `${user.id}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) throw new HttpError(500, `Upload failed: ${uploadError.message}`);

    // Cache-bust so the new picture shows immediately even at the same path.
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, avatar_url: url },
    });
    if (metaError) throw new HttpError(500, `Couldn't save picture: ${metaError.message}`);

    return ok({ url });
  });
}
