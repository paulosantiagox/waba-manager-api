
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://uvtjrgfouqmwopekbuxd.supabase.co'
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '' // This would be the anon key of the project

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('Invoking function...')
const { data, error } = await supabase.functions.invoke('auto-update-status', {
    body: { manual: true }
})

if (error) {
    console.error('Error:', error)
} else {
    console.log('Success:', data)
}
