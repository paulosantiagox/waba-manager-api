
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PERSONAL_SUPABASE_URL = 'https://dfrfeirfllwmdkenylwk.supabase.co'
const personalServiceKey = Deno.env.get('PERSONAL_SUPABASE_SERVICE_KEY') ?? ''

const supabase = createClient(PERSONAL_SUPABASE_URL, personalServiceKey)

const { data, error } = await supabase.rpc('get_table_info', { table_name: 'waba_whatsapp_numbers' })
// If rpc doesn't exist, just try to get one row and see the columns
if (error) {
    const { data: row, error: rowError } = await supabase.from('waba_whatsapp_numbers').select('*').limit(1).single()
    console.log('Row:', row)
} else {
    console.log('Table Info:', data)
}
