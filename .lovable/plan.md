

# Correção: Menu "Usuários" não aparece para conta master

## Causa Raiz

A tabela `waba_user_roles` contém **11 registros** para a conta `paulosantiago.adm@gmail.com`:

| role |
|------|
| master |
| admin |
| usuario |
| gerente |
| coordenador |
| supervisor |
| vendedor |
| operador |
| atendente |
| assistente |
| visitante |

O codigo em `AuthContext.tsx` (linha 45-49) usa `.maybeSingle()` para buscar a role:

```typescript
const { data: roleData, error: roleError } = await supabase
  .from('waba_user_roles')
  .select('role')
  .eq('user_id', userId)
  .maybeSingle();  // Espera 0 ou 1 resultado!
```

Quando recebe 11 linhas, o Supabase retorna um erro (PGRST116 - "multiple rows returned"). O codigo entao:
1. Entra no `if (roleError)` e faz `console.error('Error fetching role:', roleError)` -- que e exatamente o erro visivel no console
2. Define `role = roleData?.role || 'user'` -- como `roleData` e `null` (por causa do erro), `role` vira `'user'`
3. Define `isMaster = false`
4. O menu "Usuarios" nao aparece porque depende de `isMaster === true`

## Solucao

### Parte 1: Corrigir a consulta de role no AuthContext

Alterar a query para buscar **todas** as roles do usuario e verificar se `'master'` esta entre elas.

**Arquivo:** `src/contexts/AuthContext.tsx`

Mudanca na linha 45-56:
- Trocar `.maybeSingle()` por busca de todas as roles
- Verificar se o array contem `'master'`
- Usar a role de maior privilegio para o campo `user.role`

```typescript
// Fetch roles (user may have multiple)
const { data: rolesData, error: roleError } = await supabase
  .from('waba_user_roles')
  .select('role')
  .eq('user_id', userId);

if (roleError) {
  console.error('Error fetching role:', roleError);
}

const roles = rolesData?.map(r => r.role) || [];
const hasMasterRole = roles.includes('master');
const primaryRole = hasMasterRole ? 'master' : (roles[0] || 'user');
setIsMaster(hasMasterRole);
```

### Parte 2: Limpar roles duplicadas (opcional mas recomendado)

O banco tem muitas roles que nao sao usadas pelo sistema (gerente, coordenador, etc.). O sistema so reconhece `master` e `user`. As demais nao tem utilidade e podem ser limpas.

No entanto, isso nao e bloqueante -- a correcao da Parte 1 resolve o problema mesmo com multiplas roles.

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/contexts/AuthContext.tsx` | Alterar query de role para suportar multiplas roles por usuario |

## Resultado Esperado

1. A query busca todas as roles do usuario sem erro
2. Se `'master'` estiver entre elas, `isMaster = true`
3. O menu "Usuarios" aparece normalmente no sidebar
4. O erro "Error fetching role: Object" desaparece do console

