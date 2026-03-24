ALTER TABLE public.incidents 
ADD COLUMN voided_at timestamp with time zone DEFAULT NULL,
ADD COLUMN void_reason text DEFAULT NULL;