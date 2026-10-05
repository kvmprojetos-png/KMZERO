# Saída e dados do aparelho

A saída agora tem um contrato de integração explícito em `src/lib/saidaSegura.js`.
O módulo não executa operações sozinho, não exporta para serviços externos e não
limpa os dados apenas por ter iniciado um download.

## Integração no aplicativo

1. No boot, `await aguardarSessao()` antes de mostrar dados locais. Verificar
   `lerLimpezaPendente()`: se existir e não houver conta autenticada, executar
   `concluirLimpezaPendente()` e recarregar. Falha bloqueia a abertura dos caches.
2. `await registrarAbaProtegida()` em cada aba antes de permitir edição. O Web
   Locks usa trava compartilhada; a limpeza exige trava exclusiva. Uma aba de
   versão antiga ainda pode ser detectada por `clearIndexedDbPersistence`.
3. Só depois de confirmar o perfil remoto, vincular cache novo com
   `marcarDonoCacheLocal(empresaId, uid)`. `donoCacheLocal` divergente não pode ser
   reutilizado, nem quando as duas contas têm a mesma empresa. Ausência da marca
   num cache legado não é prova de propriedade.
4. Ao sair, suspender edição, envio e persistência do estado React. Finalizar as
   operações de sincronização já iniciadas. `prepararSaida({empresaId, uid, perfil})`
   monta a cópia completa de coleções locais, anexos base64 e IndexedDB.
5. Havendo dados, oferecer `baixarBackupSaida(plano)` e uma confirmação explícita
   de que a pessoa salvou o arquivo. A cópia contém dados empresariais e deve ser
   guardada em local privado. Um clique sozinho não libera a exclusão.
6. `executarSaida({plano, backupConfirmado, aguardarSincronizacao?})` confirma as
   gravações remotas, compara o hash do estado atual, limpa o cache Firestore,
   encerra a conta e limpa anexos/coleções locais daquela empresa. O callback
   opcional de sincronização deve incluir `aguardarGravacoesFirebase` e falhar
   diante de operações ainda não enviadas ou recusadas.
7. `{ok:true}` exige recarregar imediatamente. `{ok:false,recarregar:true}` exige
   mostrar o erro e recarregar (o Firestore pode estar terminado). Não continuar
   a sessão num objeto Firestore terminado. Antes de qualquer limpeza, falhas
   não modificam os dados nem encerram a conta.

`limpezaPendente` significa que a conta encerrou, mas a limpeza de arquivos/local
falhou. A marca durável permite terminar somente a limpeza já confirmada antes
de admitir outra conta. O backup já confirmado conserva o conteúdo local.

## Restauração

O backup de saída tem coleções no formato de Backup & Restaurar, mais
`_kmzeroBackup` e `anexosLocais`. O importador recusa empresa diferente e restaura
anexos numa única transação IndexedDB antes de mesclar os registros. Id idêntico
com conteúdo diferente aborta toda a restauração dos anexos; não sobrescreve nem
renomeia referências silenciosamente.

## Limites deliberados

- A limpeza não é um apagamento forense do disco nem revogação de arquivos que a
  própria pessoa já baixou. É a remoção do cache ativo do site.
- Dados de outra empresa não são apagados incidentalmente. O boot deve impedir
  seu uso por identidade diferente e tratar a migração desses caches legados.
- Revogação/rebaixamento exige a política de autorização do app: nunca oferecer
  a exportação de informação que a pessoa deixou de ter permissão para ler.
- `higienizarCachePermissoes` identifica os dados excluídos pelo perfil atual e
  devolve uma versão permitida, mas não apaga automaticamente o original: ele
  pode conter uma edição offline ainda única. A saída recusa exportar esse
  conteúdo. Os anexos antigos não têm ACL individual confiável e a saída também
  bloqueia sua exportação por perfil restrito. O gestor precisa resguardar uma
  cópia em procedimento autorizado antes da limpeza. Isso é uma limitação
  residual da migração de caches antigos, não uma alegação de apagamento após
  revogação: os dados antigos podem continuar no armazenamento bruto do aparelho.
- O módulo não considera `navigator.onLine` confirmação de sincronização.
- Falta de Web Locks bloqueia a limpeza automática, em vez de ignorar outra aba.

## Recuperação do proprietário

O boot verifica o cache **antes** de carregar os arrays ou permitir gravações.
Se encontrar informação incompatível com o perfil, bloqueia a abertura e mantém
o original. Um perfil sem propriedade não pode exportar os campos revogados.

O proprietário da empresa tem um fluxo administrativo separado, coerente com sua
permissão de gerar a cópia privada no servidor. `confirmarDonoNoServidor` usa
`getDocFromServer` no cadastro e no perfil, exige a conta Firebase correspondente
e o dono ativo. Essa confirmação é refeita ao preparar, baixar e aplicar a
recuperação. Não usa apenas a condição visual de gestor ou um valor de cache.

A cópia integral inclui os registros antigos e anexos. Preparar ou baixar não
modifica o original. Somente depois da confirmação do arquivo salvo, de uma nova
verificação do dono, da trava entre abas e do hash do estado atual, o app ajusta
as chaves às permissões atuais. Os anexos ficam intocados; o aplicativo recarrega.
Uma alteração após a cópia exige outra cópia. Um dono sem acesso ao aplicativo
também pode abrir somente o painel Segurança e cópias, cuja API revalida sua
propriedade, sem carregar os registros bloqueados no estado da interface.

## Verificação atualizada

`node --test tests/security-saida.test.mjs`: 21 casos aprovados. Exercitam
localStorage real de JSDOM e os limites Firebase/IndexedDB com adaptadores de
teste: backup integral, outro dono, confirmação, offline, falha de sync, mudança
posterior, troca de conta, outra aba, falhas parciais, retomada e bloqueio de
exportação após restrição de permissões. O teste de
interface e IndexedDB no navegador é responsabilidade da verificação integrada.
Os quatro casos de recuperação verificam confirmação do dono, cópia antes da
alteração, preservação de anexos, recusa quando o cache muda e revogação do dono.
