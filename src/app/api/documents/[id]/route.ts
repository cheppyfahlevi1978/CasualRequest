import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Issues a short-lived signed URL for a stored document (PRD §22, §39, §67).
 *
 * Authorization is not decided here: the SELECT below runs under the caller's
 * RLS policy, and the Storage policy is re-evaluated when the signed URL is
 * created. A user who cannot read the metadata row never reaches the object.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, bucket_name, object_path, file_name, is_deleted")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      bucket_name: string;
      object_path: string;
      file_name: string;
      is_deleted: boolean;
    }>();

  if (!doc || doc.is_deleted) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from(doc.bucket_name)
    .createSignedUrl(doc.object_path, 120, { download: doc.file_name });

  if (error || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Tautan dokumen tidak dapat dibuat saat ini." },
      { status: 502 },
    );
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    action: "OPEN_DOCUMENT",
    module: "documents",
    record_id: doc.id,
    description: `Signed URL issued for ${doc.file_name}`,
  });

  return NextResponse.redirect(signed.signedUrl, {
    headers: { "Cache-Control": "no-store" },
  });
}
