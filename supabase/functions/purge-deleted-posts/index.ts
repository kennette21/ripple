import { createClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 30;
const BATCH_SIZE = 50;
const MAX_BATCHES_PER_RUN = 20;
const POST_IMAGES_BUCKET = "post-images";

interface DeletedPostImage {
  storage_path: string;
  thumbnail_path: string | null;
}

interface DeletedPost {
  id: string;
  images: DeletedPostImage[] | null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedPurgeSecret = Deno.env.get("PURGE_DELETED_POSTS_SECRET");
  if (!expectedPurgeSecret) {
    return jsonResponse({ error: "Purge secret is not configured" }, 500);
  }

  if (request.headers.get("x-purge-secret") !== expectedPurgeSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Supabase admin credentials are unavailable" },
      500,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let purgedPosts = 0;
  let purgedObjects = 0;

  try {
    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
      const { data, error: selectError } = await admin
        .from("posts")
        .select(`
          id,
          images:post_images(storage_path, thumbnail_path)
        `)
        .not("deleted_at", "is", null)
        .lte("deleted_at", cutoff)
        .order("deleted_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (selectError) throw selectError;

      const posts = (data ?? []) as DeletedPost[];
      if (posts.length === 0) break;

      const objectPaths = posts.flatMap((post) =>
        (post.images ?? []).flatMap((image) =>
          [image.storage_path, image.thumbnail_path].filter(
            (path): path is string => Boolean(path),
          )
        )
      );

      if (objectPaths.length > 0) {
        const { error: storageError } = await admin.storage
          .from(POST_IMAGES_BUCKET)
          .remove(objectPaths);

        if (storageError) throw storageError;
      }

      const postIds = posts.map((post) => post.id);
      const { error: deleteError } = await admin
        .from("posts")
        .delete()
        .in("id", postIds);

      if (deleteError) throw deleteError;

      purgedPosts += postIds.length;
      purgedObjects += objectPaths.length;

      if (posts.length < BATCH_SIZE) break;
    }

    return jsonResponse({
      cutoff,
      purged_posts: purgedPosts,
      purged_objects: purgedObjects,
    });
  } catch (error) {
    console.error("Deleted-post purge failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Purge failed",
        cutoff,
        purged_posts: purgedPosts,
        purged_objects: purgedObjects,
      },
      500,
    );
  }
});
