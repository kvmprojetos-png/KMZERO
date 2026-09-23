# 🏗️ KMZERO

Sistema de gestão inteligente de obras da **KM Consultoria, Assessoria e Serviços de Engenharia Ltda**.

## 🚀 Funcionalidades

- 📄 RDOs (Relatório Diário de Obra) automatizados
- 📅 RDO Semanal Consolidado
- 💰 Folha Quinzenal de pagamento por diária
- 👥 Gestão de equipe e trabalhadores
- 📦 Pedidos de material com aprovação
- 📷 Galeria de fotos por obra
- 🔄 Movimentações de pessoal e equipamento
- ⛽ Controle de combustível
- 💸 Despesas avulsas
- 📊 Dashboard com indicadores
- 🏗️ Cronograma de obras

## 💻 Desenvolvimento local

```bash
npm install
npm run dev
```

Acesse: http://localhost:5173

## 🚀 Build de produção

```bash
npm run build
npm run preview
```

## 📱 PWA

App pode ser instalado como aplicativo nativo no celular ou desktop.

## ☁️ Nuvem (Firebase) — como funciona

Projeto Firebase: `kmzero-aca24` (login com Google, Firestore e Storage).
Site em produção: https://kmzero.vercel.app (a Vercel publica sozinha a cada push na branch `main`).

**Acesso é sempre pela conta Google (Gmail), com uma tela só.** Ninguém digita senha no app.

Modelo multiempresa (SaaS):

| Onde | O que guarda |
|---|---|
| `usuarios/{uid}` | perfil de cada login Google: `empresaId`, `perfil` (gestor/encarregado), `obraId`, `ativo` |
| `convites/{email}` | convite do gestor: "este Gmail entra na empresa X como Y" (vira perfil no 1º login) |
| `empresas/{empresaId}` | cadastro da empresa (`gestorUid` = quem criou) |
| `empresas/{empresaId}/{colecao}` | obras, trabalhadores, equips, pedidos, rdos, presencas, fotosObras… |

Fluxos:

- **Entrar com Google** → o app confere o perfil na nuvem e abre o painel certo (gestor ou equipe).
- **Primeira vez, sem empresa** → "Criar minha empresa": cria a empresa e o perfil do gestor com a conta Google.
- **Equipe**: Sistema → Acessos do App → Adicionar → o gestor cadastra o **Gmail** da pessoa, a obra e o cargo. No celular dela: "Entrar com Google" com esse Gmail e pronto.
- Todos os cadastros e lançamentos sincronizam entre os aparelhos em tempo real (`src/lib/cloudSync.js`). Fotos em base64 ficam só no aparelho; fotos de obra sobem pelo Storage.
- **Desativar acesso** bloqueia a pessoa: a nuvem passa a recusar e o app dela sai sozinho na próxima abertura (com internet). Dá para reativar.
- **Senha**: é a da conta Google e fica só no Google. O app não guarda senha de ninguém.
- **Offline**: a sessão do Google e o cache do Firestore ficam no aparelho. Sem sinal o app continua com os dados já baixados e o que for lançado sobe quando a conexão voltar. Sair da conta exige internet para entrar de novo.
- **Sair / trocar de empresa** recarrega o app para nunca misturar dados de duas empresas no mesmo aparelho.
- **Restaurar backup** mescla o arquivo aos dados atuais (mesmo id vence). **Apagar lançamentos** e **Gerar 30 dias** afetam a nuvem e todos os aparelhos da empresa: use só em empresa de teste.

### Ativar o login com Google (obrigatório uma vez, no console do Firebase)

1. https://console.firebase.google.com → projeto `kmzero-aca24` → **Authentication** → **Sign-in method** → **Google** → Ativar → informe o e-mail de suporte → Salvar.
2. **Authentication** → **Settings** → **Authorized domains** → **Add domain** → `kmzero.vercel.app` (`localhost` já vem liberado).
3. Deixe o provedor **E-mail/senha** ativado: o app não o usa, mas o script de teste abaixo cria contas temporárias por ele.

### Publicar as regras de segurança (obrigatório uma vez)

As regras em `firestore.rules` e `storage.rules` isolam cada empresa e só aceitam convite para e-mail verificado (conta Google). Sem elas publicadas, o cadastro e o login falham.

```bash
npm run firebase:login
```

```bash
npm run firebase:deploy-regras
```

Depois confira tudo (cria e apaga contas temporárias, sem tocar em dados reais):

```bash
npm run firebase:testar
```

Alternativa sem terminal: Console Firebase → Firestore Database → Regras → colar o conteúdo de `firestore.rules` → Publicar (e o mesmo em Storage → Regras com `storage.rules`).

### Primeiro uso depois desta versão

- Quem já tinha conta com e-mail e senha entra com o Google usando o **mesmo** Gmail: o Firebase junta as duas e o perfil continua o mesmo.
- Acessos antigos da equipe criados com "usuário sem @" não entram mais: cadastre o Gmail da pessoa em Acessos do App.
- Faça o primeiro login **no aparelho que tem os dados reais**: ele envia os cadastros para a nuvem e os outros aparelhos passam a receber. Antes disso, vale exportar um backup em Sistema → Backup.

## 🌐 Site e domínio próprio

O endereço do KMZERO tem duas partes:

