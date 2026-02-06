import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSONAL_SUPABASE_URL = 'https://dfrfeirfllwmdkenylwk.supabase.co'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[ADMIN-UPDATE-STATUS] Tentativa ${attempt}/${MAX_RETRIES} para ${userId} -> ${status}`)

      // 1. Tenta o UPDATE
      const { error: updateError } = await supabase
        .from('waba_profiles')
        .update({ status })
        .eq('id', userId)

      if (updateError) {
        console.error(`[ADMIN-UPDATE-STATUS] Erro no UPDATE (tentativa ${attempt}):`, updateError)
        if (attempt === MAX_RETRIES) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
        await sleep(RETRY_DELAY_MS)
        continue
      }

      // 2. Verifica com SELECT se o status realmente mudou
      const { data: profile, error: selectError } = await supabase
        .from('waba_profiles')
        .select('id, status')
        .eq('id', userId)
        .maybeSingle()

      if (selectError) {
        console.error(`[ADMIN-UPDATE-STATUS] Erro no SELECT (tentativa ${attempt}):`, selectError)
        if (attempt === MAX_RETRIES) {
          return new Response(
            JSON.stringify({ success: false, error: selectError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }
        await sleep(RETRY_DELAY_MS)
        continue
      }

      // 3. Perfil não existe ainda (race condition com trigger do signup)
      if (!profile) {
        console.log(`[ADMIN-UPDATE-STATUS] Perfil não encontrado (tentativa ${attempt}), aguardando...`)
        if (attempt === MAX_RETRIES) {
          return new Response(
            JSON.stringify({ success: false, error: 'Perfil não encontrado após múltiplas tentativas' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }
        await sleep(RETRY_DELAY_MS)
        continue
      }

      // 4. Verifica se o status é o esperado
      if (profile.status === status) {
        console.log(`[ADMIN-UPDATE-STATUS] ✅ Verificado: ${userId} agora é ${status}`)
        return new Response(
          JSON.stringify({ success: true, userId, status, verified: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 5. Status não mudou - pode ser trigger revertendo
      console.log(`[ADMIN-UPDATE-STATUS] Status não mudou (atual: ${profile.status}, esperado: ${status}), tentando novamente...`)
      if (attempt === MAX_RETRIES) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Status não persistiu. Atual: ${profile.status}, esperado: ${status}`,
            currentStatus: profile.status 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }
      await sleep(RETRY_DELAY_MS)
    }

    // Fallback (shouldn't reach here)
    return new Response(
      JSON.stringify({ success: false, error: 'Falha após todas as tentativas' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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
