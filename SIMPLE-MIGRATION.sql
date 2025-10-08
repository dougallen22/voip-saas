-- MULTI-AGENT MIGRATION - COPY AND PASTE THIS INTO SUPABASE
-- Go to: Database > SQL Editor > New query
-- Or click the SQL icon in left sidebar, then click + button

CREATE TABLE call_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text UNIQUE NOT NULL,
  claimed_by uuid,
  claimed_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 seconds',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ring_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text NOT NULL,
  agent_id uuid,
  event_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE FUNCTION claim_call(p_call_sid text, p_agent_id uuid)
RETURNS boolean AS $$
DECLARE
  v_claimed boolean;
BEGIN
  INSERT INTO call_claims (call_sid, claimed_by, status)
  VALUES (p_call_sid, p_agent_id, 'claimed')
  ON CONFLICT (call_sid) DO NOTHING
  RETURNING true INTO v_claimed;
  RETURN COALESCE(v_claimed, false);
END;
$$ LANGUAGE plpgsql;
