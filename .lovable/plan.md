

# Correcao: Status de usuario nao persiste + Novos usuarios devem ser ativos

## Problema 1: Status nao persiste ao ativar usuario

**Causa raiz:** O codigo usa a **anon key** do banco externo para fazer o update na tabela `waba_profiles`. Provavelmente existe uma politica de seguranca (RLS) no banco externo que bloqueia atualizacoes com a anon key. O update "funciona" sem erro, mas nao altera nenhuma linha. A interface mostra verde por causa do cache otimista, mas quando recarrega, busca do banco e volta ao valor original (vermelho/pendente).

**Solucao:** Criar uma funcao backend `admin-update-user-status` que usa a **service role key** (`PERSONAL_SUPABASE_SERVICE_KEY`) para fazer o update, igual ao padrao ja usado na funcao `auto-update-status`.

## Problema 2: Novos usuarios ficam com status "pending"

**Causa raiz:** O banco externo tem um trigger que define `status = 'pending'` para novos cadastros. Como nao temos acesso direto ao trigger do banco externo, a solucao e atualizar o status para `'active'` logo apos o cadastro, usando a mesma funcao backend.

Alem disso, o `AuthContext.tsx` bloqueia o login de usuarios com status `'pending'`, entao mesmo que removessemos o trigger, o usuario nao conseguiria entrar. Vamos remover esse bloqueio.

## Plano de implementacao

### 1. Criar funcao backend `admin-update-user-status`

**Novo arquivo:** `supabase/functions/admin-update-user-status/index.ts`

Funcao que recebe `userId` e `status` no body e usa a service role key para atualizar a tabela `waba_profiles` no banco externo:

```text
POST /admin-update-user-status
Body: { "userId": "xxx", "status": "active" }

Logica:
1. Conecta ao Supabase externo com PERSONAL_SUPABASE_SERVICE_KEY
2. Faz UPDATE em waba_profiles SET status = $status WHERE id = $userId
3. Retorna sucesso/erro
```

### 2. Atualizar `src/hooks/useUsers.ts`

Modificar `useUpdateUserStatus` para chamar a funcao backend em vez de fazer update direto:

```text
Antes:  supabase.from('waba_profiles').update({ status }).eq('id', userId)
Depois: fetch('/functions/v1/admin-update-user-status', { body: { userId, status } })
```

### 3. Atualizar `src/contexts/AuthContext.tsx`

- Remover o bloqueio de usuarios com status `'pending'` (linhas 59-66)
- Usuarios pendentes poderao fazer login normalmente

### 4. Atualizar signup para definir status como 'active'

No `AuthContext.tsx`, apos o signup bem-sucedido, chamar a funcao backend para definir o status do novo usuario como `'active'`, sobrescrevendo o trigger do banco.

## Arquivos a modificar/criar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/admin-update-user-status/index.ts` | **Criar** - Funcao backend para atualizar status com service role key |
| `src/hooks/useUsers.ts` | **Modificar** - `useUpdateUserStatus` chama a funcao backend |
| `src/contexts/AuthContext.tsx` | **Modificar** - Remover bloqueio de pending, atualizar status no signup |

## Resultado esperado

1. Novos usuarios ficam ativos automaticamente ao se cadastrar
2. O switch de ativar/desativar na pagina de usuarios persiste corretamente
3. Nao aparece mais a mensagem "aguardando aprovacao do administrador"

