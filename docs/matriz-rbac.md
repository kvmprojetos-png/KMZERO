# Contrato de permissões — 2026-10-05

O gestor com `acessos` ausente/null mantém todas as áreas. Uma lista concede somente as áreas enumeradas, nunca acesso implícito por `visao` ou `sistema`. Encarregado tem acesso operacional apenas à obra vinculada; obraId numérico e string equivalente são aceitos.

| Coleção | Gestor leitura | Gestor escrita | Encarregado |
|---|---|---|---|
| obras | obras, financeiro | obras; financeiro apenas campos de contrato | negado |
| obrasCampo | qualquer gestor | obras (projeção) | leitura do diretório mínimo |
| trabalhadores | equipe | equipe | negado |
| trabalhadoresCampo | qualquer gestor | equipe (projeção) | leitura obraId própria |
| perfisCampo | todos ativos | equipe, sistema (projeção); próprio espelho validado contra perfil | leitura; próprio espelho validado |
| usuarios global | próprio; equipe, sistema mesma empresa | sistema poderes; equipe dados simples/desligar campo | próprio, dados simples sem mudar obra |
| convites global | próprio email; equipe, sistema | sistema | próprio email |
| presencas | equipe, campo | equipe | leitura/escrita própria obra; trabalhador precisa pertencer à obra; não sobrescreve correção do gestor |
| ferias, adiantamentos, folhasSalvas | equipe | equipe | negado |
| movimentacoes | equipe | equipe | origem/destino própria obra; cria Aguardando, nunca aprova |
| clientes | obras | obras | negado |
| fornecedores | suprimentos, financeiro | suprimentos | negado |
| pedidos, recebimentos | suprimentos, financeiro | suprimentos | leitura própria obra; pedidos cria Aguardando com uid autor; recebimento própria obra |
| equips, ativos, ferramentas, manutencoes, abastecimentos, movEquip | equipamentos, financeiro | equipamentos | leitura própria obra; só status de equips; transferência Aguardando |
| despesasAvulsas | financeiro | financeiro | negado |
| cronogramas | obras, campo | obras | leitura própria obra |
| rdos, diario, produtividade | campo | campo | própria obra |
| fotosObras | campo | somente API Admin autenticada | própria obra via API |
| config, links | todos ativos | sistema | leitura |
| mensagens | participante de/para | autor cria; destinatário só marca lida | igual |
| avisos | remetente ou destinatário pelo tipo/pessoa/obra/área | cria com uid próprio, sem estado push; área precisa ser autorizada | só cria para gestores/pessoa ou áreas campo/suprimentos; read destinatário |
| pushTokens/avisosLeitura | próprio | próprio | próprio |
| avisosEnviados | nenhum cliente | nenhum cliente | negado |
| outra coleção desconhecida | negado | negado | negado |

Projeções têm allowlist estrita:

- `trabalhadoresCampo`: `id,nome,cargo,obraId,ativo`
- `obrasCampo`: `id,nome,local,status,tipo,apontadorId`
- `perfisCampo`: `id,firebaseUid,nome,perfil,obraId,ativo`

Campos de contrato protegidos em obras: `cliente,clienteDoc,valorContrato,dataInicioContrato,dataFimContrato,formaPagContrato,obsContrato`.

As consultas do encarregado incluem `where obraId in [valor,string(valor)]` (quando os tipos diferem); movimentacoes e movEquip usam OR origem/destino. ObrasCampo é diretório mínimo das obras, sem contratos. Mensagens usam OR `de == uid` / `para == uid`. Avisos usam ramos separados por remetente, destinatário pessoa, tipo, obra e área. Tipo `area` requer `para.area` em equipe/campo/obras/suprimentos/equipamentos/financeiro/sistema/total. `total` aceita somente gestor sem restrições. Dados legados precisam da migração administrativa antes de liberar o cliente novo.

