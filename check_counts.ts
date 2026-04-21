
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PERSONAL_SUPABASE_URL = 'https://dfrfeirfllwmdkenylwk.supabase.co'
const personalServiceKey = Deno.env.get('PERSONAL_SUPABASE_SERVICE_KEY') ?? ''

if (!personalServiceKey) {
  console.error('Service key missing')
  Deno.exit(1)
}

const supabase = createClient(PERSONAL_SUPABASE_URL, personalServiceKey)

const { count, error } = await supabase
  .from('waba_whatsapp_numbers')
  .select('*', { count: 'exact', head: true })

if (error) {
  console.error('Error fetching count:', error)
} else {
  console.log('Total numbers:', count)
}
