-- Enforce friend-request integrity and make blocking atomic.

-- Remove invalid/duplicate legacy rows before enforcing one request per
-- unordered pair. Prefer accepted, then pending, then the newest row.
DELETE FROM public.friend_requests
WHERE sender_id = receiver_id;

WITH ranked_requests AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
      ORDER BY
        CASE status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        updated_at DESC NULLS LAST,
        id
    ) AS position
  FROM public.friend_requests
)
DELETE FROM public.friend_requests
USING ranked_requests
WHERE friend_requests.id = ranked_requests.id
  AND ranked_requests.position > 1;

ALTER TABLE public.friend_requests
ADD CONSTRAINT friend_requests_no_self
CHECK (sender_id <> receiver_id);

CREATE UNIQUE INDEX friend_requests_unordered_pair_idx
ON public.friend_requests (
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id)
);

-- New requests must be pending and must belong to the authenticated sender.
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests"
ON public.friend_requests FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND receiver_id <> auth.uid()
  AND status = 'pending'
);

-- Only the receiver may accept or decline a request.
DROP POLICY IF EXISTS "Users can update own friend requests" ON public.friend_requests;
CREATE POLICY "Receiver can respond to friend requests"
ON public.friend_requests FOR UPDATE
USING (receiver_id = auth.uid())
WITH CHECK (
  receiver_id = auth.uid()
  AND status IN ('accepted', 'declined')
);

-- Do not let a response rewrite either participant.
REVOKE UPDATE ON public.friend_requests FROM anon;
REVOKE UPDATE ON public.friend_requests FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.friend_requests TO authenticated;

-- A block and the removal of social edges now commit as one transaction.
CREATE OR REPLACE FUNCTION public.remove_social_edges_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);

  DELETE FROM public.friend_requests
  WHERE (sender_id = NEW.blocker_id AND receiver_id = NEW.blocked_id)
     OR (sender_id = NEW.blocked_id AND receiver_id = NEW.blocker_id);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_social_edges_on_block() FROM PUBLIC;

CREATE TRIGGER remove_social_edges_after_block
AFTER INSERT ON public.blocks
FOR EACH ROW
EXECUTE FUNCTION public.remove_social_edges_on_block();
