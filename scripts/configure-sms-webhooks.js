const twilio = require('twilio')

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

async function configureWebhooks() {
  try {
    console.log('📱 Configuring Twilio SMS webhooks...\n')

    const phoneNumber = process.env.TWILIO_PHONE_NUMBER || '+18775196150'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voip-saas.vercel.app'

    console.log(`Phone Number: ${phoneNumber}`)
    console.log(`App URL: ${appUrl}\n`)

    // Get phone number SID
    console.log('🔍 Finding phone number in Twilio...')
    const phoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber
    })

    if (phoneNumbers.length === 0) {
      console.error('❌ Phone number not found in your Twilio account')
      console.error(`   Looking for: ${phoneNumber}`)
      console.log('\nAvailable phone numbers:')
      const allNumbers = await client.incomingPhoneNumbers.list({ limit: 10 })
      allNumbers.forEach(num => {
        console.log(`   - ${num.phoneNumber} (SID: ${num.sid})`)
      })
      process.exit(1)
    }

    const phoneNumberResource = phoneNumbers[0]
    console.log(`✅ Found phone number: ${phoneNumberResource.friendlyName || phoneNumber}`)
    console.log(`   SID: ${phoneNumberResource.sid}\n`)

    // Update webhooks
    console.log('⚙️  Updating SMS webhooks...')
    const updated = await client
      .incomingPhoneNumbers(phoneNumberResource.sid)
      .update({
        smsUrl: `${appUrl}/api/twilio/sms-incoming`,
        smsMethod: 'POST',
        statusCallback: `${appUrl}/api/twilio/sms-status`,
        statusCallbackMethod: 'POST'
      })

    console.log('✅ Webhooks configured successfully!\n')
    console.log('📋 Configuration:')
    console.log(`   SMS Incoming: ${updated.smsUrl}`)
    console.log(`   SMS Method: ${updated.smsMethod}`)
    console.log(`   Status Callback: ${updated.statusCallback}`)
    console.log(`   Status Method: ${updated.statusCallbackMethod}\n`)

    console.log('✨ SMS webhooks are now active!\n')
    console.log('🧪 Test by sending an SMS to:', phoneNumber)

  } catch (error) {
    console.error('❌ Error configuring webhooks:', error.message)
    if (error.code) {
      console.error(`   Twilio Error Code: ${error.code}`)
    }
    if (error.moreInfo) {
      console.error(`   More Info: ${error.moreInfo}`)
    }
    process.exit(1)
  }
}

configureWebhooks()
