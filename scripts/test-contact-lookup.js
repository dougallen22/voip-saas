/**
 * Test Contact Lookup
 *
 * This script tests the contact lookup functionality by:
 * 1. Querying the database for the contact
 * 2. Testing the phone matching logic
 * 3. Simulating the API call
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Test phone number (what Twilio sends)
const testPhoneNumber = '+12179318000' // E.164 format from Twilio

async function testLookup() {
  console.log('🔍 Testing contact lookup for:', testPhoneNumber)
  console.log('')

  // Step 1: Check what's in the database
  console.log('📊 STEP 1: Checking database for contacts with 217-931-8000')
  const { data: allContacts, error: allError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, business_name, phone, organization_id')
    .or('phone.ilike.%2179318000%,phone.ilike.%217-931-8000%,phone.ilike.%(217)%931%8000%')

  if (allError) {
    console.error('❌ Error querying contacts:', allError)
    return
  }

  if (!allContacts || allContacts.length === 0) {
    console.log('❌ NO contacts found with 217-931-8000 in ANY format')
    console.log('   Please verify the contact exists in the database')
    return
  }

  console.log(`✅ Found ${allContacts.length} contact(s):`)
  allContacts.forEach((contact, index) => {
    console.log(`\n  Contact ${index + 1}:`)
    console.log(`    Name: ${contact.first_name} ${contact.last_name}`)
    console.log(`    Business: ${contact.business_name || 'N/A'}`)
    console.log(`    Phone (DB): "${contact.phone}"`)
    console.log(`    Org ID: ${contact.organization_id}`)
  })

  // Step 2: Test phone normalization
  console.log('\n\n📱 STEP 2: Testing phone number matching')
  const incomingNormalized = testPhoneNumber.replace(/\D/g, '')
  const incomingLast10 = incomingNormalized.slice(-10)

  console.log(`  Incoming: ${testPhoneNumber}`)
  console.log(`  Normalized: ${incomingNormalized}`)
  console.log(`  Last 10 digits: ${incomingLast10}`)

  allContacts.forEach((contact, index) => {
    const dbNormalized = contact.phone.replace(/\D/g, '')
    const dbLast10 = dbNormalized.slice(-10)
    const matches = dbLast10 === incomingLast10

    console.log(`\n  Contact ${index + 1} "${contact.first_name} ${contact.last_name}":`)
    console.log(`    DB Phone: "${contact.phone}"`)
    console.log(`    DB Normalized: ${dbNormalized}`)
    console.log(`    DB Last 10: ${dbLast10}`)
    console.log(`    Match: ${matches ? '✅ YES' : '❌ NO'}`)
  })

  // Step 3: Test the actual matching logic (simulating API)
  console.log('\n\n🔄 STEP 3: Simulating API lookup logic')

  // Get the first organization ID for testing
  const testOrgId = allContacts[0].organization_id

  const { data: orgContacts, error: orgError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, business_name, phone')
    .eq('organization_id', testOrgId)

  if (orgError) {
    console.error('❌ Error querying org contacts:', orgError)
    return
  }

  console.log(`  Testing with Org ID: ${testOrgId}`)
  console.log(`  Found ${orgContacts?.length || 0} contacts in organization`)

  const matchingContact = orgContacts?.find(contact => {
    const contactNormalized = contact.phone.replace(/\D/g, '')
    const contactLast10 = contactNormalized.slice(-10)
    return contactLast10 === incomingLast10
  })

  if (matchingContact) {
    console.log('\n✅ API WOULD RETURN:')
    console.log(`  {`)
    console.log(`    id: "${matchingContact.id}",`)
    console.log(`    first_name: "${matchingContact.first_name}",`)
    console.log(`    last_name: "${matchingContact.last_name}",`)
    console.log(`    business_name: ${matchingContact.business_name ? `"${matchingContact.business_name}"` : 'null'},`)
    console.log(`    phone: "${matchingContact.phone}"`)
    console.log(`  }`)
    console.log('')
    console.log(`  Display Name: "${matchingContact.business_name || `${matchingContact.first_name} ${matchingContact.last_name}`}"`)
  } else {
    console.log('\n❌ API WOULD RETURN: null (no match found)')
  }

  // Step 4: Direct API test
  console.log('\n\n🌐 STEP 4: Testing actual API endpoint')
  console.log(`  You can test the API manually by opening:`)
  console.log(`  http://localhost:3000/api/contacts/lookup-by-phone?phone=${encodeURIComponent(testPhoneNumber)}`)
  console.log(`  (Make sure you're logged in first!)`)
}

testLookup()
  .then(() => {
    console.log('\n✅ Test complete!')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err)
    process.exit(1)
  })
