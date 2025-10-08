-- Create second test user for multi-agent testing
-- Run this in Supabase SQL Editor

-- First, insert into auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'agent2@test.com',
  crypt('Parker2222!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) RETURNING id;

-- Note the ID from above, then insert into voip_users
-- Replace YOUR_USER_ID_HERE with the UUID returned above
INSERT INTO voip_users (
  id,
  email,
  full_name,
  role,
  is_available,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'agent2@test.com'),
  'agent2@test.com',
  'Agent Two',
  'agent',
  true,
  now(),
  now()
);
