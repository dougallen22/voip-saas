-- Add direction column to calls table
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS calls_direction_idx ON public.calls(direction);

-- Backfill direction from metadata for existing records
UPDATE public.calls
SET direction = (metadata->>'direction')::TEXT
WHERE direction IS NULL AND metadata->>'direction' IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.calls.direction IS 'Call direction: inbound or outbound';
