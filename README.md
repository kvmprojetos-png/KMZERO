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

## � Documentação Técnica

- [Dossiê Técnico KMZero](./docs/DOSSIE_TECNICO_KMZERO.md)

## �👤 Responsável Técnico

**Eng. Kleber Vieira Martins**
CREA-ES
📧 kvmprojetos@gmail.com
📞 (28) 99925-8172
