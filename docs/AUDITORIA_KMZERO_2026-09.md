<!-- Gerado em 22/09/2026 por auditoria automatizada (6 auditores por área, 48 suspeitas verificadas uma a uma por refutador independente, 45 confirmadas, consolidação revisada por crítico de completude). Referências arquivo:linha apontam para o branch fix/firebase-multiempresa, commit b9e94f7 (PR #3). -->

# Auditoria KMZERO Obras — setembro de 2026

Consolidação de seis auditorias (fluxo de campo, dados, módulos, segurança, mobile, arquitetura) sobre o branch `fix/firebase-multiempresa`, revisada em segunda passada: cada afirmação abaixo foi conferida em arquivo:linha; números sem medição foram retirados. Três bugs relatados foram refutados (PIN, "Gerar 30 dias" para gestor comum, canvas do iPhone) e não aparecem em B. Fato de entrada: o repositório `github.com/kvmprojetos-png/KMZERO` é **público** (`git remote` + API do GitHub responde 200 sem token). Termos técnicos são explicados na primeira vez.

## A. O que já está realmente bom e deve ser preservado

- **`useSyncColecao`** (`src/lib/cloudSync.js:19-121`): espelha cada coleção entre celular e nuvem com regras defensáveis — só envia após o 1º retorno da nuvem, só aplica remoções quando a resposta vem do servidor, guarda os ids conhecidos para aplicar remoções feitas com o app fechado. É o formato que todo o resto deve seguir.
- **Cache persistente do Firestore** (`src/firebase.js:21-29`). Firestore é o banco do Firebase; com o cache, todo lançamento em texto feito sem sinal fica na fila e sobe sozinho. Certo para encarregado com celular ruim.
- **Isolamento entre empresas em todas as camadas**: regras do banco e do depósito de arquivos (`firestore.rules:47-107`, `storage.rules:12-37`), prefixo `<empresaId>_` no armazenamento local (`store.js:293-295`, `fileStore.js:6-9`) e teste ponta a ponta com intruso e usuário desativado (`scripts/testar-firebase.mjs:77-147`).
- **Nenhuma foto em base64 sobe para o banco** (`store.js:57-91`). Base64 é a foto convertida em texto; o Firestore limita 1 MB por documento e `semDataUrl` evita esse erro clássico.
- **Presença em dois toques, um documento por dia+trabalhador com id determinístico** (`presenca.jsx:15-17,207`; `KMZeroApp.jsx:439-447`): regravar o dia não duplica.
- **Login pensado para obra**: "Continuar como" sem internet (`auth.jsx:481-508`), cadastro retomável sem empresa órfã (`registro.jsx:53-71`; `store.js:160-190`), conta da equipe criada sem derrubar o gestor nem sequestrar conta de outra empresa (`firebase.js:118-146`; `store.js:228-252`).
- **Pedido de material em cesta** com busca tolerante a acentos, item fora do catálogo, aprovação com forma de pagamento e PDF A6 para o fornecedor (`suprimentos.jsx:44-140, 560-609, 1143-1343`). É o ciclo mais completo entre celular e escritório (presença e RDO também chegam ao gestor pelos observadores `KMZeroApp.jsx:153-162, 214-226`); a ressalva é o bug 11.
- **Carimbo de foto** com número, obra, autor, data/hora e redução a 1600 px (`suprimentos.jsx:312-408`). O problema é que só dois fluxos o usam.
- **Cronograma com regra de negócio pura e testável** (`rdo.jsx:253-350`: IDP, curva S). É o modelo para folha, custos e datas.
- **Motor de folha** com diarista e CLT, feriados automáticos e ciclo ancorado no último pagamento (`presenca.jsx:937-977`).
- **Visualizador de PDF** com zoom, imprimir e compartilhar por WhatsApp, com tratamento para iPhone (`pdf.js:210-641`).

## B. Bugs e riscos críticos (só os confirmados; cite arquivo:linha; marque severidade)

Legenda: localStorage = memória do navegador (~5 MB por site); Storage = depósito de arquivos do Firebase; IndexedDB = banco local do navegador, sem limite prático.

| # | Sev. | Bug (estado → ação → resultado) | Onde |
|---|---|---|---|
| 1 | Alta | Encarregado sem obra (celular novo antes do 1º sync, obra excluída, "sem obra fixa") → toca Presença/Material/Fotos → **tela branca**; não há ErrorBoundary (rede de proteção contra erro de tela). Se a obra dele foi apagada e existem outras, cai em silêncio na mais antiga e lança presença/RDO nela. | `KMZeroApp.jsx:232,669`; `presenca.jsx:38,44,87`; `main.jsx` |
| 2 | Alta | Botão "Enviar Fotos" da home → tira fotos → "enviadas!" → **nunca sobem**. É a única diferença em relação a "fluxo" e "diário", que usam `salvarFotoObraSync`. | `KMZeroApp.jsx:663`; `midia.jsx:78` |
| 3 | Alta | Foto sem sinal: o Storage não tem fila offline; o SDK tenta por até 10 min com o app aberto e depois `enviarFotoNuvem` devolve `false` sem ninguém reenviar. Se o encarregado fecha o app ou o sinal demora mais, o RDO chega com "5 fotos" e a galeria fica vazia. | `store.js:24-41`; `KMZeroApp.jsx:183-186` |
| 4 | Alta | Cada foto do dia é gravada **duas vezes em base64** no localStorage (galeria + `rdo.fotos`) e nunca trocada pela URL após o upload. A duplicação é fato; o prazo até estourar a cota não foi medido, mas é de dias. A partir daí nada persiste e aparece "Armazenamento cheio!" a cada ação. | `KMZeroApp.jsx:360,373`; `presenca.jsx:425`; `store.js:331-333` |
| 5 | Alta | Cinco capturas gravam a foto **crua** (ficha/CTPS/CPF, comprovante, cupom, recebimento, logo): uma foto de 12 MP estoura a cota sozinha e trava a persistência da coleção inteira; essas fotos nunca chegam a outro aparelho. | `equipe.jsx:337-343,1496`; `financeiro.jsx:55-61`; `equipamentos.jsx:153-159`; `suprimentos.jsx:1360-1366` |
| 6 | Alta | Cinco coleções fora do `useSyncColecao`: **remoção não propaga em nenhuma** (rdos, pedidos, mensagens, fotosObras, presencas); **edição não propaga só em rdos** (pedidos/mensagens/presencas fazem "nuvem vence"). Efeitos: foto excluída na galeria "volta"; RDO corrigido pelo gestor sai antigo no celular. "Zerar tudo" apaga 10 coleções na nuvem sem volta e as 5 ressuscitam, embora a tela prometa "apaga também na nuvem" para exatamente essas 5; "Reset Total" só limpa o localStorage e promete "primeira instalação". Decisão: alta pelo efeito em galeria e RDO; Zerar/Reset só aparecem para a conta do desenvolvedor (`home.jsx:297`). | `KMZeroApp.jsx:122-128,153-162,189-199,202-226,664,754-786`; `sistema.jsx:1120,1255` |
| 7 | Alta | `hojeStr()` usa UTC. Entre 21h e 23h59 a presença cai no **dia seguinte**; RDO sai com `data` 22/09 e `dataIso` 23/09; home do gestor às 21h30 mostra "0 presentes"; a confirmação da manhã seguinte sobrescreve e a diária some da folha. Decisão: alta (corrompe folha em silêncio, correção de 6 linhas). | `utils.js:1,7`; `KMZeroApp.jsx:233,440`; `presenca.jsx:355-357,838` |
| 8 | Alta | Senha da equipe (a mesma do Firebase Auth) em **texto claro** no localStorage, na coleção `acessos` e no backup JSON compartilhado; exibida na lista. A política de privacidade afirma o contrário. | `auth.jsx:1118,1224`; `KMZeroApp.jsx:387,552`; `sistema.jsx:765` |
| 9 | Alta | "Custo de materiais" = nº de pedidos aprovados × R$ 100, em dois lugares; alimenta "Margem estimada" do contrato sem aviso. | `financeiro.jsx:278`; `obras.jsx:309,381-398` |
| 10 | Alta | Vale filtrado pelo mês, não pelo período: folha semanal desconta o mesmo adiantamento 4 vezes; regime "personalizado" nunca desconta; nada marca o vale como descontado. | `presenca.jsx:1043-1056`; `equipe.jsx:2137` |
| 11 | Alta | Pedido criado pelo gestor grava `obraId` como texto e sem `obra`/`enc`/`data` no formato das outras telas → some do recebimento, dos custos e do RDO; PDF sem endereço. O sync "nuvem vence" reimpõe o erro. | `suprimentos.jsx:845,855,1053`; `KMZeroApp.jsx:202-211` |
| 12 | Alta | Preços de alimentação não existem na tela Empresa (`EMPRESA_TEMPLATE` nunca é usado) → empresa nova vê "R$ NaN", grava `null` no RDO e o PDF imprime R$ 4,00 por linha e R$ 0,00 no total. Primeiro dia de todo cliente. | `presenca.jsx:163-199,430`; `rdo.jsx:787-802`; `sistema.jsx:816` |
| 13 | Alta | RDO diário lista **todas** as ocorrências e fotos do diário da obra, sem filtro de data; reemitir RDO antigo inclui anotações posteriores. | `rdo.jsx:902,1492,807-812,850-860` |
| 14 | Alta | Navegação não usa o histórico do navegador → Voltar do Android **fecha o app instalado** e pode descartar a presença em andamento. | `KMZeroApp.jsx:40-74` |
| 15 | Alta | Texto livre entra sem escape no HTML dos documentos, injetado via `innerHTML`/`document.write` na origem do app: um encarregado pode executar código no celular do gestor (XSS armazenado). Probabilidade baixa, impacto alto, correção barata. | `pdf.js:396,430`; `rdo.jsx:772,811`; `equipe.jsx:542` |
| 16 | Média | Card "Equipe da Obra" na home do encarregado leva a "Acesso Restrito — fale com o Kleber" em qualquer empresa. | `home.jsx:155`; `KMZeroApp.jsx:623,644` |
| 17 | Média | Alertas de ASO e manutenção navegam para telas inexistentes; o `default` do switch renderiza a tela de login com usuário logado. | `home.jsx:892-926`; `KMZeroApp.jsx:808` |
| 18 | Média | "Sair" sem confirmação faz `signOut`; sem sinal o encarregado não volta (o fallback por senha só funciona no celular do gestor). | `home.jsx:38`; `KMZeroApp.jsx:540-549`; `auth.jsx:460` |
| 19 | Média | Número do RDO e da foto = tamanho da lista + 1 (global): excluir um RDO repete o número; dois aparelhos offline emitem o mesmo nº; o número vai carimbado no pixel. | `rdo.jsx:904`; `presenca.jsx:354,361` |
| 20 | Média | Status "Quebrada" e leitura final do horímetro do fluxo do dia são descartados ao confirmar. | `presenca.jsx:13,266,350-433` |
| 21 | Média | Retomar acesso cuja conta existe sem perfil: `allow get` falha em documento inexistente e o app traduz para "pertence a outra empresa". | `store.js:242-248`; `firestore.rules:52-55` |
| 22 | Média | `permission-denied` (senha trocada, conta apagada) é tratado como "offline": o aparelho reabre logado e para de sincronizar em silêncio. | `KMZeroApp.jsx:239,332-339`; `store.js:216-222` |
| 23 | Média | Desativar acesso ou sair não limpa localStorage/IndexedDB: ex-funcionário fica com CPF, diária, PIX e folha de toda a empresa. `store.clear()` nunca é chamado. | `KMZeroApp.jsx:240-247,540-549`; `store.js:336-342` |
| 24 | Média | BAIXAR/ENVIAR PDF baixa html2canvas/jsPDF do CDN na hora; sem sinal falha; após uma falha o retry quebra até recarregar. | `pdf.js:2-14,461` |
| 25 | Média | Atualização silenciosa do PWA (app instalável): versão nova só na 2ª abertura, sem aviso; Sistema mostra "1.0.0" fixo. | `vite.config.js:9`; `sistema.jsx:627,804` |
| 26 | Média | 65 `alert` + 12 `confirm` nativos. Depois do spam de "Armazenamento cheio" (bug 4), o Chrome Android oferece "impedir novas caixas"; a partir daí `confirm()` devolve `false` em silêncio e "Salvar folha" e "Marcar PAGO" **deixam de funcionar** até recarregar. | `presenca.jsx:1406,1462`; `store.js:331-333` |

## C. O que está incompleto

- **Permissão por perfil existe só na interface.** As regras liberam leitura e escrita de toda coleção (exceto `acessos`) a qualquer usuário ativo (`firestore.rules:105-111`) e o app sincroniza tudo para o celular do encarregado (`KMZeroApp.jsx:384-403`): CPF, RG, diária, PIX, ASO, folha, clientes. `TELAS_GESTOR` (`KMZeroApp.jsx:622-631`) bloqueia ~13 nomes que não existem e deixa ~12 telas reais de fora. Dentro da empresa, as telas compartilhadas também não isolam por obra: `TelaMovEquip` começa em "todas" (`equipamentos.jsx:775,786`) e `TelaSolicitarMov` recebe todos os trabalhadores (`KMZeroApp.jsx:739`), contradizendo a FAQ (`sistema.jsx:383`).
- **Compras e financeiro não fecham o ciclo.** Pedido sem valor/fornecedor (`suprimentos.jsx:126-138`), aprovação só adiciona forma de pagamento (601-602), recebimento não muda status nem tem quantidade/NF (1368-1375). "Pagamentos" é só cadastro de contrato (`financeiro.jsx:382-483`) e Custos não compara com `valorContrato` (225-380): não existe "quanto recebi × quanto gastei", o indicador que vende para construtora pequena.
- **RDO não é documento defensável.** Clima fixo "Bom" (`presenca.jsx:418-419`), entrada/saída calculadas (`rdo.jsx:706-714`), `Assinatura` pronto e nunca usado (`ui.jsx:275`), fotos não chegam ao RDO do gestor (`rdo.jsx:1497` lê `r.fotos`, vazio na nuvem), cronograma recebido e não usado (`rdo.jsx:891`). No fluxo do dia a foto só vem da câmera (`capture="environment"`, `presenca.jsx:219`): quem fotografou durante o dia não anexa.
- **Folha:** hora extra do RDO nunca é paga (`presenca.jsx:392-399`), "Arquivar" não marca pago nem impede duplicidade (1405-1422), rótulo sempre "quinzena" (1080, 1513), `TelaFolha` importada e nunca renderizada, dois menus para a mesma tela (`home.jsx:242,252`).
- **Ciclo trabalhador ↔ acesso ↔ obra e lotação histórica.** Três cadastros ligados por nome (`equipe.jsx:209`; `KMZeroApp.jsx:698`); "apontador" não muda a obra do usuário (`obras.jsx:144-150`); remover trabalhador não chama `definirAcessoAtivo` (`KMZeroApp.jsx:698-704`). Movimentação definitiva reescreve `trabalhadores.obraId` sem data (`KMZeroApp.jsx:563-566`) e o documento de presença não tem `obraId` (`KMZeroApp.jsx:445`): mover uma pessoa muda retroativamente folha, custos e RDO semanal de meses anteriores. Custo por obra é irreproduzível.
- **Presença "one-shot":** reabrir o fluxo regrava o dia por cima de correções do gestor (`presenca.jsx:15-17`); finalizar duas vezes gera dois RDOs; "Resumo de hoje" soma a empresa inteira (`home.jsx:15-17`). Encarregado não sabe o destino do pedido; "será notificado" não envia nada (`suprimentos.jsx:617`).
- **Anexos e comprovantes só no aparelho de origem** (`midia.jsx:494`; `cloudSync.js:104`); `empresa` nasce `{}` porque nada lê `empresas/{eid}` de volta (`store.js:166-170`), então RDO/pedido de empresa nova saem com "Kleber Vieira Martins" como padrão (`pdf.js:143-145`).
- **PIN e biometria são código morto** (refutado como bug: não há caminho para criar PIN, `auth.jsx:511-517`; os caminhos reais exigem senha). Textos prometem "CRIAR MEU PIN" (`auth.jsx:1011-1027`). Decidir: implementar ou apagar.
- **LGPD sem mecanismo e dados de demo em repositório público.** Sem trilha de quem lançou/alterou (`KMZeroApp.jsx:436,445`), sem exportação/exclusão por titular; política nega dados de saúde enquanto ASO e tipo sanguíneo sincronizam (`equipe.jsx:315,428`; `sistema.jsx:755`). `catalogos.js:157-273` traz 18 trabalhadores com nome, CPF, RG, telefone e endereço: conferido, **16 dos 18 CPFs são inválidos** e os RGs seguem padrão sequencial — dado majoritariamente fictício; nomes/endereços não foram verificados. Trocar por dado obviamente fictício continua barato e obrigatório (repositório público); reescrever histórico Git só se alguém confirmar dado real.
- **Escala sem medição:** 27 listeners leem coleções inteiras sem filtro (`store.js:126-128`) — o volume real e o custo devem ser medidos antes de decidir arquitetura. Sem versionamento de esquema (só `normIds` local, `KMZeroApp.jsx:295-303`). **Backup**: dump integral com base64 e senhas, sem `empresaId`; restaura `usuarios` (`KMZeroApp.jsx:467`) e o sync de `acessos` (387) re-sobe acessos removidos; um backup de outra empresa mesclado sobe para a nuvem desta.
- **Sem testes, lint ou CI** (`package.json:6-13`; sem `eslint.config`). **PWA** sem instalação guiada (no iPhone não instalado, o Safari pode apagar dados de site após ~7 dias de uso do navegador sem visitá-lo), sem indicador de conexão/pendências (`hasPendingWrites` chega e é ignorado, `store.js:129`), galeria sem miniaturas nem `loading="lazy"`. **PDF com fotos da nuvem** usa `useCORS: true` (`pdf.js:467`) e não há `cors.json` no repositório: BAIXAR/ENVIAR com foto do Storage é risco não testado.

## D. O que está complexo demais e pode ser simplificado

- **`KMZeroApp.jsx` como componente-deus:** 27 coleções com 6 pontos de manutenção cada e 5 sincronizações artesanais ao lado do hook genérico. Simplificar: tabela `COLECOES = [{nome, ordenar, gestorOnly}]` + hook `useColecao(nome)`; migrar rdos/pedidos/mensagens/presencas/fotos (remoção e edição passam a propagar de graça). Uma coleção por PR.
- **Switch de ~63 telas + `TELAS_GESTOR`** que já divergem. Simplificar: mapa `ROTAS = { nome: { comp, perfis } }`; render, bloqueio, voltar e validação derivam dele; teste que falha se algum `navegarPara` não existir.
- **Splash triplo com 4,5 s fixos** a cada abertura, dobrado no primeiro login pelo `reload` (`KMZeroApp.jsx:32-38,509,815-931`; `index.html:28-70`). Manter só o splash do HTML até `carregando=false`.
- **Finalizar o dia pede 3 confirmações** e a home do encarregado tem 9 botões + card bloqueado (`presenca.jsx:317-350`; `home.jsx:106-140`). Primeira dobra: Presença (com estado "já registrada"), Material, Foto; um único `confirmar()`, pedindo o clima ali.
- **Datas em quatro formatos** ("dd/mm/aaaa", "dd/mm/aaaa, hh:mm", ISO, timestamp) com 28 `split("/")` (conferido) e ordenação textual (`rdo.jsx:1257`); ids misturam número (`Date.now()`) e texto (`parseInt` de formulário). O RDO semanal, sem RDO na semana, pega os últimos 7 de qualquer data e reajusta seg/sex em silêncio (`rdo.jsx:931-948,975-982`). Contrato único: `dataIso` + `ts`, id sempre string, migração única no boot; seletor explícito de período no semanal.
- **Vários geradores de HTML/PDF** (RDO diário, semanal, cronograma, folha, pedido A6, ficha, relatórios da home) com cabeçalhos diferentes e fallbacks da KM. Um `documento({tipo, empresa, corpo, assinaturas})` em `pdf.js`, sem marca padrão, com jsPDF/html2canvas empacotados (ou `window.print()` com `@page`, que já existe).
- **Cabeçalho de imports copiado em 12 telas**; `recharts` importado em 12 arquivos e usado em 2 (conferido); imports mortos em quantidade não contada porque não há lint; bundle único de 1,9 MB. ESLint com `unused-imports` resolve em uma passada.
- **Vitrines com número inventado:** mapa por fórmula apesar de lat/lng real (`obras.jsx:599-606`), `TelaRelatorio` com dados de catálogo (`home.jsx:635`), "Materiais (est.)" e "Margem". Mostrar só dado real ou remover.
- **Resíduos:** `window.storage` inexistente que torna `store.get/set` assíncronos (`store.js:315-328`), diálogos nativos ao lado do `confirmar()` próprio (efeito prático no bug 26), três modelos de identidade, login sem e-mail em namespace global `@kmzero.app` (`firebase.js:104-107`).

## E. Arquitetura recomendada para a próxima versão (manter / introduzir / ordem / custo)

**Manter:** React + Vite + Firebase sem backend próprio; `useSyncColecao` e o cache persistente; regras multiempresa e o script de teste; localStorage só para metadados; IndexedDB para binários; carimbo de foto; PDF viewer. Não reescrever.

**Introduzir, nesta ordem (a ordem é a decisão; discordância entre auditores resolvida assim):**
1. **Semana 1 — PR "P0 triviais" (seção G)** e demais P0 de esforço baixo que não mudam o modelo de dados: preços de alimentação, adiantamentos por período, dado demo fictício, senha fora da persistência, custo "—", `reduzirImagem` nas 5 capturas. Nenhuma refatoração.
2. **Semana 2 — rede de proteção antes de refatorar:** ESLint (flat config), Vitest nas funções puras (cronograma já é; extrair folha, custos, datas para `src/domain/`), GitHub Actions com lint+test+build. Custo zero.
3. **Camada de mídia** (P0 em importância, 3º na ordem porque muda o modelo lido por `presenca.jsx:425`, `rdo.jsx:1497` e pelo PDF): `src/lib/imagem.js` + fila de upload no IndexedDB (`fileStore` já existe) com reenvio em `online`/abertura; documento guarda só `fotoUrl`/`fotoIds`; `maxUploadRetryTime` curto. Cobre fotos, cupons, comprovantes, docs de ficha e logo.
4. **`useColecao` + tabela de coleções**, migrando as 5 syncs artesanais; depois consultas por obra/período e resumos mensais, **após medir** o volume real de leituras.
5. **Mapa de rotas com perfil por rota** + histórico do navegador (`pushState/popstate`, sem router).
6. **Regras por perfil:** escrita em obras, trabalhadores, config, folhas, adiantamentos só para gestor; `trabalhadores_privado` (CPF, diária, PIX, ASO) só gestor; teste no emulador em CI. Custo zero (plano Spark).
7. **Cloud Functions** (exige plano Blaze, pago por uso): criar/redefinir/desativar acesso sem senha no cliente, apagar empresa, OCR de NF. Custo esperado baixo para poucas empresas, mas sem base de cálculo — definir orçamento com alerta no console antes de ligar. App Check + verificação de e-mail no cadastro.
8. **Code-splitting por tela** e `manualChunks` para firebase/recharts; jsPDF no bundle.

Capacitor (app nativo) não tem bloqueio estrutural, mas não resolve nenhum P0; só depois do item 4.

## F. Lista priorizada de melhorias — P0 / P1 / P2

| Pri. | Melhoria | Por quê | Esforço |
|---|---|---|---|
| P0 | Fotos, etapa 1: `fotos_solo` → `salvarFotoObraSync`; `enviarFotoNuvem` devolve URL e `salvarFotoObraSync` troca o base64 pela URL no estado | Bug 2; corta pela metade o crescimento do localStorage (bug 4) | Baixo |
| P0 | `hojeStr`/`ultimosDias` em data local + os 5 `toISOString().split` restantes | Bug 7, folha corrompida | Baixo |
| P0 | Guarda `!obraAtual` (tela "Sem obra vinculada") + ErrorBoundary em `main.jsx` + `obraAtual` sem fallback `obras[0]` para não-gestor | Bug 1 | Baixo |
| P0 | Não persistir senha: tirar de `novo`, do sync, do backup e da lista; remover fallback offline por senha; corrigir política | Bug 8, bloqueia venda | Baixo |
| P0 | Custo de materiais "—" nos dois lugares e ocultar "Margem" até existir valor | Bug 9 | Baixo |
| P0 | Preços de alimentação na tela Empresa + helper único `precoAlim` sem `\|\| 4` | Bug 12, dia 1 de todo cliente | Baixo |
| P0 | Adiantamentos filtrados pelo período e marcados `descontadoEm` ao arquivar | Bug 10 | Baixo |
| P0 | Substituir `DEFAULT_TRABALHADORES` por dado obviamente fictício; demo por `import.meta.env.DEV` | Repositório público | Baixo |
| P0 | `reduzirImagem` nas 5 capturas cruas | Bug 5 | Baixo |
| P0 (após semana 2) | Fotos, etapa 2: fila de reenvio no IndexedDB, `rdo.fotoIds` no lugar de `rdo.fotos`, `maxUploadRetryTime` curto, aviso "N fotos aguardando sinal" | Bugs 3, 4; muda o modelo, exige teste | Médio |
| P0 (após semana 2) | Valor/fornecedor na aprovação e NF/quantidade no recebimento, com mudança de status | Ciclo de compras; é o dado que falta para custo real | Médio |
| P1 | Migrar rdos/pedidos/mensagens/presencas/fotosObras para `useSyncColecao`; excluir foto apaga doc + Storage; "Zerar" apaga explicitamente; textos de Zerar/Reset verdadeiros | Bug 6 | Médio |
| P1 | Pedido do gestor com `obraId` numérico e `obra/enc/data` padronizados; `normIds` no observer | Bug 11 | Baixo |
| P1 | RDO defensável: ocorrências por data, clima perguntado, `numero = max por obra + 1`, um RDO por obra/dia, `Assinatura`, fotos por `fotoIds`, input de foto sem `capture` fixo | Bugs 13, 19; RDO incompleto | Médio |
| P1 | `pushState/popstate` no `setTela` | Bug 14 | Baixo |
| P1 | `esc()` em toda interpolação + DOMPurify no viewer + CSP | Bug 15 | Baixo |
| P1 | Regras por perfil + `trabalhadores_privado` + `syncGestor` nessas coleções + filtro por obra nas telas compartilhadas + teste no emulador | Encarregado carrega dados de todos | Médio |
| P1 | `apagarDadosLocaisEmpresa` ao perder acesso; `permission-denied` encerra sessão; indicador "sem sincronizar desde" | Bugs 22, 23 | Baixo |
| P1 | Mapa de rotas + allowlist por perfil; corrigir alertas `aso/manutencoes`; `default` volta à raiz; card Equipe somente leitura; texto sem "Kleber" | Bugs 16, 17 | Médio |
| P1 | Confirmação no Sair; "trocar usuário" sem `signOut` | Bug 18 | Baixo |
| P1 | ESLint + Vitest + CI | Pré-requisito das refatorações | Médio |
| P1 | jsPDF/html2canvas no bundle; `cors.json` no bucket; `virtual:pwa-register` com aviso "Atualizar"; `__APP_VERSION__` em Sistema | Bugs 24, 25; PDF com foto da nuvem | Baixo |
| P1 | `useConfirm()`/toast React no lugar dos 77 diálogos nativos; aviso único de cota | Bug 26 | Baixo |
| P1 | Persistir status de equipamento e horímetro do fluxo do dia | Bug 20 | Baixo |
| P1 | Regra `allow get` tolerante a doc inexistente + caso no script de teste | Bug 21 | Baixo |
| P1 | Folha: um motor por intervalo, HE paga, apagar `TelaFolha` e menu duplicado | Folha incompleta | Médio |
| P1 | Lotação com data: `movimentacoes` registra a troca de obra; presença grava `obraId`; relatórios por período usam isso | Custo por obra irreproduzível | Médio |
| P1 | Trilha de auditoria (`_meta` em toda escrita + coleção `auditoria`) | Disputa trabalhista | Médio |
| P1 | Receita × custo por obra: medições/faturas em Pagamentos comparadas ao custo real | Indicador que vende; depende do P0 de compras | Médio |
| P2 | Splash único sem timer; home do encarregado com 3 ações; um `confirmar()` ao finalizar | Experiência de campo | Baixo |
| P2 | Medir leituras reais; depois consultas por obra/período + resumos mensais + índices | Cota e 3G | Alto |
| P2 | Medição de avanço: `qtdPrevista`/unidade/preço por etapa, produtividade amarrada à etapa, % físico = executado/previsto | Progresso hoje é slider manual | Alto |
| P2 | Code-splitting, `manualChunks`, IndexedDB com debounce | Celular barato | Médio |
| P2 | Instalação guiada, indicador de conexão, miniaturas na galeria | Adoção | Baixo |
| P2 | Backup sem binários/senhas/`usuarios`, com `empresaId` e versão; recusar empresa diferente; `SCHEMA_VERSION` | Escala e suporte | Médio |
| P2 | Cloud Functions para contas/senhas; App Check; e-mail verificado | Produto aberto | Médio |

## G. Próxima ação concreta (uma única ação, com o primeiro passo executável)

**Ação:** abrir o branch `fix/p0-campo` a partir de `fix/firebase-multiempresa` e fechar um PR "P0 triviais" — só correções de até ~30 linhas, sem mudança de modelo, em uma tarde, nesta ordem: (1) `KMZeroApp.jsx:663` → `onSalvar={salvarFotoObraSync}`; (2) `hojeStr`/`ultimosDias` em data local (`utils.js:1-10`) + os 5 `toISOString().split` restantes; (3) ErrorBoundary em `main.jsx` + guarda `!obraAtual` nas 5 telas de campo + `obraAtual` sem fallback para não-gestor (`KMZeroApp.jsx:232`); (4) parar de persistir senha (`auth.jsx:1118/1224`, `KMZeroApp.jsx:387,552`) e corrigir `sistema.jsx:765`; (5) custo de materiais "—" (`financeiro.jsx:278`, `obras.jsx:309-310`, esconder 381-398); (6) `enviarFotoNuvem` devolve a URL e `salvarFotoObraSync` troca o base64 pela URL. A fila de fotos, `fotoIds` e IndexedDB ficam para depois de ESLint+Vitest (E, passo 2).

**Primeiro passo (10 minutos):** `git checkout -b fix/p0-campo`; em `src/KMZeroApp.jsx:663` trocar `onSalvar={f => setFotosObras(fs => [f, ...fs])}` por `onSalvar={salvarFotoObraSync}`; `npm run build`; publicar (push para a Vercel — build local não chega ao celular). **Critério de aceite:** no celular, abrir o PWA **duas vezes** (bug 25) para receber a versão nova; tocar "Enviar Fotos" e tirar uma foto; no computador do gestor, a foto aparece na Galeria **e** o gestor gera BAIXAR/ENVIAR de um RDO com essa foto — isso testa o CORS do bucket; se o PDF sair sem a foto, criar `cors.json` e aplicar com `gsutil cors set` antes de seguir.

## H. Onde IA gera ganho real (e o que é enfeite)

**Ganho real, nesta ordem:**
1. **Leitura de nota fiscal e cupom por foto** (recebimento, abastecimento, despesa). Cria o dado que falta — valor, itens, fornecedor, litros — sem digitação na obra. Depende do P0 de compras e das fotos chegarem à nuvem; exige Blaze; custo por foto a medir.
2. **Voz e foto → RDO estruturado.** O ditado já existe (`presenca.jsx:723-745`); um modelo transforma 30 s de fala em serviços por etapa, ocorrências, clima e efetivo. Resolve o RDO vazio. Depende de perguntar o clima e de o ditado funcionar no iPhone.
3. **Resumo semanal para o cliente e para o gestor** em texto pronto para WhatsApp. Os números vêm do código (curva S, presenças, recebimentos); o modelo só redige. Entrega o "portal do cliente" sem portal.
4. **Alertas de desvio e anomalia** (custo × contrato pelo EVM já calculado, combustível fora do padrão do ativo, presença em duas obras). Regra determinística, sem custo por chamada; IA só para explicar. Não fazer antes de custo real de materiais, senão repete o "×100".
5. **Apoio LGPD:** aviso de dado pessoal em texto livre antes de gravar e relatório de solicitação de titular. Útil quando existir trilha de auditoria.

**Enfeite hoje:** chat genérico "pergunte ao KMZERO" e "insights de IA" no painel (custo e data ainda errados — a resposta pareceria inteligente e estaria errada); cronograma gerado do zero sem orçamento por etapa; detecção de EPI em foto (falso positivo cria atrito); sugestão de pedido por histórico antes de meses de dados reais; classificação de fotos antes de a galeria ter miniaturas. Regra: primeiro a IA que cria o dado (1), depois a que usa o dado (4), depois comunicação (2 e 3).