-- =====================================================
-- SMS MESSAGING TABLES
-- Migration 11: Create tables for SMS/MMS messaging
-- =====================================================

-- =====================================================
-- TABLE: sms_conversations
-- Purpose: Group SMS messages into conversations/threads
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  twilio_phone_number TEXT NOT NULL, -- Your Twilio number used for this conversation
  contact_phone_number TEXT NOT NULL, -- Contact's phone number
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT, -- First 100 chars of last message
  unread_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Ensure one conversation per contact per org
  CONSTRAINT unique_conversation_per_contact UNIQUE (organization_id, contact_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS sms_conversations_org_id_idx ON public.sms_conversations(organization_id);
CREATE INDEX IF NOT EXISTS sms_conversations_contact_id_idx ON public.sms_conversations(contact_id);
CREATE INDEX IF NOT EXISTS sms_conversations_last_message_idx ON public.sms_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS sms_conversations_unread_idx ON public.sms_conversations(unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS sms_conversations_archived_idx ON public.sms_conversations(is_archived);

-- Enable Row Level Security
ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.sms_conversations IS 'SMS conversation threads grouped by contact';
COMMENT ON COLUMN public.sms_conversations.twilio_phone_number IS 'Organization Twilio number used for this conversation';
COMMENT ON COLUMN public.sms_conversations.contact_phone_number IS 'Contact phone number (normalized E.164)';
COMMENT ON COLUMN public.sms_conversations.last_message_preview IS 'Preview of most recent message (max 100 chars)';
COMMENT ON COLUMN public.sms_conversations.unread_count IS 'Number of unread messages in this conversation';

-- =====================================================
-- TABLE: sms_messages
-- Purpose: Store individual SMS/MMS messages
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.sms_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  twilio_message_sid TEXT UNIQUE NOT NULL, -- Twilio's unique message ID (SM... for SMS, MM... for MMS)
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT, -- Message text content (can be null for MMS-only messages)
  media_urls TEXT[], -- Array of media URLs for MMS
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'undelivered',
    'failed', 'received', 'read'
  )),
  error_code INTEGER,
  error_message TEXT,
  num_segments INTEGER DEFAULT 1, -- Number of SMS segments (messages over 160 chars split)
  num_media INTEGER DEFAULT 0, -- Number of media attachments
  price DECIMAL(10, 5), -- Cost of the message
  price_unit TEXT DEFAULT 'USD',
  sent_by_user_id UUID REFERENCES public.voip_users(id) ON DELETE SET NULL, -- Who sent it (for outbound only)
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS sms_messages_conversation_id_idx ON public.sms_messages(conversation_id);
CREATE INDEX IF NOT EXISTS sms_messages_org_id_idx ON public.sms_messages(organization_id);
CREATE INDEX IF NOT EXISTS sms_messages_twilio_sid_idx ON public.sms_messages(twilio_message_sid);
CREATE INDEX IF NOT EXISTS sms_messages_direction_idx ON public.sms_messages(direction);
CREATE INDEX IF NOT EXISTS sms_messages_status_idx ON public.sms_messages(status);
CREATE INDEX IF NOT EXISTS sms_messages_created_at_idx ON public.sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS sms_messages_sent_by_idx ON public.sms_messages(sent_by_user_id);

-- Enable Row Level Security
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.sms_messages IS 'Individual SMS/MMS messages with delivery tracking';
COMMENT ON COLUMN public.sms_messages.twilio_message_sid IS 'Twilio unique message identifier (SM... or MM...)';
COMMENT ON COLUMN public.sms_messages.direction IS 'inbound = received from contact, outbound = sent to contact';
COMMENT ON COLUMN public.sms_messages.media_urls IS 'Array of Twilio media URLs for MMS attachments';
COMMENT ON COLUMN public.sms_messages.num_segments IS 'Number of SMS segments (160 chars per segment)';
COMMENT ON COLUMN public.sms_messages.price IS 'Cost charged by Twilio for this message';

-- =====================================================
-- TABLE: sms_message_events
-- Purpose: Track message delivery lifecycle for debugging
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sms_message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.sms_messages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'sent', 'delivered', 'failed', 'queued', etc.
  status TEXT NOT NULL,
  error_code INTEGER,
  error_message TEXT,
  twilio_data JSONB, -- Raw webhook data from Twilio
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS sms_message_events_message_id_idx ON public.sms_message_events(message_id);
CREATE INDEX IF NOT EXISTS sms_message_events_created_at_idx ON public.sms_message_events(created_at DESC);
CREATE INDEX IF NOT EXISTS sms_message_events_event_type_idx ON public.sms_message_events(event_type);

-- Enable Row Level Security
ALTER TABLE public.sms_message_events ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.sms_message_events IS 'Audit log of message status changes and webhook events';
COMMENT ON COLUMN public.sms_message_events.twilio_data IS 'Complete webhook payload from Twilio for debugging';

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- sms_conversations policies
CREATE POLICY "Users can view their organization's SMS conversations"
  ON public.sms_conversations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.voip_users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create SMS conversations in their org"
  ON public.sms_conversations FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.voip_users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their organization's SMS conversations"
  ON public.sms_conversations FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.voip_users WHERE id = auth.uid()
  ));

-- sms_messages policies
CREATE POLICY "Users can view their organization's SMS messages"
  ON public.sms_messages FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.voip_users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can send SMS messages in their org"
  ON public.sms_messages FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.voip_users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their organization's SMS messages"
  ON public.sms_messages FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.voip_users WHERE id = auth.uid()
  ));

-- sms_message_events policies (read-only for users, system can insert)
CREATE POLICY "Users can view message events for their org"
  ON public.sms_message_events FOR SELECT
  USING (message_id IN (
    SELECT id FROM public.sms_messages WHERE organization_id IN (
      SELECT organization_id FROM public.voip_users WHERE id = auth.uid()
    )
  ));

-- Service role can insert events (for webhooks)
CREATE POLICY "Service role can insert message events"
  ON public.sms_message_events FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway, but explicit policy for clarity

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Update conversation updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_sms_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update conversations.updated_at
CREATE TRIGGER update_sms_conversations_updated_at
  BEFORE UPDATE ON public.sms_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sms_conversation_updated_at();

-- Function: Update conversation on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Update conversation metadata
  UPDATE public.sms_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(COALESCE(NEW.body, '[Media]'), 100),
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update conversation when message is inserted
CREATE TRIGGER update_conversation_on_message_insert
  AFTER INSERT ON public.sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- =====================================================
-- ENABLE SUPABASE REALTIME
-- =====================================================

-- Enable realtime for sms_conversations (for conversation list updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_conversations;

-- Enable realtime for sms_messages (for new messages appearing in chat)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.sms_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sms_messages TO authenticated;
GRANT SELECT ON public.sms_message_events TO authenticated;

-- Grant service role full access (for webhooks)
GRANT ALL ON public.sms_conversations TO service_role;
GRANT ALL ON public.sms_messages TO service_role;
GRANT ALL ON public.sms_message_events TO service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verification queries (run these to verify migration succeeded):
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'sms_%';
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'sms_%';
