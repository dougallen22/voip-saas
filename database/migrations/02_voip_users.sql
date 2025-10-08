-- Create voip_users table
CREATE TABLE IF NOT EXISTS public.voip_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('super_admin', 'tenant_admin', 'agent')),
  is_available BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voip_users ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS voip_users_organization_id_idx ON public.voip_users(organization_id);
CREATE INDEX IF NOT EXISTS voip_users_is_available_idx ON public.voip_users(is_available);

-- Add comment
COMMENT ON TABLE public.voip_users IS 'VoIP users with role and availability status';
