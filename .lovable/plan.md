

# Correção: Status de usuario nao persiste (verificacao + retry)

## Diagnóstico

A edge function `admin-update-user-status` retorna `success: true` mas o status **nao muda** no banco. O Supabase nao retorna erro quando um `UPDATE` afeta 0 linhas. Dois cenarios:

1. **Signup:** O trigger do banco externo cria o perfil com `status='pending'` de forma assincrona. A edge function roda ANTES do perfil existir, entao o UPDATE nao encontra nenhuma linha.

2. **Toggle admin:** O UPDATE pode estar sendo silenciosamente ignorado (0 rows) ou revertido por um trigger.

## Solucao

### 1. Atualizar edge function com verificacao e retry

**Arquivo:** `supabase/functions/admin-update-user-status/index.ts`

Adicionar logica de:
- **Verificacao:** Apos o UPDATE, fazer um SELECT para confirmar que o status realmente mudou
- **Retry com delay:** Se o perfil nao existir ainda (caso do signup), esperar 2 segundos e tentar novamente, ate 3 tentativas
- **Resposta honesta:** Retornar erro se o status nao foi efetivamente alterado

```text
Logica:
1. Tenta UPDATE na waba_profiles
2. Faz SELECT para verificar o status atual
3. Se perfil nao existe: espera 2s e tenta novamente (ate 3x)
4. Se perfil existe mas status nao mudou: tenta UPDATE novamente
5. Retorna sucesso SOMENTE se o SELECT confirmar o status correto
```

### 2. Atualizar signup no AuthContext

**Arquivo:** `src/contexts/AuthContext.tsx`

- Adicionar um delay de 3 segundos antes de chamar a edge function (dar tempo ao trigger de criar o perfil)
- Verificar a resposta da edge function e logar erros
- Adicionar retry se a primeira tentativa falhar

### 3. Melhorar feedback no toggle de status

**Arquivo:** `src/hooks/useUsers.ts`

- No `onSuccess`, verificar a resposta real e invalidar o cache para forcar reload do banco
- No `onError`, mostrar mensagem mais descritiva

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/admin-update-user-status/index.ts` | Adicionar verificacao SELECT + retry com delay |
| `src/contexts/AuthContext.tsx` | Adicionar delay antes da ativacao no signup |
| `src/hooks/useUsers.ts` | Forcar invalidacao do cache apos sucesso |

## Resultado esperado

1. A edge function so retorna sucesso quando o status REALMENTE mudou no banco
2. Novos usuarios ficam ativos apos o signup (com retry para esperar o trigger)
3. O toggle de status do admin persiste apos recarregar a pagina
4. Se algo falhar, o usuario ve uma mensagem de erro real (nao mais falso positivo)

