-- Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  twilio_call_sid TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  answered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'in-progress', 'completed', 'busy', 'no-answer', 'canceled', 'failed')),
  duration INTEGER,
  recording_url TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS calls_organization_id_idx ON public.calls(organization_id);
CREATE INDEX IF NOT EXISTS calls_answered_by_user_id_idx ON public.calls(answered_by_user_id);
CREATE INDEX IF NOT EXISTS calls_twilio_call_sid_idx ON public.calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS calls_status_idx ON public.calls(status);
CREATE INDEX IF NOT EXISTS calls_created_at_idx ON public.calls(created_at DESC);

-- Add comment
COMMENT ON TABLE public.calls IS 'VoIP call records with Twilio integration';
