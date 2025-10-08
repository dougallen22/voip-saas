-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  twilio_number TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_api_key TEXT,
  twilio_api_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.organizations IS 'Organizations (tenants) in the VoIP CRM system';
COMMENT ON COLUMN public.organizations.twilio_number IS 'Twilio phone number for this organization';
COMMENT ON COLUMN public.organizations.twilio_account_sid IS 'Twilio Account SID';
COMMENT ON COLUMN public.organizations.twilio_auth_token IS 'Twilio Auth Token (encrypted)';
COMMENT ON COLUMN public.organizations.twilio_api_key IS 'Twilio API Key';
COMMENT ON COLUMN public.organizations.twilio_api_secret IS 'Twilio API Secret (encrypted)';
