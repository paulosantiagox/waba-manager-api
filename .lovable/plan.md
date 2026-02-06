
# Correção: Conta Nova Aparece como "Desativada"

## Causa Raiz

Quando um novo usuario se cadastra, o sistema cria o registro na tabela de autenticacao (`auth.users`), mas **nao existe um trigger** para criar automaticamente o perfil na tabela `waba_profiles`.

Quando o usuario tenta fazer login, o codigo em `AuthContext.tsx` (linha 139-141) busca o perfil e, como nao encontra nada, retorna `null`. O sistema interpreta esse `null` como "conta desativada":

```typescript
const appUser = await fetchUserProfile(signedInUserId);
if (!appUser) {
  return { error: 'Sua conta está desativada. Fale com o administrador.' };
}
```

O problema e que `fetchUserProfile` retorna `null` em DOIS cenarios diferentes:
1. Perfil nao existe (usuario novo, sem trigger)
2. Usuario com status `inactive`

E o sistema trata ambos da mesma forma.

---

## Solucao

### Parte 1: Criar Trigger no Banco de Dados

Criar uma funcao + trigger `SECURITY DEFINER` que, ao inserir um novo usuario em `auth.users`, cria automaticamente:
- Um registro em `waba_profiles` com `status = 'pending'` (pendente de aprovacao pelo admin)
- Um registro em `waba_user_roles` com `role = 'user'`

O status sera `pending` porque o sistema ja tem um fluxo de aprovacao na pagina de Usuarios (o admin ativa/desativa contas via Switch).

SQL a ser executado (via migracao):

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.waba_profiles (id, name, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'pending'
  );

  INSERT INTO public.waba_user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Parte 2: Melhorar Mensagens de Erro no Login

Atualizar `AuthContext.tsx` para diferenciar os cenarios:

| Cenario | Mensagem atual | Mensagem corrigida |
|---------|----------------|-------------------|
| Perfil nao existe | "Sua conta esta desativada" | "Perfil nao encontrado. Tente novamente." |
| Status = `pending` | (nao tratado, entra normal) | "Sua conta esta aguardando aprovacao do administrador." |
| Status = `inactive` | "Sua conta esta desativada" | "Sua conta esta desativada. Fale com o administrador." |

Mudancas no `fetchUserProfile`:
- Tratar `status === 'pending'` como bloqueio (igual a `inactive`)
- Retornar mensagem especifica para cada caso

Mudancas no `login`:
- Em vez de retornar generico `if (!appUser)`, verificar o motivo especifico

### Parte 3: Corrigir Perfis de Usuarios Ja Cadastrados

Para usuarios que ja fizeram signup mas nao tem perfil em `waba_profiles`, sera necessario um SQL de correcao unica que insere os perfis faltantes baseado nos registros existentes em `auth.users`.

Isso pode ser feito com:

```sql
INSERT INTO public.waba_profiles (id, name, email, status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  'pending'
FROM auth.users u
LEFT JOIN public.waba_profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL (banco) | Criar trigger `handle_new_user` + correcao de perfis existentes |
| `src/contexts/AuthContext.tsx` | Diferenciar mensagens de erro (pending vs inactive vs sem perfil) |

---

## Fluxo Apos Correcao

```text
Cadastro novo usuario
        |
        v
  auth.users INSERT
        |
        v
  Trigger dispara automaticamente
        |
        v
  waba_profiles (status='pending')
  waba_user_roles (role='user')
        |
        v
  Usuario tenta login
        |
        v
  Status = 'pending'?
     Sim -> "Aguardando aprovacao"
     Nao -> Status = 'inactive'?
              Sim -> "Conta desativada"
              Nao -> Login normal (dashboard)
        |
        v
  Admin aprova na pagina Usuarios
  (Switch: pending -> active)
        |
        v
  Usuario consegue acessar o sistema
```

---

## Riscos

- **Nenhum risco de perda de dados**: O trigger apenas adiciona registros novos
- **Usuarios existentes**: O SQL de correcao usa `LEFT JOIN ... WHERE p.id IS NULL`, entao so insere para quem ainda nao tem perfil
- **Compatibilidade**: O trigger usa `SECURITY DEFINER` para contornar RLS e funcionar automaticamente
