# ⚠️ IMPORTANT: You're connected to the WRONG Supabase project!

## Current .env.local values (WRONG):
```
NEXT_PUBLIC_SUPABASE_URL=https://zcosbiwvstrwmyioqdjw.supabase.co
```

## Correct values (from voip-crm project):
```
NEXT_PUBLIC_SUPABASE_URL=https://pcqvxapscjgrytwfnrhv.supabase.co
```

## Where to find the correct credentials:

1. Go to: https://supabase.com/dashboard/project/pcqvxapscjgrytwfnrhv/settings/api
2. Copy these values:
   - **Project URL** → NEXT_PUBLIC_SUPABASE_URL
   - **anon public** key → NEXT_PUBLIC_SUPABASE_ANON_KEY  
   - **service_role** key → SUPABASE_SERVICE_ROLE_KEY

## Why this matters:
- All database tables were created in `voip-crm` (pcqvxapscjgrytwfnrhv)
- Your user account is in `voip-crm` 
- The `zcosbiwvstrwmyioqdjw` project is empty/different
