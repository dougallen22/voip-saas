import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    version: '038e602',
    dashboard: 'UNIFIED - ONE DASHBOARD FOR ALL USERS',
    title: 'Team Calling Dashboard (Unified View)',
    timestamp: new Date().toISOString()
  })
}
