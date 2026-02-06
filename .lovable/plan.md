

# Correção: Erro ao aprovar/alterar status de usuário

## Causa Raiz

A funcao `useUpdateUserStatus` em `src/hooks/useUsers.ts` (linha 48-52) chama uma funcao RPC que **nao existe** no banco:

```typescript
const { data, error } = await supabase
  .rpc('admin_set_user_status', {
    target_user_id: userId,
    new_status: status
  });
```

O erro no console confirma:
- `POST .../rpc/admin_set_user_status 404 (Not Found)`
- `relation "user_roles" does not exist` (a funcao RPC referencia `user_roles` em vez de `waba_user_roles`)

## Solucao

Substituir a chamada RPC por um **update direto** na tabela `waba_profiles`, que ja existe e funciona (o mesmo padrao usado em outras funcoes do arquivo).

### Arquivo: `src/hooks/useUsers.ts`

**Antes (linhas 47-59):**
```typescript
mutationFn: async ({ userId, status }) => {
  const { data, error } = await supabase
    .rpc('admin_set_user_status', {
      target_user_id: userId,
      new_status: status
    });

  if (error) throw error;

  const updated = data?.[0];
  if (!updated) throw new Error('Nenhum usuário foi atualizado');

  return { userId, status: updated.status };
},
```

**Depois:**
```typescript
mutationFn: async ({ userId, status }) => {
  const { error } = await supabase
    .from('waba_profiles')
    .update({ status })
    .eq('id', userId);

  if (error) throw error;

  return { userId, status };
},
```

Mudanca simples: em vez de chamar uma funcao RPC inexistente, faz um UPDATE direto na coluna `status` da tabela `waba_profiles`. O resto da logica (optimistic update, cache sync, toast) permanece igual.

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/hooks/useUsers.ts` | Substituir `supabase.rpc('admin_set_user_status')` por `supabase.from('waba_profiles').update()` |

## Resultado Esperado

- O Switch de ativar/desativar usuario funciona sem erro
- O status muda de `pending` para `active` (ou `active` para `inactive`) corretamente
- O erro 404 e o erro de "relation user_roles does not exist" desaparecem

