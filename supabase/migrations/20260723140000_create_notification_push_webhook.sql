CREATE OR REPLACE FUNCTION public.send_notification_push_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_function_url text;
  v_webhook_secret text;
BEGIN
  SELECT decrypted_secret
  INTO v_function_url
  FROM vault.decrypted_secrets
  WHERE name = 'notification_push_function_url'
  ORDER BY updated_at DESC
  LIMIT 1;

  SELECT decrypted_secret
  INTO v_webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'notification_push_webhook_secret'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_function_url IS NULL OR v_webhook_secret IS NULL THEN
    RAISE WARNING
      'Notification push webhook is not configured in Vault';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_function_url,
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', NULL
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION public.send_notification_push_webhook()
FROM PUBLIC;

DROP TRIGGER IF EXISTS send_notification_push_after_insert
ON public.notifications;

CREATE TRIGGER send_notification_push_after_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.send_notification_push_webhook();
