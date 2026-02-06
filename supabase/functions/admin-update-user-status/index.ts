import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSONAL_SUPABASE_URL = 'https://dfrfeirfllwmdkenylwk.supabase.co'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const personalServiceKey = Deno.env.get('PERSONAL_SUPABASE_SERVICE_KEY') ?? ''

    if (!personalServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Service key não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const { userId, status } = await req.json()

    if (!userId || !status) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId e status são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Status inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(PERSONAL_SUPABASE_URL, personalServiceKey, {
      auth: { persistSession: false }
    })

    const { error } = await supabase
      .from('waba_profiles')
      .update({ status })
      .eq('id', userId)

    if (error) {
      console.error('[ADMIN-UPDATE-STATUS] Erro:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`[ADMIN-UPDATE-STATUS] Usuário ${userId} atualizado para ${status}`)

    return new Response(
      JSON.stringify({ success: true, userId, status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[ADMIN-UPDATE-STATUS] Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
