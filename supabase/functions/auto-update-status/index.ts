import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credenciais do Supabase PESSOAL do usuário (onde estão os dados)
const PERSONAL_SUPABASE_URL = 'https://dfrfeirfllwmdkenylwk.supabase.co'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { manual = false } = await req.json().catch(() => ({ manual: false }))
    
    // Usa a service key do Supabase pessoal
    const personalServiceKey = Deno.env.get('PERSONAL_SUPABASE_SERVICE_KEY') ?? ''
    
    console.log('[AUTO_UPDATE] ========================================')
    console.log('[AUTO_UPDATE] Iniciando verificação -', new Date().toISOString())
    console.log('[AUTO_UPDATE] Modo manual:', manual)
    console.log('[AUTO_UPDATE] Service Key presente:', !!personalServiceKey)
    
    if (!personalServiceKey) {
      console.error('[AUTO_UPDATE] PERSONAL_SUPABASE_SERVICE_KEY não configurada!')
      return new Response(
        JSON.stringify({ success: false, error: 'Service key não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    
    const supabase = createClient(PERSONAL_SUPABASE_URL, personalServiceKey, {
      auth: { persistSession: false }
    })

    // Obter hora atual em Brasília (UTC-3)
    const now = new Date()
    const brasiliaFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    const brasiliaDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    const brasiliaTime = brasiliaFormatter.format(now)
    const brasiliaDate = brasiliaDateFormatter.format(now) // YYYY-MM-DD
    const [currentHour, currentMinute] = brasiliaTime.split(':').map(Number)
    const currentTotalMinutes = currentHour * 60 + currentMinute

    console.log(`[AUTO_UPDATE] Hora de Brasília: ${brasiliaTime} (${currentTotalMinutes} minutos)`)
    console.log(`[AUTO_UPDATE] Data de Brasília: ${brasiliaDate}`)

    let matchingSchedules = []
    let allSchedules = []

    if (manual) {
      console.log('[AUTO_UPDATE] Modo MANUAL: Buscando todos os projetos ativos...')
      const { data: bms, error: bmsErr } = await supabase
        .from('waba_business_managers')
        .select('project_id')
      
      if (bmsErr) throw bmsErr
      
      const projectIds = [...new Set(bms.map(b => b.project_id))]
      matchingSchedules = projectIds.map(id => ({ project_id: id, time: `manual-${brasiliaTime}` }))
    } else {
      // Busca todos os schedules
      console.log('[AUTO_UPDATE] Buscando schedules...')
      const { data: schedules, error: scheduleError } = await supabase
        .from('waba_project_update_schedules')
        .select('*')

      if (scheduleError) throw scheduleError
      allSchedules = schedules || []

      matchingSchedules = allSchedules.filter(s => {
        const [h, m] = s.time.split(':').map(Number)
        const scheduledMinutes = h * 60 + m
        const diff = currentTotalMinutes - scheduledMinutes
        return diff >= 0 && diff <= 1
      })
    }

    console.log(`[AUTO_UPDATE] Projetos para processar: ${matchingSchedules?.length || 0}`)

    // Agrupa por projeto
    const projectScheduleMap = new Map<string, string[]>()
    for (const s of matchingSchedules) {
      const times = projectScheduleMap.get(s.project_id) || []
      times.push(s.time)
      projectScheduleMap.set(s.project_id, times)
    }

    console.log(`[AUTO_UPDATE] Projetos para atualizar: ${projectScheduleMap.size}`)

    let totalUpdated = 0
    let totalErrors = 0
    const executedProjects: string[] = []

    // Processar projetos em paralelo para ganhar tempo
    const projectPromises = Array.from(projectScheduleMap.entries()).map(async ([projectId, scheduleTimes]) => {
      let projectNumbersUpdated = 0
      let projectErrors = 0

      for (const scheduleTime of scheduleTimes) {
        console.log(`[AUTO_UPDATE] Processando ${projectId} para ${scheduleTime}`)
        
        // DEDUPLICAÇÃO: Tenta inserir na tabela de execuções
        const { error: execError } = await supabase
          .from('waba_project_schedule_executions')
          .insert({
            project_id: projectId,
            schedule_time: scheduleTime,
            execution_date: brasiliaDate,
            brasilia_time: brasiliaTime,
            trigger_source: manual ? 'manual' : 'cron',
          })

        if (execError) {
          if (execError.code === '23505' && !manual) {
            console.log(`[AUTO_UPDATE] Schedule ${scheduleTime} do projeto ${projectId} já foi executado hoje, pulando`)
            continue
          }
        }

        // Busca business managers do projeto
        const { data: bms, error: bmsError } = await supabase
          .from('waba_business_managers')
          .select('id, access_token')
          .eq('project_id', projectId)

        if (bmsError) {
          console.error(`[AUTO_UPDATE] Erro ao buscar BMs para projeto ${projectId}:`, bmsError)
          projectErrors++
          continue
        }

        // Processar BMs em paralelo
        const bmPromises = (bms || []).map(async (bm) => {
          const { data: numbers, error: numbersError } = await supabase
            .from('waba_whatsapp_numbers')
            .select('*')
            .eq('business_manager_id', bm.id)
            .eq('is_visible', true)

          if (numbersError) {
            console.error(`[AUTO_UPDATE] Erro ao buscar números para BM ${bm.id}:`, numbersError)
            return { updated: 0, errors: 1 }
          }

          let bmUpdated = 0
          let bmErrors = 0

          // Atualizar cada número em paralelo (dentro do BM)
          const numberPromises = (numbers || []).map(async (num) => {
            try {
              const metaUrl = `https://graph.facebook.com/v21.0/${num.phone_number_id}?fields=quality_rating,messaging_limit_tier,verified_name,display_phone_number&access_token=${bm.access_token}`
              const metaResponse = await fetch(metaUrl)
              const metaData = await metaResponse.json()

              if (metaData.error) {
                const errorMsg = metaData.error.message || 'Erro Meta API'
                await supabase.from('waba_status_history').insert({
                  phone_number_id: num.id,
                  quality_rating: num.quality_rating,
                  messaging_limit_tier: num.messaging_limit_tier,
                  changed_at: new Date().toISOString(),
                  is_error: true,
                  error_message: errorMsg,
                  observation: `Erro na verificação automática: ${errorMsg}`,
                })
                
                await supabase.from('waba_whatsapp_numbers').update({ last_checked: new Date().toISOString() }).eq('id', num.id)
                return false
              }

              if (!metaData.quality_rating) return false

              const newQuality = mapQuality(metaData.quality_rating)
              const newLimit = mapLimit(metaData.messaging_limit_tier)
              const hasQualityChanged = num.quality_rating !== newQuality

              const updateData: any = {
                quality_rating: newQuality,
                messaging_limit_tier: newLimit,
                verified_name: metaData.verified_name || num.verified_name,
                display_phone_number: metaData.display_phone_number || num.display_phone_number,
                last_checked: new Date().toISOString(),
              }

              if (hasQualityChanged) {
                updateData.previous_quality = num.quality_rating
                updateData.last_status_change = new Date().toISOString()
              }

              await supabase.from('waba_whatsapp_numbers').update(updateData).eq('id', num.id)

              await supabase.from('waba_status_history').insert({
                phone_number_id: num.id,
                quality_rating: newQuality,
                messaging_limit_tier: newLimit,
                previous_quality: hasQualityChanged ? num.quality_rating : null,
                changed_at: new Date().toISOString(),
                observation: hasQualityChanged 
                  ? `Status alterado de ${num.quality_rating} para ${newQuality}` 
                  : 'Verificação automática',
              })

              if (hasQualityChanged) {
                const qualityValue: any = { HIGH: 3, MEDIUM: 2, LOW: 1 }
                const direction = qualityValue[newQuality] > (qualityValue[num.quality_rating] || 0) ? 'up' : 'down'
                await supabase.from('waba_status_change_notifications').insert({
                  phone_number_id: num.id,
                  project_id: projectId,
                  previous_quality: num.quality_rating,
                  new_quality: newQuality,
                  direction,
                  changed_at: new Date().toISOString(),
                })
              }

              return true
            } catch (err) {
              console.error(`[AUTO_UPDATE] Erro no número ${num.id}:`, err)
              return false
            }
          })

          const results = await Promise.all(numberPromises)
          bmUpdated = results.filter(Boolean).length
          bmErrors = numbers.length - bmUpdated

          return { updated: bmUpdated, errors: bmErrors }
        })

        const bmResults = await Promise.all(bmPromises)
        for (const res of bmResults) {
          projectNumbersUpdated += res.updated
          projectErrors += res.errors
        }

        // Atualiza a execução
        try {
          await supabase
            .from('waba_project_schedule_executions')
            .update({
              numbers_checked: projectNumbersUpdated + projectErrors,
              numbers_updated: projectNumbersUpdated,
              errors: projectErrors,
            })
            .eq('project_id', projectId)
            .eq('schedule_time', scheduleTime)
            .eq('execution_date', brasiliaDate)
        } catch (e) {
          // Ignora
        }
        
        executedProjects.push(projectId)
      }
      
      return { updated: projectNumbersUpdated, errors: projectErrors }
    })

    const allResults = await Promise.all(projectPromises)
    for (const res of allResults) {
      totalUpdated += res.updated
      totalErrors += res.errors
    }

    // Registrar log global
    try {
      await supabase.from('waba_auto_update_logs').insert({
        executed_at: new Date().toISOString(),
        brasilia_time: brasiliaTime,
        schedules_found: matchingSchedules.length,
        projects_checked: executedProjects.length,
        numbers_updated: totalUpdated,
        errors: totalErrors,
      })
    } catch (logError) {
      console.log('[AUTO_UPDATE] Erro log global:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        numbersUpdated: totalUpdated,
        errors: totalErrors,
        projectsChecked: executedProjects.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[AUTO_UPDATE] Erro fatal:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function mapQuality(q: string): string {
  const map: Record<string, string> = { GREEN: 'HIGH', YELLOW: 'MEDIUM', RED: 'LOW', UNKNOWN: 'UNKNOWN' }
  return map[q] || q || 'UNKNOWN'
}

function mapLimit(t: string): string {
  const map: Record<string, string> = {
    TIER_1K: '1000', 
    TIER_10K: '10000', 
    TIER_100K: '100000', 
    TIER_UNLIMITED: 'UNLIMITED',
    TIER_NOT_SET: 'NOT_SET'
  }
  return map[t] || t || 'NOT_SET'
}