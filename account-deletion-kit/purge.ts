// Supabase-side erasure: storage objects, application rows, then the auth user.

import { CONFIG, type SupabaseLike } from "./config.ts";
import type { StepResult } from "./brevo.ts";

/** Storage listing is one level at a time, so walk the tree. */
async function listAllPaths(
  admin: SupabaseLike,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const found: string[] = [];
  const pending = [prefix.replace(/\/+$/, "")];

  while (pending.length) {
    const dir = pending.pop()!;
    let offset = 0;

    while (true) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(dir, { limit: 100, offset });
      if (error) throw error;
      if (!data?.length) break;

      for (const entry of data) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        // Supabase reports folders as entries with a null id.
        if (entry.id === null) pending.push(path);
        else found.push(path);
      }

      if (data.length < 100) break;
      offset += data.length;
    }
  }

  return found;
}

export async function purgeStorage(
  admin: SupabaseLike,
  userId: string,
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const { bucket, prefix } of CONFIG.buckets) {
    const step = `storage.${bucket}`;
    try {
      const paths = await listAllPaths(admin, bucket, prefix(userId));
      if (!paths.length) {
        results.push({ step, ok: true, detail: "no objects" });
        continue;
      }

      // remove() caps the number of paths per call.
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage
          .from(bucket)
          .remove(paths.slice(i, i + 100));
        if (error) throw error;
      }
      results.push({ step, ok: true, detail: `${paths.length} object(s)` });
    } catch (err) {
      results.push({
        step,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

export async function purgeTables(
  admin: SupabaseLike,
  userId: string,
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const { table, column, schema } of CONFIG.tables) {
    const step = `table.${schema ?? "public"}.${table}`;
    try {
      const client = schema && schema !== "public"
        ? admin.schema(schema)
        : admin;
      const { data, error } = await client
        .from(table)
        .delete()
        .eq(column, userId)
        .select(column);
      if (error) throw error;
      results.push({ step, ok: true, detail: `${data?.length ?? 0} row(s)` });
    } catch (err) {
      results.push({
        step,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

export async function deleteAuthUser(
  admin: SupabaseLike,
  userId: string,
): Promise<StepResult> {
  try {
    const { error } = await admin.auth.admin.deleteUser(
      userId,
      CONFIG.softDeleteAuthUser,
    );
    if (error) throw error;
    return {
      step: "auth.delete_user",
      ok: true,
      detail: CONFIG.softDeleteAuthUser ? "soft deleted" : "hard deleted",
    };
  } catch (err) {
    return {
      step: "auth.delete_user",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Pull the reason the user typed into the public form and close the request.
 * Best effort: a missing request must never block the deletion itself.
 */
export async function consumeDeletionRequest(
  admin: SupabaseLike,
  email: string,
): Promise<string | null> {
  if (!CONFIG.deletionRequestsTable || !email) return null;

  try {
    const { data } = await admin
      .from(CONFIG.deletionRequestsTable)
      .select("id, reason")
      .eq("email", email.toLowerCase())
      .is("completed_at", null)
      .order("requested_at", { ascending: false })
      .limit(1);

    const row = data?.[0];
    if (!row) return null;

    await admin
      .from(CONFIG.deletionRequestsTable)
      .update({ completed_at: new Date().toISOString() })
      .eq("id", row.id);

    return row.reason ?? null;
  } catch {
    return null;
  }
}

/** Written before the purge, while the user still exists to attribute it to. */
export async function writeAuditRow(
  admin: SupabaseLike,
  row: {
    user_id: string;
    email: string;
    requested_by: string;
    reason: string | null;
  },
): Promise<StepResult> {
  if (!CONFIG.auditTable) {
    return { step: "audit", ok: true, skipped: true };
  }

  try {
    const { error } = await admin.from(CONFIG.auditTable).insert(row);
    if (error) throw error;
    return { step: "audit", ok: true };
  } catch (err) {
    return {
      step: "audit",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
