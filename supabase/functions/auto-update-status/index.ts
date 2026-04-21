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
      matchingSchedules = projectIds.map(id => ({ project_id: id, time: 'manual' }))
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

    // Processar cada projeto
    for (const [projectId, scheduleTimes] of projectScheduleMap) {
      // Para cada horário do projeto, tenta registrar execução (deduplicação)
      for (const scheduleTime of scheduleTimes) {
        console.log(`[AUTO_UPDATE] Tentando executar ${projectId} para ${scheduleTime}`)
        
        // DEDUPLICAÇÃO: Tenta inserir na tabela de execuções
        // Se já existe, o insert falha e pulamos
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
          if (execError.code === '23505') {
            // Violação de unique constraint = já executou hoje
            console.log(`[AUTO_UPDATE] Schedule ${scheduleTime} do projeto ${projectId} já foi executado hoje, pulando`)
            continue
          } else if (execError.message?.includes('does not exist')) {
            // Tabela não existe ainda, continua sem deduplicação
            console.log(`[AUTO_UPDATE] Tabela project_schedule_executions não existe, executando sem deduplicação`)
          } else {
            console.error(`[AUTO_UPDATE] Erro ao registrar execução:`, execError)
          }
        }

        // Busca business managers do projeto
        const { data: bms, error: bmsError } = await supabase
          .from('waba_business_managers')
          .select('id, access_token')
          .eq('project_id', projectId)

        if (bmsError) {
          console.error(`[AUTO_UPDATE] Erro ao buscar BMs:`, bmsError)
          totalErrors++
          continue
        }

        console.log(`[AUTO_UPDATE] BMs encontrados: ${bms?.length || 0}`)

        let projectNumbersUpdated = 0
        let projectErrors = 0

        // Para cada BM, buscar números ativos
        for (const bm of bms || []) {
          const { data: numbers, error: numbersError } = await supabase
            .from('waba_whatsapp_numbers')
            .select('*')
            .eq('business_manager_id', bm.id)
            .eq('is_visible', true)

          if (numbersError) {
            console.error(`[AUTO_UPDATE] Erro ao buscar números:`, numbersError)
            totalErrors++
            projectErrors++
            continue
          }

          console.log(`[AUTO_UPDATE] Números no BM ${bm.id}: ${numbers?.length || 0}`)

          // Atualizar cada número
          for (const num of numbers || []) {
            try {
              // Chamar API do Meta
              const metaUrl = `https://graph.facebook.com/v21.0/${num.phone_number_id}?fields=quality_rating,messaging_limit_tier,verified_name,display_phone_number&access_token=${bm.access_token}`
              const metaResponse = await fetch(metaUrl)
              const metaData = await metaResponse.json()

              // === TRATAMENTO DE ERRO: Não altera status, registra no histórico ===
              if (metaData.error) {
                const errorMsg = metaData.error.message || 'Erro desconhecido na API Meta'
                console.error(`[AUTO_UPDATE] Erro Meta para ${num.display_phone_number}:`, errorMsg)
                
                // Registra tentativa com erro no histórico (MANTÉM o status atual)
                await supabase.from('waba_status_history').insert({
                  phone_number_id: num.id,
                  quality_rating: num.quality_rating, // MANTÉM o status anterior
                  messaging_limit_tier: num.messaging_limit_tier,
                  changed_at: new Date().toISOString(),
                  is_error: true,
                  error_message: errorMsg,
                  observation: `Erro na verificação automática: ${errorMsg}`,
                })
                
                // Atualiza apenas last_checked (para saber que tentou verificar)
                await supabase
                  .from('waba_whatsapp_numbers')
                  .update({ last_checked: new Date().toISOString() })
                  .eq('id', num.id)
                
                totalErrors++
                projectErrors++
                continue
              }

              // === VALIDAÇÃO: Verifica se quality_rating é válido ===
              if (!metaData.quality_rating || !['GREEN', 'YELLOW', 'RED'].includes(metaData.quality_rating)) {
                const errorMsg = `Resposta inválida da API: quality_rating = ${metaData.quality_rating || 'undefined'}`
                console.error(`[AUTO_UPDATE] ${errorMsg} para ${num.display_phone_number}`)
                
                // Registra como erro no histórico (MANTÉM o status atual)
                await supabase.from('waba_status_history').insert({
                  phone_number_id: num.id,
                  quality_rating: num.quality_rating, // MANTÉM o status anterior
                  messaging_limit_tier: num.messaging_limit_tier,
                  changed_at: new Date().toISOString(),
                  is_error: true,
                  error_message: errorMsg,
                  observation: `Resposta inesperada da API Meta`,
                })
                
                await supabase
                  .from('waba_whatsapp_numbers')
                  .update({ last_checked: new Date().toISOString() })
                  .eq('id', num.id)
                
                totalErrors++
                projectErrors++
                continue
              }

              const newQuality = mapQuality(metaData.quality_rating)
              const newLimit = mapLimit(metaData.messaging_limit_tier)
              const hasQualityChanged = num.quality_rating !== newQuality
              const hasLimitChanged = num.messaging_limit_tier !== newLimit

              console.log(`[AUTO_UPDATE] ${num.display_phone_number}: ${num.quality_rating} -> ${newQuality}`)

              // Monta os dados de atualização
              const updateData: Record<string, unknown> = {
                quality_rating: newQuality,
                messaging_limit_tier: newLimit,
                verified_name: metaData.verified_name || num.verified_name,
                display_phone_number: metaData.display_phone_number || num.display_phone_number,
                last_checked: new Date().toISOString(),
              }

              // IMPORTANTE: Se a qualidade mudou, salva o status anterior e a data da mudança
              if (hasQualityChanged) {
                updateData.previous_quality = num.quality_rating
                updateData.last_status_change = new Date().toISOString()
              }

              // Atualizar número
              const { error: updateError } = await supabase
                .from('waba_whatsapp_numbers')
                .update(updateData)
                .eq('id', num.id)

              if (updateError) {
                console.error(`[AUTO_UPDATE] Erro update:`, updateError)
                totalErrors++
                projectErrors++
                continue
              }

              // Registrar no histórico - SEMPRE salva o status atual no momento da verificação
              // O campo previous_quality no histórico guarda o status ANTES da mudança
              const { error: historyError } = await supabase.from('waba_status_history').insert({
                phone_number_id: num.id,
                quality_rating: newQuality,
                messaging_limit_tier: newLimit,
                previous_quality: hasQualityChanged ? num.quality_rating : null,
                changed_at: new Date().toISOString(),
                observation: hasQualityChanged 
                  ? `Status alterado de ${num.quality_rating} para ${newQuality} (verificação automática)` 
                  : 'Verificação automática',
              })

              if (historyError) {
                console.error(`[AUTO_UPDATE] Erro ao inserir histórico:`, historyError)
                totalErrors++
                projectErrors++
              }

              // Se mudou qualidade, registrar notificação
              if (hasQualityChanged) {
                const qualityValue: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
                const direction = qualityValue[newQuality] > qualityValue[num.quality_rating] ? 'up' : 'down'

                const { error: notifError } = await supabase.from('waba_status_change_notifications').insert({
                  phone_number_id: num.id,
                  project_id: projectId,
                  previous_quality: num.quality_rating,
                  new_quality: newQuality,
                  direction: direction,
                  changed_at: new Date().toISOString(),
                })

                if (notifError) {
                  console.error(`[AUTO_UPDATE] Erro ao inserir notificação:`, notifError)
                }
              }

              totalUpdated++
              projectNumbersUpdated++
            } catch (err) {
              console.error(`[AUTO_UPDATE] Erro:`, err)
              totalErrors++
              projectErrors++
            }
          }
        }

        // Atualiza a execução com os contadores
        if (!execError || execError.message?.includes('does not exist')) {
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
            // Ignora erro se tabela não existe
          }
        }

        executedProjects.push(projectId)
      }
    }

    // Registrar execução na tabela de logs global
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
      console.log('[AUTO_UPDATE] Erro ao gravar log global:', logError)
    }

    console.log(`[AUTO_UPDATE] Finalizado - ${totalUpdated} atualizados, ${totalErrors} erros`)
    console.log('[AUTO_UPDATE] ========================================')

    return new Response(
      JSON.stringify({ 
        success: true, 
        brasiliaTime,
        totalSchedules: allSchedules.length,
        schedulesFound: matchingSchedules.length,
        projectsChecked: executedProjects.length,
        numbersUpdated: totalUpdated,
        errors: totalErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[AUTO_UPDATE] Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
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
