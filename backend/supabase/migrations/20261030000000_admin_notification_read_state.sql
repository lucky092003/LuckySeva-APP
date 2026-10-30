-- Keep the admin console's read state independent from customer/provider notification state.
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS admin_read boolean NOT NULL DEFAULT false;
