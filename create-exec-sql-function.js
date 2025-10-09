const https = require('https')

const CREATE_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;

COMMENT ON FUNCTION public.exec_sql IS 'Executes arbitrary SQL - USE WITH CAUTION. Only accessible via service_role.';
`

console.log('📝 SQL to create exec_sql function:')
console.log(CREATE_FUNCTION_SQL)
console.log('\n🚨 MANUAL STEP REQUIRED:')
console.log('\n1. Go to: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new')
console.log('\n2. Paste the SQL above')
console.log('\n3. Click "Run"')
console.log('\n4. Then run: node add-columns-now.js')
console.log('\n📌 This only needs to be done ONCE. After that, all future migrations can use exec_sql.\n')

process.exit(0)
