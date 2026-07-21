import { createClient } from "@supabase/supabase-js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type NotificationType =
  | "follow"
  | "comment"
  | "comment_reply"
  | "mention"
  | "new_post"
  | "repost";

interface NotificationRecord {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  actor: {
    display_name: string;
    username: string;
  } | null;
}

interface NotificationSettings {
  comment_notifications: boolean | null;
  follow_notifications: boolean | null;
  new_post_mode: "all" | "selected" | "off";
}

interface NotificationWebhook {
  type?: unknown;
  table?: unknown;
  schema?: unknown;
  record?: {
    id?: unknown;
  } | null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notificationIsEnabled(
  type: NotificationType,
  settings: NotificationSettings | null,
) {
  if (type === "follow") {
    return settings?.follow_notifications !== false;
  }

  if (type === "new_post") {
    return settings?.new_post_mode !== "off";
  }

  if (type === "repost") {
    return false;
  }

  return settings?.comment_notifications !== false;
}

function notificationBody(type: NotificationType) {
  switch (type) {
    case "new_post":
      return "shared a new post";
    case "comment":
      return "commented on your post";
    case "comment_reply":
      return "replied to your comment";
    case "mention":
      return "mentioned you";
    case "follow":
      return "started following you";
    case "repost":
      return "reposted your post";
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
  if (
    !webhookSecret ||
    request.headers.get("x-webhook-secret") !== webhookSecret
  ) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let webhook: NotificationWebhook;
  try {
    webhook = await request.json() as NotificationWebhook;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const notificationId = webhook.record?.id;
  if (
    webhook.type !== "INSERT" ||
    webhook.schema !== "public" ||
    webhook.table !== "notifications" ||
    typeof notificationId !== "string"
  ) {
    return jsonResponse({ error: "Invalid notification webhook" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase environment" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await admin
      .from("notifications")
      .select(`
        id,
        recipient_id,
        actor_id,
        type,
        post_id,
        comment_id,
        actor:profiles!notifications_actor_id_fkey(
          display_name,
          username
        )
      `)
      .eq("id", notificationId)
      .single();

    if (error) throw error;
    const notification = data as unknown as NotificationRecord;

    const [
      { data: settingsData, error: settingsError },
      { data: devicesData, error: devicesError },
      { count: unseenCount, error: unseenError },
    ] = await Promise.all([
      admin
        .from("notification_settings")
        .select(`
          comment_notifications,
          follow_notifications,
          new_post_mode
        `)
        .eq("user_id", notification.recipient_id)
        .maybeSingle(),
      admin
        .from("push_devices")
        .select("expo_push_token")
        .eq("user_id", notification.recipient_id)
        .limit(100),
      admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", notification.recipient_id)
        .is("seen_at", null),
    ]);

    if (settingsError) throw settingsError;
    if (devicesError) throw devicesError;
    if (unseenError) throw unseenError;

    if (
      !notificationIsEnabled(
        notification.type,
        settingsData as NotificationSettings | null,
      )
    ) {
      return jsonResponse({ status: "skipped", reason: "preference_disabled" });
    }

    const tokens = (devicesData ?? [])
      .map((device) => device.expo_push_token)
      .filter((token) => /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token));

    if (tokens.length === 0) {
      return jsonResponse({ status: "skipped", reason: "no_device" });
    }

    const pushData: Record<string, string> = {
      notificationId: notification.id,
      screen: "notifications",
    };
    if (notification.post_id) pushData.postId = notification.post_id;
    if (notification.comment_id) pushData.commentId = notification.comment_id;
    if (notification.type === "follow" && notification.actor_id) {
      pushData.profileId = notification.actor_id;
    }

    const actorName = notification.actor?.display_name ||
      notification.actor?.username ||
      "Ripple";
    const messages = tokens.map((token) => ({
      to: token,
      title: actorName,
      body: notificationBody(notification.type),
      sound: "default",
      badge: unseenCount ?? 0,
      channelId: notification.type === "new_post" ? "new-posts" : "activity",
      data: pushData,
    }));
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    if (expoAccessToken) {
      headers.Authorization = `Bearer ${expoAccessToken}`;
    }

    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });
    const expoResult = await expoResponse.json();

    if (!expoResponse.ok) {
      console.error("Expo rejected push request", expoResult);
      return jsonResponse({ error: "Expo rejected push request" }, 502);
    }

    return jsonResponse({
      status: "sent",
      devices: tokens.length,
      expo: expoResult,
    });
  } catch (error) {
    console.error("Notification push failed", error);
    return jsonResponse({ error: "Notification push failed" }, 500);
  }
});
