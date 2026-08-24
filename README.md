# Lunatica 1.5

Lunatica é uma aplicação web de chat com inteligência artificial, construída como um MVP utilizável e seguro. **Lunatica 1.5 é o nome do modelo**, não a versão do aplicativo. A plataforma oferece uma apresentação pública, autenticação, múltiplas conversas persistentes, respostas em streaming, Markdown, edição, regeneração, temas e uma interface responsiva.

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
git clone https://github.com/SEU_USUARIO/lunatica.git
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

A migration cria `profiles`, `conversations`, `messages` e `rate_limits`, além de índices, constraints, triggers, grants e políticas RLS. O perfil é criado automaticamente após o cadastro.

5. Em **Authentication > URL Configuration**, defina a URL do site e adicione as URLs de redirecionamento de desenvolvimento e produção, por exemplo:

```text
http://localhost:5173
https://SEU_USUARIO.github.io/lunatica/
```

6. Para exigir confirmação de email, mantenha **Confirm email** ativado. Para testes locais rápidos, ela pode ser desativada no painel.

## Gemini e Edge Function

Crie uma chave no [Google AI Studio](https://aistudio.google.com/app/apikey). Não coloque a chave em `.env` do frontend nem a compartilhe no chat.

Cadastre os secrets diretamente no Supabase:

```bash
npx supabase secrets set GEMINI_API_KEY=SUA_CHAVE
npx supabase secrets set GEMINI_MODEL=gemini-3.7-flash
npx supabase functions deploy chat
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos automaticamente pelo ambiente de Edge Functions do Supabase. A função valida o JWT, confirma a posse da conversa por RLS, aplica rate limit no servidor, busca apenas as 40 mensagens mais recentes e encaminha o stream SSE do Gemini.

Para desenvolvimento local da função, crie `supabase/.env.local` (ignorado pelo Git) com `GEMINI_API_KEY` e execute:

```bash
npx supabase start
npx supabase functions serve chat --env-file supabase/.env.local
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

A aplicação usa `HashRouter`, portanto URLs como `/#/chat/ID` continuam funcionando após atualizar a página no GitHub Pages.

## Deploy alternativo no Vercel

O arquivo `vercel.json` já configura o build estático. Importe o repositório no Vercel, cadastre as duas variáveis públicas e defina `VITE_BASE_PATH=/`. A Edge Function continua hospedada no Supabase; a chave Gemini não deve ser cadastrada no projeto Vercel.

## Segurança

- Nenhuma chave Gemini ou service role é incluída no frontend.
- RLS e grants limitam cada usuário aos próprios dados.
- A Edge Function valida o token no servidor e não aceita histórico arbitrário do cliente.
- Mensagens pertencem à mesma combinação `conversation_id + user_id` por constraint de banco.
- Rate limit básico é aplicado no backend.
- Respostas são renderizadas por `react-markdown`, sem HTML bruto.

Antes de produção, ajuste limites de uso ao seu plano e configure monitoramento de erros sem registrar conteúdo sensível ou secrets.
