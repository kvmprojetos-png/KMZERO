# Assistente de obras e lembretes de campo

O menu Visão geral contém Assistente de obras. A primeira versão oferece resumo, prioridades e rascunho de relatório. Consulta somente a empresa do usuário ativo e as coleções permitidas às suas áreas. O perfil é verificado no servidor em cada chamada, com recusa de sessões revogadas.

O servidor seleciona nome/situação/tipo da obra, etapas e avanço do cronograma, além de contagens de pedidos daquela obra. Não envia cadastros de trabalhadores, folha, contratos, contatos, documentos pessoais nem fotos. Dados ausentes continuam ausentes; amostras limitadas são identificadas. O gestor confere a prévia e autoriza cada envio à Groq. Nenhuma análise altera registros da obra. A resposta aparece como texto, sem HTML executável.

## Ativação da IA pelo proprietário

1. Acesse https://console.groq.com/keys na sua conta do plano gratuito, sem cadastrar cobrança. A criação da chave e eventual aceitação de termos devem ser feitas pelo proprietário.
2. Salve a chave em `GROQ_API_KEY`, como segredo de **Production**, no projeto KMZERO da Vercel. Não use prefixo `VITE_`, não publique no Git e não cole a chave no chat.
3. Publique novamente o projeto para carregar o segredo e faça uma análise após conferir a prévia e consentir no app.
4. Confira as opções de privacidade em https://console.groq.com/docs/your-data; a integração não altera automaticamente os controles da conta Groq.

Modelo fixo: `openai/gpt-oss-120b`. Sem troca automática de provedor ou modelo. Limites internos: 20 solicitações por empresa/dia, 40 no aplicativo/dia e intervalo de 10 segundos por usuário. Reserva atômica no Firestore, inclusive em caso de falha do provedor. Esses limites controlam o uso do aplicativo; a disponibilidade e as cotas do plano gratuito permanecem sob controle da Groq. Sem chave, a tela mostra os dados reais e informa que a IA aguarda ativação.

## Notificações e som

`VITE_FCM_VAPID_KEY` contém apenas a chave pública Web Push. A ativação é individual: Avisos → Ativar notificações → permitir no navegador. Avisos → Ativar e testar som libera Web Audio após uma interação. O usuário pode silenciar o som local. Com o app fechado, o toque depende do sistema operacional, volume e modo silencioso. Não há promessa de áudio personalizado em segundo plano.

## Rotina de campo

Somente as empresas explicitamente habilitadas em `CRON_EMPRESA_IDS` são processadas. `CRON_SECRET` autentica as chamadas internas. Não há enumeração global das empresas.

De segunda a sexta, exceto feriados nacionais identificados pelo app, horário de Brasília:

| Horário de referência | Lembrete | Condição |
|---|---|---|
| 16h | Ponto incompleto | Existe trabalhador ativo da obra sem registro do dia na nuvem. |
| 17h | Fechamento do dia | Falta RDO do dia, foto do dia, ou ambos na nuvem. |

Cada lembrete de campo tem documento determinístico criado atomicamente: invocações simultâneas não publicam/disparam duas vezes. Recebem apenas perfis ativos de campo vinculados àquela obra. Não lista nomes de trabalhadores na mensagem. Os avisos continuam disponíveis no app quando não existem aparelhos registrados; o retorno `aparelhos` significa envio aceito pelo FCM, sem assegurar entrega ou som.

Fotos e RDOs em datas ISO ou brasileiras são reconhecidos. Leituras de fotos para o agendamento usam somente metadados. Se o aparelho ainda estiver offline, a ausência é descrita como registro pendente **na nuvem**.

A Vercel Hobby pode executar o agendamento dentro da hora prevista, com atraso de até 59 minutos. Não houve contratação de plano para obter precisão por minuto: https://vercel.com/docs/cron-jobs/usage-and-pricing.

## Verificação

`npm run test:security` verifica entradas, autenticação, permissões, minimização, cotas, destinatários e lógica de pendências. `scripts/testar-assistente-emulador.mjs` exige Firestore local e usa somente dados fictícios para verificar concorrência e regras reais. Nenhum teste chama IA ou aparelho real. O envio de teste do app destina-se à própria conta.
