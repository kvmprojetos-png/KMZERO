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

Projeto Firebase: `kmzero-aca24` (Auth por e-mail/senha, Firestore e Storage).
Site em produção: https://kmzero.vercel.app (a Vercel publica sozinha a cada push na branch `main`).

Modelo multiempresa (SaaS):

| Onde | O que guarda |
|---|---|
| `usuarios/{uid}` | perfil de cada login: `empresaId`, `perfil` (gestor/encarregado), `obraId`, `ativo` |
| `empresas/{empresaId}` | cadastro da empresa (`gestorUid` = quem criou) |
| `empresas/{empresaId}/acessos` | lista de acessos do app (só o gestor lê) |
| `empresas/{empresaId}/{colecao}` | obras, trabalhadores, equips, pedidos, rdos, presencas, fotosObras… |

Fluxos:

- **Criar minha empresa** → cria a conta do gestor, a empresa e o perfil.
- **Sistema → Acessos do App → Adicionar** → o gestor cria a conta do encarregado na nuvem.
- **Primeiro acesso da equipe** (tela de login, em qualquer celular) → e-mail + senha → o app baixa a obra, a equipe e tudo da empresa.
- Todos os cadastros e lançamentos sincronizam entre os aparelhos em tempo real (`src/lib/cloudSync.js`). Fotos em base64 ficam só no aparelho; fotos de obra sobem pelo Storage.
- **Remover acesso** desativa a pessoa em todos os aparelhos.

### Publicar as regras de segurança (obrigatório uma vez)

As regras em `firestore.rules` e `storage.rules` isolam cada empresa. Sem elas publicadas, o cadastro e o login falham.

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

Faça o primeiro login **no aparelho que tem os dados reais**: ele envia os cadastros para a nuvem e os outros aparelhos passam a receber. Antes disso, vale exportar um backup em Sistema → Backup.

## � Documentação Técnica

- [Dossiê Técnico KMZero](./docs/DOSSIE_TECNICO_KMZERO.md)

## �👤 Responsável Técnico

**Eng. Kleber Vieira Martins**
CREA-ES
📧 kvmprojetos@gmail.com
📞 (28) 99925-8172
