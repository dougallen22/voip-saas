const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://zcosbiwvstrwmyioqdjw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'
)

async function checkAgents() {
  console.log('🔍 Checking agent availability in database...\n')

  // Query exactly like the voice webhook does
  const { data: availableAgents, error: agentError } = await supabase
    .from('voip_users')
    .select('*')
    .eq('is_available', true)
    .in('role', ['agent', 'super_admin'])

  console.log('📊 Query: SELECT * FROM voip_users WHERE is_available = true AND role IN (agent, super_admin)')
  console.log('')

  if (agentError) {
    console.error('❌ Error querying agents:', agentError)
    return
  }

  console.log('✅ Query successful!')
  console.log(`   Found ${availableAgents?.length || 0} available agents\n`)

  if (!availableAgents || availableAgents.length === 0) {
    console.log('❌ NO AVAILABLE AGENTS FOUND!\n')

    // Let's check ALL agents to see their status
    const { data: allAgents } = await supabase
      .from('voip_users')
      .select('id, full_name, email, role, is_available, organization_id')
      .in('role', ['agent', 'super_admin'])

    console.log('📋 ALL Agents in database:\n')
    allAgents?.forEach(agent => {
      console.log(`   Name: ${agent.full_name || 'Unknown'}`)
      console.log(`   Email: ${agent.email || 'Unknown'}`)
      console.log(`   ID: ${agent.id}`)
      console.log(`   Role: ${agent.role}`)
      console.log(`   is_available: ${agent.is_available} ${agent.is_available ? '✅' : '❌'}`)
      console.log(`   organization_id: ${agent.organization_id || 'NULL'}`)
      console.log('')
    })
  } else {
    console.log('✅ AVAILABLE AGENTS:\n')
    availableAgents.forEach(agent => {
      console.log(`   Name: ${agent.full_name || 'Unknown'}`)
      console.log(`   Email: ${agent.email || 'Unknown'}`)
      console.log(`   ID: ${agent.id}`)
      console.log(`   Role: ${agent.role}`)
      console.log(`   is_available: ${agent.is_available} ✅`)
      console.log(`   organization_id: ${agent.organization_id || 'NULL'}`)
      console.log('')
    })
  }

  console.log('\n🎯 DIAGNOSIS:')
  if (!availableAgents || availableAgents.length === 0) {
    console.log('   ❌ Problem: No agents have is_available = true')
    console.log('   💡 Solution: Set agents to available in the UI or run:')
    console.log('      UPDATE voip_users SET is_available = true WHERE role IN (\'agent\', \'super_admin\');')
  } else {
    console.log('   ✅ Agents ARE available in database')
    console.log('   💡 Problem must be elsewhere (webhook not being called, etc.)')
  }
}

checkAgents().then(() => process.exit(0))
