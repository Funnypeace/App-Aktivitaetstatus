-- Make the profiles table part of the realtime publication so clients can
-- subscribe to status changes of other users (live user list).
alter publication supabase_realtime add table public.profiles;
