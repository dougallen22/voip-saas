'use client'

import { useEffect, useState } from 'react'

export default function TestTwilioPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  useEffect(() => {
    async function testTwilio() {
      try {
        addLog('🔍 Starting Twilio Device test...')

        // Step 1: Fetch token
        addLog('📡 Fetching Twilio token...')
        const response = await fetch('/api/twilio/token')
        addLog(`Response status: ${response.status}`)

        if (!response.ok) {
          throw new Error(`Token fetch failed: ${response.status}`)
        }

        const data = await response.json()
        addLog(`✅ Token received for user: ${data.identity}`)
        setToken(data.token)

        // Step 2: Import Twilio SDK
        addLog('📦 Importing Twilio Voice SDK...')
        const { Device } = await import('@twilio/voice-sdk')
        addLog('✅ Twilio Voice SDK imported successfully')

        // Step 3: Create Device
        addLog('🔧 Creating Twilio Device...')
        const device = new Device(data.token, {
          logLevel: 1,
        })
        addLog('✅ Twilio Device created')

        // Step 4: Register Device
        addLog('📞 Registering device...')
        device.on('registered', () => {
          addLog('✅ Device registered successfully!')
        })

        device.on('error', (err: any) => {
          addLog(`❌ Device error: ${err.message}`)
          setError(err.message)
        })

        await device.register()
        addLog('📝 Registration initiated')

      } catch (err: any) {
        const errorMsg = `❌ ERROR: ${err.message}`
        addLog(errorMsg)
        setError(err.message)
        console.error('Full error:', err)
      }
    }

    testTwilio()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Twilio Device Test</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {token && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <strong>Token received!</strong> (first 50 chars): {token.substring(0, 50)}...
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div className="space-y-2 font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i} className="text-gray-700">{log}</div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>This page tests Twilio Device initialization step by step.</p>
          <p>Check the browser console for detailed logs.</p>
        </div>
      </div>
    </div>
  )
}
