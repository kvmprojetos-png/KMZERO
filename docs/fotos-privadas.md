# Fotos privadas e migração da autorização

## Comportamento

- `/api/foto` exige ID token Firebase válido e não revogado, perfil ativo, mesma empresa e permissão `campo` do escritório ou a obra vinculada ao encarregado.
- O servidor lê os metadados da foto para autorizar o download. O navegador nunca recebe uma URL de download do Firebase.
- Upload novo usa Admin Storage sem `firebaseStorageDownloadTokens`, com `Cache-Control: private, no-store`. O Firestore guarda `fotoPath`; a cópia em data URL existe somente na memória da sessão. O conteúdo ainda não enviado permanece local para não perder fotos offline.
- Novos uploads aceitam raster com assinatura e base64 conferidos, até 3 MiB. As fotos já passam pelo carimbo/redimensionamento do app. Excesso ou falha conserva o original local.
- Fotos antigas menores que 10 MiB são lidas em partes autenticadas de até 1 MiB. Isso respeita o limite de corpo/resposta da Vercel sem descartar fotos existentes.
- IDs repetidos não sobrescrevem objetos de outro envio. Repetição com mesmo autor e mesmo hash retorna sucesso sem duplicar.

## Ativação e compatibilidade

1. Publicar a API e o cliente compatível com `fotoPath` e URLs antigas interpretadas como caminho. Confirmar login, galeria e PDF.
2. Com o proprietário ativo, abrir a tela Segurança, criar backup privado e verificar integridade.
3. Publicar as regras que negam acesso direto ao Storage e a escrita direta de metadados de fotos, impedindo clientes antigos de emitir novos tokens. A API usa Admin e sua própria autorização por empresa, papel e obra.
4. Executar a migração por páginas usando `/api/seguranca`. Cada página revalida proprietário e backup. O cursor e a trava ficam em `empresas/{id}/_seguranca/estado`, inacessível pelo SDK do cliente.
5. Concluir as páginas: projeções mínimas de trabalhadores, obras e perfis; identificação das presenças sem obra; escopo dos avisos automáticos; revogação de tokens; conversão de referências de fotos. A execução publica versão 1 no estado privado apenas quando todas as páginas terminarem sem falhas.

A revogação alcança todos os objetos da pasta de fotos da empresa, inclusive os que perderam o documento de galeria. Os arquivos não são apagados. A alteração de metadados usa precondição de versão e releitura; a conversão do documento usa sua `updateTime` para não sobrescrever uma alteração concorrente. Registros com objetos ausentes ficam preservados e são informados como falha; não há conclusão falsa.

O emulador Firebase conserva `downloadTokens` em um campo interno separado: um PATCH GCS com `metadata.firebaseStorageDownloadTokens: null` ou string vazia não o limpa. A implementação primeiro aplica o PATCH padrão e relê. Se o token persistir, faz um copy/rewrite atômico para o mesmo caminho, no servidor, fixando a geração da fonte e exigindo a geração atual no destino; a releitura confirma ausência de token, tamanho, CRC32C e MD5 (quando presente). Isso cria uma nova geração sem transferir os pixels pela aplicação. Objetos com hold/retenção ou sem checksum não recebem esse fallback e ficam como falha explícita. O ensaio verifica também o acesso HTTP anônimo ao link antigo, não apenas os metadados.

Para inspeção administrativa isolada, `migrarFotosDaEmpresa` usa `aplicar: false` por padrão e não escreve. A API de produção só permite aplicar após backup verificado. A restauração do backup é uma operação administrativa separada e não reativa tokens revogados. Depois da migração, reverter para o cliente antigo baseado em links públicos quebraria fotos; conservar o leitor autenticado.

## Limites

O backup registra documentos e metadados das fotos; os bytes das fotos permanecem nos objetos originais. Ele é uma leitura sequencial com versões registradas, não um snapshot transacional de toda a empresa. Presenças antigas sem obra continuam sem vínculo e, portanto, inacessíveis ao perfil de campo; os totais `semVinculo` registram essa pendência sem inferir a obra histórica pela atual do trabalhador. O RH mantém acesso aos registros. Revogar um link não remove cópias de imagens que alguém já tenha baixado.

## Verificação

- `node --test tests/security-fotos.test.mjs tests/security-migracao.test.mjs`: contratos locais, autorização negativa, upload/idempotência, migração e limites.
- `scripts/testar-fotos-api-emulador.mjs`: exige explicitamente Firestore 127.0.0.1:8180 e Storage 127.0.0.1:9299, projeto `demo-kmzero-security`; usa apenas dados fictícios. Exercita Admin SDK real, upload/download, backup e sete etapas, remoção de tokens e manutenção do acesso autorizado após revogação.

Referências: [download e CORS do Firebase](https://firebase.google.com/docs/storage/web/download-files), [limites de funções Vercel](https://vercel.com/docs/functions/limitations), [alteração de metadados de objetos](https://cloud.google.com/storage/docs/json_api/v1/objects/patch).
