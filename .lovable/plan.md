

# Ajuste do Menu Mobile: Overlay + Fechar ao Clicar Fora

## Problema Atual

No mobile, o sidebar empurra o conteudo principal com `margin-left` (16px ou 256px), causando distorcao e compressao dos elementos da pagina. Alem disso, nao ha como fechar o menu clicando fora dele.

## Solucao

Transformar o comportamento do sidebar no mobile para funcionar como **overlay** (por cima do conteudo), com um fundo escuro semi-transparente que fecha o menu ao ser clicado.

## Mudancas

### 1. `src/components/layout/DashboardLayout.tsx`

- Importar o hook `useIsMobile` para detectar tela pequena
- No mobile, o sidebar comeca **recolhido** por padrao
- O `main` no mobile **nao tera margin-left** (conteudo ocupa 100% da tela)
- Adicionar um **overlay escuro** (`div` com `bg-black/50`) que aparece quando o sidebar esta aberto no mobile
- Clicar no overlay chama `setSidebarCollapsed(true)` para fechar o menu
- Reduzir o padding do conteudo no mobile (`p-4` em vez de `p-8`)

### 2. `src/components/layout/Sidebar.tsx`

- Importar o hook `useIsMobile`
- No mobile, quando o sidebar esta **recolhido**, ele fica completamente fora da tela (`-translate-x-full` ou `left: -100%`) em vez de mostrar a versao mini com icones
- No mobile, quando o sidebar esta **aberto**, ele aparece por cima do conteudo na largura padrao (`w-64`)
- Adicionar um botao hamburger visivel no mobile quando o menu esta fechado (ou manter o botao circular atual)
- Ao clicar em um link de navegacao no mobile, fechar o menu automaticamente

## Comportamento Esperado

```text
Desktop (>= 768px):
  - Sidebar funciona como hoje (empurra conteudo, toggle entre w-16 e w-64)

Mobile (< 768px):
  - Menu fechado: sidebar invisivel, conteudo ocupa 100%
  - Menu aberto: sidebar aparece POR CIMA do conteudo com overlay escuro atras
  - Clicar no overlay: fecha o menu
  - Clicar em um link: navega E fecha o menu
```

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/layout/DashboardLayout.tsx` | Adicionar deteccao mobile, overlay, remover margin no mobile |
| `src/components/layout/Sidebar.tsx` | Esconder completamente no mobile quando recolhido, fechar ao navegar |

## Detalhes Tecnicos

### DashboardLayout.tsx

```text
- useState para sidebarCollapsed inicia como `true` no mobile (via useIsMobile)
- main: no mobile usa ml-0 sempre, no desktop mantem ml-16/ml-64
- Overlay: div fixed inset-0 bg-black/50 z-40 (abaixo do sidebar z-50)
  - Visivel apenas quando mobile && !collapsed
  - onClick: setSidebarCollapsed(true)
- Padding: mobile p-4, desktop p-8
```

### Sidebar.tsx

```text
- No mobile + collapsed: classe -translate-x-full (esconde completamente)
- No mobile + aberto: w-64 translate-x-0 (aparece normal)
- Ao clicar em qualquer Link: se isMobile, chamar onToggle() para fechar
- Botao toggle: no mobile, fica visivel como icone de hamburger no canto
```

