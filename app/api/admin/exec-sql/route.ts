import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { sql } = await request.json()

  if (!sql) {
    return NextResponse.json({ error: 'SQL required' }, { status: 400 })
  }

  // Create direct PostgreSQL connection
  const pool = new Pool({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.zcosbiwvstrwmyioqdjw',
    password: '3Tw1l102024#',
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('Executing SQL:', sql)
    const result = await pool.query(sql)
    await pool.end()

    console.log('✅ SQL executed successfully')
    return NextResponse.json({
      success: true,
      result: result.rows,
      rowCount: result.rowCount
    })
  } catch (error: any) {
    await pool.end()
    console.error('❌ SQL execution failed:', error)
    return NextResponse.json({
      error: error.message,
      detail: error.detail,
      hint: error.hint
    }, { status: 500 })
  }
}
