-- The visibility rule is the server's business, not the page's.
--
-- `can_view` and `visibility_ancestors` are `security definer`, so every schema they touch is
-- read with the owner's rights. Left callable over the Data API they would be two holes:
-- `can_view` takes the viewer as a parameter, so a caller could simply claim to be the owner,
-- and `visibility_ancestors` answers "which album and trip is this item in" for any item of
-- any account, with no visibility check at all — enough to map a private archive, given that
-- item ids carry a timestamp rather than real entropy.
--
-- The Edge Functions reach them as `service_role`, which these revokes do not touch.

revoke execute on function public.can_view(uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.visibility_ancestors(uuid, text, text) from public, anon, authenticated;