- **`/` (a raiz)** é a **vitrine**: página pública que apresenta o KMZERO Obras (o que faz, para quem, contato). Não pede login e não carrega o sistema.
- **`/app/`** é o **sistema**: a tela de login e o app de campo/escritório. É esse endereço que a equipe instala no celular (ícone na tela inicial, funciona sem sinal). Quem já entrou uma vez e abre a raiz é levado direto para `/app/`.

Hoje: https://kmzero.vercel.app (vitrine) e https://kmzero.vercel.app/app/ (sistema).

### Domínio próprio (ex.: kmzero.com.br) — passo a passo

Não precisa programar. Tenha em mãos o login da Vercel e do Firebase; leva uns 30 minutos mais o tempo de espera do item 4.

1. **Registrar o domínio**
   - `.com.br`: em https://registro.br → pesquisar `kmzero.com.br` → registrar. Pede CPF ou CNPJ e o valor é anual e baixo (algumas dezenas de reais por ano).
   - `.app`: em um registrador internacional (Namecheap, GoDaddy, Squarespace Domains…) → pesquisar `kmzero.app` → registrar (cartão internacional).
2. **Avisar a Vercel**: https://vercel.com → projeto `kmzero` → **Settings** → **Domains** → **Add** → digitar o domínio (ex.: `kmzero.com.br`) → Add. A Vercel mostra na tela os registros de DNS que ela espera. Deixe essa tela aberta.
3. **Apontar o domínio para a Vercel**: no painel DNS do registrador (no Registro.br: "Editar zona DNS"; nos outros: "DNS" ou "DNS Management"), crie dois registros:
   - Tipo **A** · nome `@` (ou em branco) · valor `76.76.21.21`
   - Tipo **CNAME** · nome `www` · valor `cname.vercel-dns.com`

   Use exatamente os valores que a Vercel mostrou no passo 2. Se forem diferentes destes, valem os da Vercel.
4. **Esperar propagar**: de alguns minutos até algumas horas. Na tela Domains da Vercel o domínio ganha um ✓ verde quando estiver pronto (o certificado HTTPS é emitido sozinho).
5. **Liberar o login com Google no domínio novo**: https://console.firebase.google.com → projeto `kmzero-aca24` → **Authentication** → **Settings** → **Authorized domains** → **Add domain** → `kmzero.com.br` (e também `www.kmzero.com.br`, se for usar). Sem isso, o botão "Entrar com Google" dá erro no domínio novo.
6. **Conferir**: abrir `https://kmzero.com.br` (vitrine) e `https://kmzero.com.br/app/` (sistema) e fazer um login de teste.

> **Depois do domínio, reinstale o app no celular pelo endereço novo**: abrir `https://kmzero.com.br/app/` no navegador → menu → "Adicionar à tela inicial" / "Instalar app". O ícone antigo, instalado por `kmzero.vercel.app`, continua abrindo o endereço antigo (que segue funcionando); remova-o para a equipe não confundir.

## 🔔 Avisos e notificações

- **No app**: sininho (🔔) com contador em todas as telas iniciais e "Avisos" no menu lateral. O gestor escreve aviso para *todos*, *gestores e diretores*, *encarregados*, *uma obra* ou *uma pessoa*; o encarregado escreve para o escritório.
- **Automáticos**: pedido de material novo (→ gestores) e aprovado/negado (→ quem pediu); e, pelo servidor, duas vezes por dia:
  - **~16h (seg–sex)**: obra sem ponto lançado → lembrete para o encarregado da obra;
  - **~19h**: ponto ainda não lançado, pagamento no próximo dia útil (Equipe 1/2, mensal) e prazos (contrato perto do fim/vencido, etapa atrasada, ASO, equipamento quebrado) → gestores. Cada alerta de prazo é avisado **uma vez**.
- **No celular com o app fechado**: Firebase Cloud Messaging + `api/notificar.js` e `api/cron-avisos.js` (funções da Vercel). No iPhone só funciona com o app **instalado na Tela de Início** (iOS 16.4+).

### Ligar as notificações no celular (uma vez)

São 3 variáveis na Vercel → projeto → **Settings → Environment Variables** (ambiente *Production*):

| Variável | De onde vem |
|---|---|
| `VITE_FCM_VAPID_KEY` | Firebase → ⚙️ Configurações do projeto → **Cloud Messaging** → *Certificados push da Web* → **Gerar par de chaves** → copiar a chave (é pública) |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase → ⚙️ Configurações do projeto → **Contas de serviço** → **Gerar nova chave privada** → abrir o `.json` baixado e colar **o conteúdo inteiro**. É secreta: não mande por e-mail/WhatsApp, não suba no GitHub e apague o arquivo depois de colar |
| `CRON_SECRET` | Uma senha longa inventada por você (ex.: 40 letras e números). A Vercel a usa para chamar a verificação das 16h/19h |

Depois: **Deployments → ⋯ → Redeploy**. Para conferir: app → 🔔 Avisos → **Ativar notificações** → **Testar**.

## � Documentação Técnica

- [Dossiê Técnico KMZero](./docs/DOSSIE_TECNICO_KMZERO.md)

## �👤 Responsável Técnico

**Eng. Kleber Vieira Martins**
CREA-ES
📧 kvmprojetos@gmail.com
📞 (28) 99925-8172
