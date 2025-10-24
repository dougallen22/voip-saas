import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  console.log('🔍 DIAGNOSTIC: Outbound endpoint called')
  console.log('Timestamp:', new Date().toISOString())

  try {
    const formData = await request.formData()

    // Log ALL parameters
    console.log('\n=== ALL PARAMETERS ===')
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value)
    }
    console.log('======================\n')

    // Also log as JSON for easier reading
    const params: Record<string, any> = {}
    for (const [key, value] of formData.entries()) {
      params[key] = value
    }

    return NextResponse.json({
      success: true,
      message: 'Diagnostic endpoint - check server logs',
      receivedParams: params,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Error in diagnostic endpoint:', error)
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
