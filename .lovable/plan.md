

# Correcoes: Status vermelho em novos usuarios + Remover aviso de email

## Problema 1: Novos usuarios aparecem vermelhos na lista do admin

O signup chama a edge function `admin-update-user-status` para mudar o status de `pending` para `active`. Porem, mesmo com retry, ha uma race condition: o trigger do banco externo pode nao ter criado o perfil ainda, ou pode estar revertendo o status apos o update.

**Solucao:** Apos o signup bem-sucedido, fazer login automatico do usuario. Alem disso, ao listar usuarios na pagina admin, se a edge function nao conseguiu alterar o status no signup, o admin pode usar o toggle (que ja funciona via edge function com service key).

O problema principal e que a edge function esta sendo chamada com a URL do Lovable Cloud (`VITE_SUPABASE_URL`) em vez da URL do Supabase externo. Vamos verificar e corrigir se necessario.

**Acao concreta no `src/contexts/AuthContext.tsx`:**
- Apos o signup + ativacao, fazer login automatico do usuario (chamar `signInWithPassword`)
- Isso garante que o usuario entra direto, sem precisar ir para a tela de login
- Mudar a mensagem de sucesso para "Conta criada com sucesso!" (sem mencionar email)

## Problema 2: Remover notificacao "Verifique seu email"

**Arquivo:** `src/pages/Auth.tsx` (linha 83)

Mudar de:
```
toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
```
Para:
```
toast.success('Conta criada com sucesso!');
```

E em vez de mudar para a aba de login (`setActiveTab('login')`), redirecionar para o dashboard diretamente (ja que o signup + login automatico tera sido feito no AuthContext).

## Problema 3: Edge function `promote-master`

Essa funcao **nunca existiu** no codigo deste projeto. Se voce precisa dela, posso cria-la em uma proxima tarefa. Atualmente, a promocao de usuario para admin e feita diretamente via update na tabela `waba_user_roles` (funcao `useUpdateUserRole` em `useUsers.ts`).

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/Auth.tsx` | Remover mensagem "Verifique seu email", redirecionar apos signup |
| `src/contexts/AuthContext.tsx` | Apos ativar usuario no signup, fazer login automatico |

## Detalhes tecnicos

### Auth.tsx - handleSignup (linha 76-85)

Apos o signup sem erro:
1. Mostrar toast "Conta criada com sucesso!"
2. Navegar para `/dashboard` (o AuthContext ja tera feito login automatico)

### AuthContext.tsx - signup (linhas 167-223)

Apos a edge function ativar o usuario com sucesso:
1. Chamar `supabase.auth.signInWithPassword({ email, password })` automaticamente
2. Isso dispara o `onAuthStateChange` e carrega o perfil do usuario
3. O usuario e redirecionado automaticamente para o dashboard

## Resultado esperado

1. Novos usuarios sao criados e entram no sistema automaticamente
2. Nenhuma mensagem sobre verificar email aparece
3. O status e atualizado para "active" pela edge function com retry
4. As edge functions `auto-update-status` e `admin-update-user-status` continuam existindo normalmente
