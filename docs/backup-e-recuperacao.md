# Backup anterior à migração de segurança

O dono ativo solicita a cópia pelo painel de segurança. O servidor revalida o
dono e o vínculo antes de ler dados. `criarBackupEmpresa` captura o documento da
empresa e subcoleções recursivas, incluindo descendentes de pais ausentes,
perfis/convites vinculados e os metadados das fotos. Timestamp com nanos, GeoPoint,
bytes e DocumentReference têm representação explícita e reversível.

A cópia compactada fica em `_backups/{empresaId}/{id}.json.gz`, sem token público
de download. O servidor baixa novamente o objeto e verifica SHA-256 antes de
gravar `empresas/{empresaId}/_backups/{id}` com `verificado:true`. O cliente recebe
apenas o manifesto: identificador, data, tamanho e contagens. Antes da migração,
`verificarBackupEmpresa` revalida o dono, lê o manifesto privado e verifica o hash
do objeto; não aceita um `verificado` fornecido pelo navegador.

## Alcance

- É uma leitura sequencial com `updateTime` registrado por documento, não uma
  exportação transacional em um único instante. Faça a operação em período sem
  alterações simultâneas quando precisar de uma fotografia uniforme dos dados.
- Os bytes das fotos não são duplicados. A migração modifica seus metadados e
  referências, preservando os arquivos. O backup contém os metadados originais
  para auditoria administrativa, inclusive tokens antigos, que permanecem
  privados e nunca devem ser reativados por uma restauração automática.
- Não inclui configurações IAM, regras, segredos, usuários do Firebase Auth,
  histórico completo de objetos ou arquivos que nunca saíram do aparelho. Estes
  últimos entram no backup explícito do fluxo Sair e limpar.
- Limites: 10 mil documentos, 10 mil metadados de fotos e 32 MiB JSON. Ao atingir
  um limite, a operação falha antes de autorizar migração. Empresas maiores
  precisam de exportação administrada separada.
- Não há promessa de rotina automática ou retenção contratada: esta cópia é
  criada sob demanda. Nenhum serviço pago adicional foi ativado.

## Ensaio e restauração

`restaurarSnapshotEmpresa` é dry-run por padrão: valida todos os caminhos e tipos
antes de preparar lotes. Quando aplicada, regrava apenas os documentos presentes
no snapshot, preserva documentos extras e não restaura tokens Storage. Grandes
restaurações são divididas em lotes de 400; não há atomicidade entre lotes.

O comando administrativo `scripts/backup-empresa.mjs` também é dry-run por
padrão. Exemplo de inspeção, com credenciais fornecidas pelo ambiente (nunca
incluir chave no argumento ou em arquivos do repositório):

```powershell
node scripts/backup-empresa.mjs verificar --empresa ID --uid UID --bucket BUCKET --backup-id ID_BACKUP
node scripts/backup-empresa.mjs restaurar --empresa ID --uid UID --bucket BUCKET --backup-id ID_BACKUP
```

O CLI recusa `restaurar --aplicar` fora de um emulador local em projeto `demo-*`.
Uma recuperação de produção precisa revisar o efeito sobre as alterações feitas
depois da cópia e executar um procedimento específico. Não foi executada nenhuma
restauração em produção nesta implementação.

## Verificação

- `node --test tests/security-backup.test.mjs`: 11 testes dos tipos, formato,
  hash real de gzip, vínculo do dono, adulteração e dry-run sem escrita.
- `node scripts/testar-backup-emulador.mjs`: 7 verificações integradas aprovadas em
  Firestore em `127.0.0.1:8180` e Storage em `127.0.0.1:9299`. Usa somente dados
  fictícios e recusa variáveis que apontem para serviços remotos. Resultado
  registrado no ensaio conjunto em
  `../Seguranca_KMZERO/resultado-rbac-backup-fotos-final.txt`.

O ensaio compara o Timestamp restaurado com o registro lido do servidor antes
do backup: o Firestore já reduz a precisão temporal a microssegundos ao gravar,
conforme a [documentação de tipos do Firebase](https://firebase.google.com/docs/firestore/manage-data/data-types).
O serializador preserva exatamente os segundos e nanos recebidos do SDK.
