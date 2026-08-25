# Lunatica 1.5

Lunatica é uma aplicação web de chat com inteligência artificial, construída como um produto utilizável e seguro. **Lunatica 1.5 é o nome do modelo**, não a versão do aplicativo. A plataforma oferece apresentação pública, autenticação, onboarding, perfil com avatar privado, instruções pessoais, memórias controladas pelo usuário, múltiplas conversas persistentes, respostas em streaming, Markdown, edição, regeneração, anexos, cotas de uso e uma interface responsiva.

O frontend nunca recebe a chave do Gemini. O navegador autentica o usuário no Supabase e chama uma Edge Function; somente essa função acessa a Gemini API.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 3
- Lucide React
- Supabase Auth, Postgres, RLS e Edge Functions
- Google Gemini API (`streamGenerateContent` com SSE)
- GitHub Pages e GitHub Actions

## Instalação

```bash
git clone https://github.com/nitlabs-code/lunatica.git
cd lunatica
npm install
cp .env.example .env
```

No Windows PowerShell, use `Copy-Item .env.example .env`.

## Ambiente do frontend

Preencha somente valores públicos em `.env`:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

A chave `anon`/publishable é adequada no navegador porque o acesso aos dados é protegido por RLS. Nunca adicione `VITE_GEMINI_API_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY` ou qualquer segredo com prefixo `VITE_`.

`VITE_BASE_PATH` é opcional. Em produção, o padrão local é `/lunatica/`; o workflow define automaticamente o nome do repositório.

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://supabase.com/dashboard).
2. Instale o [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) ou use `npx supabase`.
3. Autentique e associe o projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

4. Aplique a migration versionada:

```bash
npx supabase db push
```

As migrations criam `profiles`, `conversations`, `messages`, `message_attachments`, `memories`, `usage_events` e `rate_limits`, além dos buckets privados `avatars` e `attachments`, índices, constraints, triggers, grants e políticas RLS. O perfil é criado automaticamente após o cadastro. Memórias só podem ser lidas e excluídas pelo próprio usuário; a criação passa pela Edge Function autenticada.

5. Em **Authentication > URL Configuration**, defina a URL do site e adicione as URLs de redirecionamento de desenvolvimento e produção, por exemplo:

```text
http://localhost:5173
https://nitlabs-code.github.io/lunatica/
```

6. Para exigir confirmação de email, mantenha **Confirm email** ativado. Para testes locais rápidos, ela pode ser desativada no painel.

## Gemini e Edge Function

Crie uma chave no [Google AI Studio](https://aistudio.google.com/app/apikey). Não coloque a chave em `.env` do frontend nem a compartilhe no chat.

Cadastre os secrets diretamente no Supabase:

```bash
npx supabase secrets set GEMINI_API_KEY=SUA_CHAVE
npx supabase secrets set GEMINI_MODEL=gemini-3.7-flash
npx supabase functions deploy chat
npx supabase functions deploy memory
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos automaticamente pelo ambiente de Edge Functions do Supabase. As funções validam o JWT e respeitam RLS. `chat` aplica rate limit e cota diária, lê instruções e memórias confirmadas, baixa somente anexos autorizados e encaminha o stream SSE do Gemini. `memory` identifica fatos pessoais estáveis ou resume uma memória adicionada manualmente sem aceitar dados sensíveis.

## Perfil, anexos e limites

- O onboarding solicita nome, username filtrado, avatar opcional, tema e instruções pessoais.
- Avatares e anexos ficam em buckets privados e só são acessíveis pelo dono via RLS.
- Cada mensagem custa 1 crédito; cada anexo acrescenta 1 crédito.
- O limite inicial é de 30 créditos por dia e pode ser ajustado em `supabase/functions/chat/index.ts`.
- Cada mensagem aceita até 4 anexos, com 5 MB por arquivo e 12 MB no total.
- Nome, estudos, trabalho e preferências duradouras podem virar memórias; um aviso **Memória salva** abre o painel onde o usuário revisa ou exclui cada item.
- O painel de memórias também aceita texto manual, resumido pelo Gemini, com limite de 50 itens por usuário.
- Formatos aceitos: JPEG, PNG, WebP, GIF, PDF, TXT, Markdown, CSV e JSON.
- As instruções pessoais complementam o system prompt fixo e nunca o substituem.

Para desenvolvimento local da função, crie `supabase/.env.local` (ignorado pelo Git) com `GEMINI_API_KEY` e execute:

```bash
npx supabase start
npx supabase functions serve chat --env-file supabase/.env.local
npx supabase functions serve memory --env-file supabase/.env.local
```

O Supabase local requer Docker.

## Desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:5173`.

## Qualidade e build

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

## Deploy no GitHub Pages

1. Publique o repositório no GitHub usando a branch `main`.
2. Em **Settings > Secrets and variables > Actions**, crie:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Em **Settings > Pages**, escolha **GitHub Actions** como source.
4. Faça push para `main`. O workflow valida, compila e publica `dist`.

A aplicação é publicada em [nitlabs-code.github.io/lunatica](https://nitlabs-code.github.io/lunatica/) e usa `HashRouter`, portanto URLs como `/#/chat/ID` continuam funcionando após atualizar a página no GitHub Pages.

## Deploy alternativo no Vercel

O arquivo `vercel.json` já configura o build estático. Importe o repositório no Vercel, cadastre as duas variáveis públicas e defina `VITE_BASE_PATH=/`. A Edge Function continua hospedada no Supabase; a chave Gemini não deve ser cadastrada no projeto Vercel.

## Segurança

- Nenhuma chave Gemini ou service role é incluída no frontend.
- RLS e grants limitam cada usuário aos próprios dados.
- Buckets de avatar e anexos são privados e usam políticas por pasta do usuário.
- A Edge Function valida o token no servidor e não aceita histórico arbitrário do cliente.
- Mensagens pertencem à mesma combinação `conversation_id + user_id` por constraint de banco.
- Rate limit por minuto e cota diária são aplicados no backend.
- Respostas são renderizadas por `react-markdown`, sem HTML bruto.

Antes de produção, ajuste limites de uso ao seu plano e configure monitoramento de erros sem registrar conteúdo sensível ou secrets.
