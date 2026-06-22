import { BLUE, GREEN, RED, ORANGE } from "../theme.js";

export const DEFAULT_FORNECEDORES = [
  // LOJAS DE MATERIAL DE CONSTRUÇÃO — ALEGRE/ES
  {
    id: 1,
    nome: "Leal Material de Construção",
    razaoSocial: "Everaldo Leal Domingos",
    cnpj: "08.074.253/0001-11",
    categoria: "Material de construção",
    contato: "Everaldo Leal",
    telefone: "(28) 3552-1416",
    whatsapp: "(28) 99886-0000",
    email: "",
    endereco: "Rua Monsenhor Pavesi, 134 - Centro, Alegre - ES",
    obs: "Loja referência em Alegre. Materiais diversos da base ao acabamento. Entrega em toda a região. Possui filiais (Av. Oscar de Almeida Gama, 31). Instagram @lealmaterial",
  },
  {
    id: 2,
    nome: "Treze Material de Construção",
    razaoSocial: "Treze Material de Construcao Ltda",
    cnpj: "01.070.171/0001-50",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-1201",
    whatsapp: "",
    email: "",
    endereco: "Rua Treze de Maio, 98 - Centro, Alegre - ES",
    obs: "Empresa tradicional de Alegre, fundada em 1996. Comércio varejista de materiais de construção em geral.",
  },
  {
    id: 3,
    nome: "Alternativa Material de Construção",
    razaoSocial: "Alternativa - Materiais De Construcao Ltda",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Monsenhor Pavesi, 193 - Centro, Alegre - ES",
    obs: "Atendimento por telefone e email.",
  },
  {
    id: 4,
    nome: "Solução Material de Construção",
    razaoSocial: "Solucao Material De Construcao",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Av. Haroldo Bastos Valbão, S/N - Rive, Alegre - ES",
    obs: "Localizada no distrito de Rive. Bom pra obras na região do Rive/IFES.",
  },
  {
    id: 5,
    nome: "Casa do Construtor (Construforte)",
    razaoSocial: "Casa Do Construtor Construforte Ltda",
    cnpj: "",
    categoria: "Locação de equipamentos",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Euclides Jaccoud Junior, 67 - Rive, Alegre - ES",
    obs: "Locação de equipamentos. Próximo ao IFES.",
  },
  {
    id: 6,
    nome: "Ney Dalrio Material de Construção",
    razaoSocial: "Ney Dalrio Material de Construção Ltda",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-3661",
    whatsapp: "",
    email: "",
    endereco: "Rua Joaquim Borges - Alegre, ES",
    obs: "",
  },
  {
    id: 7,
    nome: "Form Material de Construção",
    razaoSocial: "Form",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Felicio Alcuri, 10 - Térreo, Centro, Alegre - ES",
    obs: "",
  },
  {
    id: 8,
    nome: "Casa Rogai Leal",
    razaoSocial: "Casa Rogai Leal",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Principal, 64 - Ararai, Alegre - ES",
    obs: "Distrito de Ararai.",
  },
  {
    id: 9,
    nome: "F. F. Comercial",
    razaoSocial: "F. F. Comercial",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Monsenhor Pavesi, 100 - Centro, Alegre - ES",
    obs: "",
  },
  {
    id: 10,
    nome: "Monteiro Material de Construção",
    razaoSocial: "Monteiro",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Praça Antônio Correa Monteiro, 195 - Triângulo, Alegre - ES",
    obs: "Bairro Triângulo.",
  },
  {
    id: 11,
    nome: "Coelho Material de Construção",
    razaoSocial: "Coelho Material de Construção",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Alegre - ES",
    obs: "Slogan: Do campo a cidade construindo sonhos. Facebook: materialcoelho",
  },
];

export const DEFAULT_OBRAS = [
  { id: 1, nome: "Drenagem e Pavimentação - Rua Emílio Marins (Trecho 2)", local: "Alegre - ES", endereco: "Rua Emílio Marins, Trecho 2, Alegre - ES", refLocal: "", lat: null, lng: null, status: "Ativa", tipo: "Pavimentação" },
  { id: 2, nome: "Reforma e Ampliação - IFES",                              local: "Alegre - ES", endereco: "Campus do IFES, Alegre - ES", refLocal: "Próximo ao bloco principal", lat: null, lng: null, status: "Ativa", tipo: "Edificação" },
  { id: 3, nome: "Drenagem e Pavimentação - Rua Projetada Antônio Lemos Jr", local: "Alegre - ES", endereco: "Rua Projetada Antônio Lemos Jr, Alegre - ES", refLocal: "", lat: null, lng: null, status: "Ativa", tipo: "Pavimentação" },
  { id: 4, nome: "Quadra Poliesportiva Jerônimo Monteiro",                  local: "Jerônimo Monteiro - ES", endereco: "Jerônimo Monteiro - ES", refLocal: "", lat: null, lng: null, status: "Ativa", tipo: "Edificação" },
];

export const DEFAULT_TRABALHADORES = [
  // OBRA 1 — Emílio Marins
  { id: 1,  nome: "Geovane Pereira de Souza",      cargo: "Encarregado / Operador Retroescavadeira", obraId: 1,
    cpf: "108.453.227-89", rg: "2.345.678 SPTC/ES", nasc: "15/03/1982",
    tel: "(28) 99988-1234", endereco: "Rua das Acácias, 145 - Centro, Alegre - ES",
    tamCalca: "44", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  { id: 2,  nome: "Adão Cortezes da Silva", cargo: "Pedreiro", obraId: 1,
    cpf: "092.614.037-00", rg: "1.876.345 SPTC/ES", nasc: "11/09/1976",
    tel: "(28) 99926-2485", endereco: "Rua João Pessoa, 234 - Bairro Triângulo, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 3,  nome: "Tico (Antônio Carlos da Silva)", cargo: "Pedreiro", obraId: 1,
    cpf: "057.892.346-12", rg: "1.234.567 SPTC/ES", nasc: "22/06/1985",
    tel: "(28) 99815-6724", endereco: "Rua Bela Vista, 89 - Vila do Sul, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "145" },

  { id: 4,  nome: "Wilian dos Santos Pereira", cargo: "Pedreiro", obraId: 1,
    cpf: "143.567.892-44", rg: "2.156.789 SPTC/ES", nasc: "08/12/1988",
    tel: "(28) 99764-3812", endereco: "Rua Treze de Maio, 156 - Centro, Alegre - ES",
    tamCalca: "44", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  { id: 5,  nome: "Ramom Ferreira Lima", cargo: "Pedreiro", obraId: 1,
    cpf: "176.234.567-91", rg: "2.987.654 SPTC/ES", nasc: "30/04/1990",
    tel: "(28) 99623-4571", endereco: "Rua Felício Alcuri, 45 - Bairro Gioia, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "145" },

  { id: 6,  nome: "Carlos Eduardo Moreira", cargo: "Pedreiro", obraId: 1,
    cpf: "098.765.432-15", rg: "1.654.321 SPTC/ES", nasc: "17/02/1979",
    tel: "(28) 99812-5634", endereco: "Av. Oscar de Almeida Gama, 78 - Centro, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 7,  nome: "João Victor Ribeiro Machado", cargo: "Auxiliar", obraId: 1,
    cpf: "192.327.167-98", rg: "3.456.789 SPTC/ES", nasc: "14/08/2002",
    tel: "(28) 99942-3427",
    endereco: "Rua Loteamento Lúcio Chavier, Vila do Sul, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41/42",
    diaria: "100" },

  { id: 8,  nome: "João Paulo (João Capeta)", cargo: "Auxiliar",  obraId: 1,
    cpf: "165.432.871-26", rg: "2.564.789 SPTC/ES", nasc: "05/11/1995",
    tel: "(28) 99756-2348", endereco: "Rua Ararai, 234 - Distrito de Ararai, Alegre - ES",
    tamCalca: "40", tamCamisa: "M", tamBota: "39",
    diaria: "100" },

  { id: 9,  nome: "Jhonatan Souza Almeida", cargo: "Auxiliar", obraId: 1,
    cpf: "187.654.321-08", rg: "3.234.567 SPTC/ES", nasc: "27/07/1998",
    tel: "(28) 99687-4521", endereco: "Rua Monsenhor Pavesi, 67 - Centro, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "100" },

  { id: 10, nome: "Roney Carvalho Santos", cargo: "Pintor", obraId: 1,
    cpf: "121.345.678-32", rg: "1.987.654 SPTC/ES", nasc: "12/05/1983",
    tel: "(28) 99834-5612", endereco: "Rua Joaquim Borges, 123 - Centro, Alegre - ES",
    tamCalca: "42", tamCamisa: "GG", tamBota: "41",
    diaria: "145" },

  { id: 11, nome: "Nego (Nelson Marques)", cargo: "Auxiliar", obraId: 1,
    cpf: "134.567.890-44", rg: "2.345.612 SPTC/ES", nasc: "19/09/1992",
    tel: "(28) 99578-3421", endereco: "Rua Principal, 89 - Distrito do Café, Alegre - ES",
    tamCalca: "44", tamCamisa: "G", tamBota: "42",
    diaria: "100" },

  // OBRA 2 — IFES
  { id: 12, nome: "Rhiard Cavalcante Mendes", cargo: "Encarregado", obraId: 2,
    cpf: "156.789.012-65", rg: "2.876.543 SPTC/ES", nasc: "08/01/1986",
    tel: "(28) 99812-6743", endereco: "Av. Haroldo Bastos Valbão, 234 - Rive, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 13, nome: "Bidão (Sebastião Ribeiro)", cargo: "Pintor", obraId: 2,
    cpf: "143.876.543-21", rg: "1.456.789 SPTC/ES", nasc: "23/10/1974",
    tel: "(28) 99645-2387", endereco: "Rua Euclides Jaccoud Junior, 78 - Rive, Alegre - ES",
    tamCalca: "44", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  { id: 14, nome: "Bruno Henrique Costa", cargo: "Eletricista", obraId: 2,
    cpf: "176.543.210-87", rg: "2.654.321 SPTC/ES", nasc: "16/06/1989",
    tel: "(28) 99723-8456", endereco: "Rua Antônio Correa, 45 - Bairro Boa Vista, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "145" },

  // OBRA 4 — Quadra Poliesportiva Jerônimo Monteiro
  { id: 15, nome: "Marcos Oliveira Cardoso", cargo: "Encarregado", obraId: 4,
    cpf: "198.234.567-43", rg: "3.012.345 SPTC/ES", nasc: "11/04/1981",
    tel: "(28) 99845-6712", endereco: "Rua Floriano Peixoto, 156 - Centro, Jerônimo Monteiro - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 16, nome: "Marcelo Pereira da Silva", cargo: "Pedreiro", obraId: 4,
    cpf: "165.789.234-78", rg: "2.789.012 SPTC/ES", nasc: "29/07/1987",
    tel: "(28) 99578-3412", endereco: "Rua João Rita, 78 - Centro, Jerônimo Monteiro - ES",
    tamCalca: "42", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  // ESCRITÓRIO / GERÊNCIA
  { id: 17, nome: "Kleber Vieira Martins", cargo: "Engenheiro / Diretor", obraId: 0,
    cpf: "075.345.678-90", rg: "1.234.567 SPTC/ES", nasc: "—",
    tel: "(28) 99925-8172", endereco: "Alegre - ES",
    diaria: "170" },

  { id: 18, nome: "Mozart Andrade Silveira", cargo: "Mestre de Obras", obraId: 0,
    cpf: "143.234.567-12", rg: "2.456.789 SPTC/ES", nasc: "14/02/1972",
    tel: "(28) 99812-3456", endereco: "Centro, Alegre - ES",
    diaria: "250" },
];

/* ════════════════════════════════════
   GERADOR DE 30 DIAS — pré-popula tudo
   Isso roda uma vez quando o app abre vazio
════════════════════════════════════ */
export function gerarDadosMes30Dias() {
  const hoje = new Date();
  const trabs = [
    { id: 1, obraId: 1 }, { id: 2, obraId: 1 }, { id: 3, obraId: 1 }, { id: 4, obraId: 1 },
    { id: 5, obraId: 1 }, { id: 6, obraId: 1 }, { id: 7, obraId: 1 }, { id: 8, obraId: 1 },
    { id: 9, obraId: 1 }, { id: 10, obraId: 1 }, { id: 11, obraId: 1 },
    { id: 12, obraId: 2 }, { id: 13, obraId: 2 }, { id: 14, obraId: 2 },
    { id: 15, obraId: 4 }, { id: 16, obraId: 4 },
  ];
  const obrasAtivas = [
    { id: 1, nome: "Drenagem Rua Emílio Marins (Trecho 2)", encarregado: "Geovane" },
    { id: 2, nome: "Reforma e Ampliação - IFES", encarregado: "Rhiard" },
    { id: 4, nome: "Quadra Poliesportiva Jerônimo Monteiro", encarregado: "Marcos" },
  ];

  // Materiais e despesas
  const materiais = [
    { nome: "Cimento CP-II", unid: "saco", marca: "Mizu", catg: "Cimentos" },
    { nome: "Areia Lavada", unid: "m³", marca: "—", catg: "Agregados" },
    { nome: "Brita 1", unid: "m³", marca: "—", catg: "Agregados" },
    { nome: "Bloco Cerâmico 14x19x39", unid: "milheiro", marca: "—", catg: "Alvenaria" },
    { nome: "Vergalhão 10mm", unid: "barra", marca: "Gerdau", catg: "Aço" },
    { nome: "Pó de pedra", unid: "m³", marca: "—", catg: "Agregados" },
    { nome: "Tubo PVC 100mm", unid: "barra", marca: "Tigre", catg: "Hidráulica" },
    { nome: "Tinta Acrílica Branca", unid: "lata 18L", marca: "Suvinil", catg: "Tintas" },
    { nome: "Argamassa AC-II", unid: "saco", marca: "Quartzolit", catg: "Cimentos" },
    { nome: "Cal Hidratada", unid: "saco", marca: "Itaú", catg: "Cimentos" },
  ];
  const despesasModelo = [
    { categoria: "PIPA d'água", descricao: "Pipa 8.000L para concretagem", valor: 280 },
    { categoria: "Frete avulso", descricao: "Caçamba caminhão de areia", valor: 150 },
    { categoria: "Almoço terceiros", descricao: "Almoço motorista da betoneira", valor: 35 },
    { categoria: "Solo/bica", descricao: "1 carrada de bica corrida", valor: 220 },
    { categoria: "Manutenção avulsa", descricao: "Conserto da betoneira", valor: 180 },
    { categoria: "Hospedagem", descricao: "Pernoite operador retroescavadeira", valor: 120 },
    { categoria: "Diária extra", descricao: "Hora extra fim de semana", valor: 145 },
    { categoria: "Taxas", descricao: "Taxa Prefeitura — alvará", valor: 95 },
  ];
  const ocorrencias = [
    "Chuva forte interrompeu a concretagem por 2h. Equipe aproveitou pra organizar o canteiro.",
    "Visita técnica do fiscal hoje. Tudo aprovado.",
    "Falta de material no almoxarifado. Já solicitei pedido novo.",
    "Treinamento de segurança realizado com toda a equipe (NR-18).",
    "Caminhão de concreto atrasou 1h. Sem prejuízo grande.",
    "Vazamento detectado na tubulação principal. Já comuniquei o gestor.",
    "Concretagem da viga V1 concluída com sucesso.",
    "Equipe completa hoje. Produtividade ótima.",
    "Recebimento de material da Leal Material — tudo conferido.",
    "Bate-bate com o concreto, fizemos correção no nivel.",
  ];
  const legendasFotos = [
    "Mobilização da equipe", "Concretagem em andamento", "Almoço da equipe",
    "Verificação de qualidade", "Final do expediente",
    "Locação de canteiro", "Forma da viga V2", "Armação pronta pra concretar",
    "Limpeza do terreno", "Equipe trabalhando"
  ];

  const historico = {};
  const fotosObras = [];
  const rdosEmitidos = [];
  const pedidos = [];
  const movimentacoes = [];
  const movEquip = [];
  const diario = [];
  const despesasAvulsas = [];
  const adiantamentos = [];
  const recebimentos = [];
  const abastecimentos = [];
  const produtividade = [];

  let pedidoNum = 1;
  let movNum = 1;
  let movEqNum = 1;
  let rdoNum = 1;
  let fotoId = 1;
  let despId = 1;
  let diaId = 1;
  const fotosPorObra = {};

  // 30 dias atrás até hoje
  for (let d = 29; d >= 0; d--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - d);
    const isoData = data.toISOString().split("T")[0];
    const dataStr = data.toLocaleDateString("pt-BR");
    const ts = data.getTime();
    const diaSemana = data.getDay();

    if (diaSemana === 0) continue; // pula domingos

    // PRESENÇAS (70/20/10)
    historico[isoData] = {};
    trabs.forEach(t => {
      const r = Math.random();
      if (r < 0.70) historico[isoData][t.id] = "Presente";
      else if (r < 0.90) historico[isoData][t.id] = "Falta";
      else historico[isoData][t.id] = "Atestado";
    });

    // RDO + 5 fotos por obra (apenas dias úteis com obras ativas)
    obrasAtivas.forEach((obra, idxObra) => {
      const trabsObra = trabs.filter(t => t.obraId === obra.id);
      if (trabsObra.length === 0) return;

      const presentes = trabsObra.filter(t => historico[isoData][t.id] === "Presente").length;
      const faltas = trabsObra.filter(t => historico[isoData][t.id] === "Falta").length;
      const atestados = trabsObra.filter(t => historico[isoData][t.id] === "Atestado").length;

      // 5 fotos
      if (!fotosPorObra[obra.id]) fotosPorObra[obra.id] = 0;
      const fotosDia = [];
      for (let f = 0; f < 5; f++) {
        fotosPorObra[obra.id]++;
        const numero = fotosPorObra[obra.id];
        const horaFoto = ["08:30", "10:15", "12:30", "14:45", "16:50"][f];
        // Placeholder em texto (sem canvas, leve)
        const placeholderUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g${numero}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${["#0f2151","#0891b2","#16a34a","#7c3aed"][idxObra % 4]}"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="800" height="600" fill="url(#g${numero})"/><text x="400" y="240" font-size="120" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-family="Arial">${["🏗️","🏛️","🏟️","🛣️"][idxObra % 4]}</text><text x="400" y="350" font-size="34" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="bold">${obra.nome.substring(0, 28)}</text><text x="400" y="395" font-size="22" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Arial">Foto #${String(numero).padStart(3, "0")} — ${dataStr}</text><rect x="40" y="490" width="720" height="80" rx="10" fill="rgba(0,0,0,0.6)" stroke="#f5a623" stroke-width="3"/><text x="60" y="525" font-size="22" fill="#f5a623" font-family="Arial,sans-serif" font-weight="bold">KMZERO</text><text x="60" y="555" font-size="16" fill="#fff" font-family="Arial">Foto #${String(numero).padStart(3, "0")} — ${horaFoto}</text><text x="740" y="525" font-size="14" fill="#fff" text-anchor="end" font-family="Arial">📅 ${dataStr}</text><text x="740" y="555" font-size="14" fill="#fff" text-anchor="end" font-family="Arial">👷 ${obra.encarregado}</text></svg>`
        )}`;
        fotosObras.push({
          id: fotoId++,
          numero,
          obraId: obra.id,
          obraNome: obra.nome,
          foto: placeholderUrl,
          legenda: legendasFotos[(numero + f) % legendasFotos.length],
          autor: obra.encarregado,
          data: dataStr,
          hora: horaFoto,
          origemRDO: rdoNum,
        });
        fotosDia.push(placeholderUrl);
      }

      // RDO
      const presencas = {};
      const horasTrabalhadas = {};
      const alimentacao = {};
      trabsObra.forEach(t => {
        presencas[t.id] = historico[isoData][t.id];
        if (presencas[t.id] === "Presente") {
          horasTrabalhadas[t.id] = 9 + (Math.random() < 0.2 ? 1 : 0);
          alimentacao[t.id] = { cafeManha: true, marmita: true, cafeTarde: false, lanche: false };
        }
      });
      let totalHE = 0;
      Object.values(horasTrabalhadas).forEach(h => { if (h > 9) totalHE += h - 9; });

      rdosEmitidos.push({
        id: ts + rdoNum,
        numero: rdoNum++,
        obraId: obra.id,
        data: dataStr,
        dataIso: isoData,
        encarregado: obra.encarregado,
        clima: ["Bom", "Bom", "Bom", "Nublado", "Chuvoso"][Math.floor(Math.random() * 5)],
        observacoes: `Equipe trabalhou normalmente. ${presentes} presente(s), ${faltas} falta(s), ${atestados} atestado(s). 5 foto(s) registrada(s).`,
        ts,
        autoGerado: true,
        horasTrabalhadas,
        totalHE: +totalHE.toFixed(1),
        horimetros: obra.id === 1 ? { 1: { inicio: 1234 + (29 - d) * 8, fim: 1234 + (29 - d) * 8 + 7, horas: 7 } } : {},
        fotos: fotosDia,
        presencas,
        alimentacao,
        totalAlimentacao: presentes * 23,
      });
    });

    // PEDIDOS: 1-2 por obra por dia útil (volume real de obra ativa)
    obrasAtivas.forEach(obraEsc => {
      const trabsObra = trabs.filter(t => t.obraId === obraEsc.id);
      if (trabsObra.length === 0) return;

      // 60% chance de ter 1 pedido + 30% chance de ter 2 pedidos
      const r1 = Math.random();
      const qtdPedidos = r1 < 0.6 ? 1 : (r1 < 0.9 ? 2 : 0);

      for (let p = 0; p < qtdPedidos; p++) {
        const numItens = Math.floor(Math.random() * 4) + 1; // 1-4 itens
        const itens = [];
        for (let i = 0; i < numItens; i++) {
          const m = materiais[Math.floor(Math.random() * materiais.length)];
          itens.push({
            material: m.nome,
            qtd: (Math.floor(Math.random() * 20) + 1) + " " + m.unid,
            marca: m.marca,
            categoria: m.catg,
            obs: ""
          });
        }
        const r2 = Math.random();
        // Pedidos recentes (últimos 3 dias) tendem a estar aguardando
        const status = d <= 3 ? (r2 < 0.5 ? "Aguardando" : "Aprovado") : (r2 < 0.80 ? "Aprovado" : r2 < 0.92 ? "Negado" : "Aguardando");

        pedidos.push({
          id: ts + pedidoNum + p * 100,
          numero: pedidoNum++,
          obraId: obraEsc.id,
          obra: obraEsc.nome,
          encarregado: obraEsc.encarregado,
          itens,
          material: itens[0].material,
          qtd: itens[0].qtd,
          marca: itens[0].marca,
          categoria: itens[0].categoria,
          obs: "",
          status,
          dataSolicitacao: dataStr,
          formaPagamento: status === "Aprovado" ? ["À vista", "Boleto 30 dias", "Boleto 15 dias", "PIX antecipado"][Math.floor(Math.random() * 4)] : "",
          prazo: status === "Aprovado" ? new Date(ts + (Math.floor(Math.random() * 5) + 2) * 86400000).toLocaleDateString("pt-BR") : "",
          prazoEntrega: status === "Aprovado" ? new Date(ts + (Math.floor(Math.random() * 5) + 2) * 86400000).toLocaleDateString("pt-BR") : "",
          ts,
        });
      }
    });

    // DESPESAS AVULSAS: 1 a cada 2 dias por obra (PIPA, frete, lanches, etc)
    if (d % 2 === 0) {
      obrasAtivas.forEach(obraEsc => {
        const desp = despesasModelo[Math.floor(Math.random() * despesasModelo.length)];
        despesasAvulsas.push({
          id: ts + despId++,
          obraId: obraEsc.id,
          obraNome: obraEsc.nome,
          categoria: desp.categoria,
          descricao: desp.descricao,
          valor: desp.valor,
          data: dataStr,
          autor: "Kleber Vieira Martins",
          ts,
        });
      });
    }

    // DIÁRIO a cada 5 dias
    if (d % 5 === 0) {
      const obraEsc = obrasAtivas[Math.floor(Math.random() * obrasAtivas.length)];
      diario.push({
        id: ts + diaId++,
        obraId: obraEsc.id,
        autor: obraEsc.encarregado,
        texto: ocorrencias[Math.floor(Math.random() * ocorrencias.length)],
        foto: null,
        ts,
      });
    }

    // MOVIMENTAÇÃO de pessoal a cada 7 dias
    if (d % 7 === 0 && d > 0) {
      const trabsEM = trabs.filter(t => t.obraId === 1);
      if (trabsEM.length > 1) {
        const trabEsc = trabsEM[Math.floor(Math.random() * trabsEM.length)];
        movimentacoes.push({
          id: ts + movNum,
          numero: movNum++,
          trabId: trabEsc.id,
          trabNome: ["Adão Cortezes da Silva", "Tico", "Wilian", "Carlos", "Roney"][Math.floor(Math.random() * 5)],
          obraOrigem: 1,
          obraDestino: 2,
          tipo: Math.random() < 0.6 ? "hoje" : "definitiva",
          motivo: ["Reforço para a concretagem", "Apoio na alvenaria", "Substituir falta da equipe"][Math.floor(Math.random() * 3)],
          solicitante: "Geovane",
          status: d <= 1 ? "Aguardando" : "Aprovado",
          data: dataStr,
          ts,
        });
      }
    }

    // MOV. EQUIPAMENTO ocasional (a cada 10 dias)
    if (d % 10 === 0 && d > 0) {
      movEquip.push({
        id: ts + movEqNum,
        numero: movEqNum++,
        tipoItem: "equipamento",
        itemId: 1,
        itemNome: "Betoneira 400L",
        itemCodigo: "BET-001",
        obraOrigemId: 1,
        obraOrigemNome: "Drenagem Rua Emílio Marins (Trecho 2)",
        obraDestinoId: 2,
        obraDestinoNome: "Reforma e Ampliação - IFES",
        tipo: "emprestimo",
        prazo: new Date(ts + 7 * 86400000).toISOString().split("T")[0],
        motivo: "Concretagem da fundação",
        solicitante: "Rhiard",
        status: d <= 2 ? "Aguardando" : "Aprovado",
        dataSolicitacao: dataStr,
        ts,
      });
    }

    // ABASTECIMENTOS a cada 5 dias (para retroescavadeira e carro)
    if (d % 5 === 0) {
      abastecimentos.push({
        id: ts + d,
        ativoId: 1, // Retroescavadeira
        obraId: 1, // Emílio Marins (onde tá a retro)
        data: dataStr,
        ts,
        litros: 30 + Math.floor(Math.random() * 20),
        valor: 180 + Math.floor(Math.random() * 80),
        kmAtual: 1234 + (29 - d) * 25,
        posto: "Posto Rive",
        obs: "",
      });
    }

    // RECEBIMENTOS — 1 por semana
    if (d % 7 === 0 && d > 0) {
      const obraEsc = obrasAtivas[Math.floor(Math.random() * obrasAtivas.length)];
      recebimentos.push({
        id: ts + d,
        obraId: obraEsc.id,
        obraNome: obraEsc.nome,
        descricao: `Medição #${4 - Math.floor(d / 7)} — ${obraEsc.nome}`,
        valor: 15000 + Math.floor(Math.random() * 25000),
        data: dataStr,
        forma: "Transferência",
        observacao: "",
      });
    }

    // ADIANTAMENTOS — 2 ao longo do mês
    if (d === 22 || d === 8) {
      const trabId = d === 22 ? 2 : 5;
      adiantamentos.push({
        id: ts,
        trabId,
        trabNome: d === 22 ? "Adão Cortezes da Silva" : "Ramom",
        valor: 200,
        data: dataStr,
        descontado: false,
        observacao: "Adiantamento solicitado pelo trabalhador",
      });
    }
  }

  // PRODUTIVIDADE — várias entradas espalhadas no mês (1 a cada 4-5 dias por obra)
  const tiposProduzidos = [
    { tipo: "Alvenaria",    unidade: "m²", base: 28, var: 12 },
    { tipo: "Concretagem",  unidade: "m³", base: 12, var: 6  },
    { tipo: "Reboco",       unidade: "m²", base: 35, var: 15 },
    { tipo: "Pintura",      unidade: "m²", base: 42, var: 18 },
    { tipo: "Escavação",    unidade: "m³", base: 25, var: 10 },
    { tipo: "Piso",         unidade: "m²", base: 30, var: 12 },
    { tipo: "Forro",        unidade: "m²", base: 18, var: 8  },
  ];
  const obsExemplos = [
    "Parede norte do bloco A",
    "Laje do segundo pavimento",
    "Sala 03 e corredor",
    "Fundação trecho 2",
    "Trecho da rua entre PV1 e PV2",
    "Concretagem da viga V12",
    "Acabamento da fachada",
  ];
  let prodIdCounter = 1;
  for (let d = 28; d >= 1; d -= 4) {
    obrasAtivas.forEach((obra, idx) => {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - d);
      // Pula domingo
      if (data.getDay() === 0) return;
      const tp = tiposProduzidos[(d + idx) % tiposProduzidos.length];
      const qtd = +(tp.base + Math.random() * tp.var).toFixed(1);
      produtividade.push({
        id: data.getTime() + prodIdCounter++,
        obraId: obra.id,
        tipo: tp.tipo,
        qtd,
        unidade: tp.unidade,
        obs: obsExemplos[(d + idx) % obsExemplos.length],
        autor: obra.encarregado,
        ts: data.getTime(),
        data: data.toLocaleDateString("pt-BR"),
      });
    });
  }

  return { historico, fotosObras, rdosEmitidos, pedidos, movimentacoes, movEquip, diario, despesasAvulsas, adiantamentos, recebimentos, abastecimentos, produtividade };
}

export const DEFAULT_EQUIPS = [
  // EMÍLIO MARINS — equipe grande, mais equipamentos
  { id: 1,  nome: "Betoneira 400L",          codigo: "BET-001", status: "Em Uso",     obraId: 1, icon: "🔄", valorAprox: 2500 },
  { id: 2,  nome: "Vibrador de Concreto",    codigo: "VIB-001", status: "Em Uso",     obraId: 1, icon: "⚙️", valorAprox: 1800 },
  { id: 3,  nome: "Compactador de Placa",    codigo: "CPL-001", status: "Em Uso",     obraId: 1, icon: "🛠️", valorAprox: 5000 },
  { id: 4,  nome: "Martelete / Rompedor",    codigo: "MAR-001", status: "Em Uso",     obraId: 1, icon: "🔨", valorAprox: 1200 },
  { id: 5,  nome: "Serra Circular",          codigo: "SER-001", status: "Em Uso",     obraId: 1, icon: "⚙️", valorAprox: 600 },
  { id: 6,  nome: "Furadeira de Impacto",    codigo: "FUR-001", status: "Em Uso",     obraId: 1, icon: "🔧", valorAprox: 400 },
  { id: 7,  nome: "Esmerilhadeira",          codigo: "ESM-001", status: "Em Uso",     obraId: 1, icon: "⚙️", valorAprox: 350 },
  { id: 8,  nome: "Régua Vibratória",        codigo: "REG-001", status: "Em Uso",     obraId: 1, icon: "🔄", valorAprox: 2200 },

  // IFES — reforma, mais equipamentos finos
  { id: 9,  nome: "Furadeira de Impacto",    codigo: "FUR-002", status: "Em Uso",     obraId: 2, icon: "🔧", valorAprox: 400 },
  { id: 10, nome: "Esmerilhadeira",          codigo: "ESM-002", status: "Em Uso",     obraId: 2, icon: "⚙️", valorAprox: 350 },
  { id: 11, nome: "Serra Mármore",           codigo: "SMA-001", status: "Em Uso",     obraId: 2, icon: "⚙️", valorAprox: 700 },
  { id: 12, nome: "Lixadeira de Parede",     codigo: "LIX-001", status: "Em Uso",     obraId: 2, icon: "🛠️", valorAprox: 850 },
  { id: 13, nome: "Betoneira 150L",          codigo: "BET-002", status: "Em Uso",     obraId: 2, icon: "🔄", valorAprox: 1800 },

  // ANTÔNIO LEMOS — pavimentação iniciando
  { id: 14, nome: "Betoneira 400L",          codigo: "BET-003", status: "Disponível", obraId: 3, icon: "🔄", valorAprox: 2500 },
  { id: 15, nome: "Compactador de Placa",    codigo: "CPL-002", status: "Disponível", obraId: 3, icon: "🛠️", valorAprox: 5000 },

  // QUADRA JERÔNIMO MONTEIRO
  { id: 16, nome: "Betoneira 400L",          codigo: "BET-004", status: "Em Uso",     obraId: 4, icon: "🔄", valorAprox: 2500 },
  { id: 17, nome: "Vibrador de Concreto",    codigo: "VIB-002", status: "Em Uso",     obraId: 4, icon: "⚙️", valorAprox: 1800 },
  { id: 18, nome: "Furadeira de Impacto",    codigo: "FUR-003", status: "Em Uso",     obraId: 4, icon: "🔧", valorAprox: 400 },
];

export const CARGOS = ["Pedreiro","Armador","Servente","Auxiliar","Eletricista","Encanador","Mestre de Obras","Encarregado","Encarregado / Operador Retroescavadeira","Operador de Máquina","Carpinteiro","Pintor","Azulejista","Motorista","Vigia"];
// Banco completo de materiais — 500+ itens organizados por categoria
// Função utilitária: detecta unidade ideal a partir do nome do material
export const detectarUnidade = (nome) => {
  const n = (nome || "").toLowerCase();
  // Específicas
  if (/\bm[³3]\b|\b³\b/.test(n)) return "m³";
  if (/\bm[²2]\b|\b²\b/.test(n)) return "m²";
  if (/\bton\b|\btonelada/.test(n)) return "ton";
  if (/\bkg\b/.test(n) && !/saco/.test(n)) return "kg";
  if (/\b\d+\s?l\b|\blitro/.test(n)) return "unidades";
  // Materiais embalados
  if (/cimento|argamassa|rejunte|gesso|cal|massa corrida|massa acrílica|massa epóxi/.test(n)) return "sacos";
  // Tubos / barras / vergalhão
  if (/vergalhão|barra de aço|tirante/.test(n)) return "barras";
  if (/tubo |cano |eletroduto/.test(n)) return "barras";
  // Rolos / mantas
  if (/cabo |fio |fita |arame |bidim|geotêxtil|geomembrana|manta|lona|tela mosquiteiro|tela de prote/.test(n)) return "rolos";
  // Telhas / tijolos / blocos / pisos / revestimentos
  if (/telha|tijolo|bloco|piso |porcelanato|azulejo|pastilha|paralelepípedo|pedra portuguesa|meio-fio|sarjeta|cordão|cumeeira|calha|rufo/.test(n)) return "unidades";
  // Madeira / tábuas / sarrafos
  if (/tábua|sarrafo|caibro|ripa|madeirite|compensado|mdf|pontalete|viga de eucalipto|estaca/.test(n)) return "peças";
  // Areia / brita / pedra
  if (/areia|brita|saibro|pó de pedra|bica|rachão|pedrisco|pedra-mãe|graduada/.test(n)) return "m³";
  // Concreto
  if (/concreto/.test(n) && !/peças|estrutural/.test(n)) return "m³";
  // Pintura
  if (/tinta|verniz|selador|aditivo|hidrofugante|cola |veda |solução|emulsão asfáltica|pintura de ligação/.test(n)) return "unidades";
  // EPI / Ferramentas / Pequenos
  if (/luva|capacete|óculos|protetor|máscara|cinto|abafador|bota /.test(n)) return "unidades";
  if (/martelo|marreta|talhadeira|picareta|pá |carrinho|caçamba|colher de pedreiro|desempenadeira|régua|trena|nível|prumo|esquadro|linha de pedreiro|bisnaga/.test(n)) return "unidades";
  if (/lâmina|disco|broca|parafuso|prego|pino/.test(n)) return "unidades";
  // Caixa d'água
  if (/caixa d.água/.test(n)) return "unidades";
  // Default
  return "unidades";
};

// Banco estruturado de materiais
// formato: { nome, unidadePadrao, marcas?, categoria }

/* ════════════════════════════════════
   CATÁLOGO PROFISSIONAL — versão essencial
   (Versão completa de 999 mat. removida pra não estourar limite do Claude.ai)
════════════════════════════════════ */
export const CATALOGO_KM_FULL = [
  ["01.100.0001", "Solo de Empréstimo", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0002", "Areia de Aterro", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0003", "Bica Corrida", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0004", "Pedra Rachão", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0005", "Pedra de Mão", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0006", "Cascalho", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0007", "Saibro", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0008", "Geotêxtil RT-7 200g/m²", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0009", "Geotêxtil RT-10 300g/m²", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0010", "Geotêxtil RT-14 400g/m²", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0011", "Geogrelha Biaxial 30/30 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0012", "Geogrelha Biaxial 40/40 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0013", "Geogrelha Uniaxial 60 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0014", "Geogrelha Uniaxial 110 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0015", "Geomembrana PEAD 0,8mm", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.200.0001", "Tubo Concreto Armado PA-1 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0002", "Tubo Concreto Armado PA-2 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0003", "Tubo Concreto Armado PA-3 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0004", "Tubo Concreto Armado PA-4 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0005", "Tubo Concreto Armado PA-1 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0006", "Tubo Concreto Armado PA-2 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0007", "Tubo Concreto Armado PA-3 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0008", "Tubo Concreto Armado PA-4 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0009", "Tubo Concreto Armado PA-1 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0010", "Tubo Concreto Armado PA-2 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0011", "Tubo Concreto Armado PA-3 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0012", "Tubo Concreto Armado PA-4 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0013", "Tubo Concreto Armado PA-1 DN 500mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0014", "Tubo Concreto Armado PA-2 DN 500mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0015", "Tubo Concreto Armado PA-3 DN 500mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.300.0001", "CBUQ Faixa A", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0002", "CBUQ Faixa B", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0003", "CBUQ Faixa C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0004", "CBUQ Faixa D", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0005", "CAP 30/45", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0006", "CAP 50/70", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0007", "CAP 85/100", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0008", "Asfalto Borracha AB-22", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0009", "Asfalto Polímero SBS", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0010", "Emulsão Asfáltica RR-1C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0011", "Emulsão Asfáltica RR-2C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0012", "Emulsão Asfáltica RM-1C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0013", "Emulsão Catiônica RC-1C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0014", "Asfalto Diluído CM-30", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0015", "Asfalto Diluído CM-70", "t", "Infraestrutura", "Pavimentação"],
  ["02.100.0001", "Vergalhão CA-50 6.3mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0002", "Vergalhão CA-50 8.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0003", "Vergalhão CA-50 10.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0004", "Vergalhão CA-50 12.5mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0005", "Vergalhão CA-50 16.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0006", "Vergalhão CA-50 20.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0007", "Vergalhão CA-50 25.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0008", "Vergalhão CA-50 32.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0009", "Vergalhão CA-50 40.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0010", "Vergalhão CA-60 4.2mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0011", "Vergalhão CA-60 5.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0012", "Vergalhão CA-60 6.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0013", "Vergalhão CA-60 7.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0014", "Vergalhão CA-60 8.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0015", "Vergalhão CA-60 9.5mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.200.0001", "Cimento CP I-S-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0002", "Cimento CP I-S-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0003", "Cimento CP II-E-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0004", "Cimento CP II-E-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0005", "Cimento CP II-E-40 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0006", "Cimento CP II-E-40 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0007", "Cimento CP II-F-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0008", "Cimento CP II-F-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0009", "Cimento CP II-F-40 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0010", "Cimento CP II-F-40 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0011", "Cimento CP II-Z-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0012", "Cimento CP II-Z-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0013", "Cimento CP III-32-RS – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0014", "Cimento CP III-32-RS – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0015", "Cimento CP III-40 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0035", "Concreto Usinado fck 15 MPa Convencional Brita 1", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0036", "Concreto Usinado fck 15 MPa Convencional Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0037", "Concreto Usinado fck 15 MPa Bombeável Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0038", "Concreto Usinado fck 15 MPa Autoadensável (CAA)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0039", "Concreto Usinado fck 15 MPa Alto Desempenho (CAD)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0040", "Concreto Usinado fck 15 MPa com Microfibra", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0041", "Concreto Usinado fck 15 MPa com Macrofibra Aço", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0042", "Concreto Usinado fck 15 MPa Leve com Argila Expandida", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0043", "Concreto Usinado fck 15 MPa Projetado", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0044", "Concreto Usinado fck 15 MPa Subaquático", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0045", "Concreto Usinado fck 18 MPa Convencional Brita 1", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0046", "Concreto Usinado fck 18 MPa Convencional Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0047", "Concreto Usinado fck 18 MPa Bombeável Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0048", "Concreto Usinado fck 18 MPa Autoadensável (CAA)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0049", "Concreto Usinado fck 18 MPa Alto Desempenho (CAD)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0159", "Brita 0 (Pedrisco)", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0160", "Brita 1", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0161", "Brita 2", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0162", "Brita 3", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0163", "Brita 4", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0164", "Brita 5", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0165", "Pó de Pedra", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0166", "Pedrisco Lavado", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0167", "Areia Grossa Lavada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0168", "Areia Média Lavada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0169", "Areia Fina Lavada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0170", "Areia Reciclada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0171", "Areia Industrial", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0172", "Areia para Reboco", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0173", "Areia para Filtro", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0189", "Argamassa AC-I Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0190", "Argamassa AC-I Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0191", "Argamassa AC-II Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0192", "Argamassa AC-II Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0193", "Argamassa AC-III Porcelanato Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0194", "Argamassa AC-III Porcelanato Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0195", "Argamassa AC-III Externa Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0196", "Argamassa AC-III Externa Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0197", "Argamassa Polimérica MultiUso Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0198", "Argamassa Estabilizada de Assentamento", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0199", "Argamassa Estabilizada de Reboco", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0200", "Argamassa Industrializada para Bloco Estrutural", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0201", "Argamassa Refratária", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0202", "Argamassa para Pedra Natural", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0203", "Argamassa Decorativa Grafiato", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.300.0001", "Bloco Cerâmico Vedação 6 Furos 9x14x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0002", "Bloco Cerâmico Vedação 6 Furos 9x14x24", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0003", "Bloco Cerâmico Vedação 8 Furos 9x19x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0004", "Bloco Cerâmico Vedação 8 Furos 9x19x24", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0005", "Bloco Cerâmico Vedação 9 Furos 11,5x19x24", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0006", "Bloco Cerâmico Vedação 11,5x19x39", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0007", "Bloco Cerâmico Estrutural 14x19x29", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0008", "Bloco Cerâmico Estrutural 14x19x39", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0009", "Tijolo Cerâmico Maciço 5x10x20", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0010", "Tijolo Cerâmico Maciço 5x10x23", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0011", "Tijolo Cerâmico Aparente Refratário", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0012", "Tijolo Refratário Comum", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0013", "Tijolo Baiano 9x14x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0014", "Tijolo de Vidro 19x19x8cm", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0015", "Bloco de Concreto Vedação 9x19x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["03.100.0001", "Tubo PVC Soldável Marrom DN 20mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0002", "Tubo PVC Soldável Marrom DN 25mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0003", "Tubo PVC Soldável Marrom DN 32mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0004", "Tubo PVC Soldável Marrom DN 40mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0005", "Tubo PVC Soldável Marrom DN 50mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0006", "Tubo PVC Soldável Marrom DN 60mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0007", "Tubo PVC Soldável Marrom DN 75mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0008", "Tubo PVC Soldável Marrom DN 85mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0009", "Tubo PVC Soldável Marrom DN 100mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0010", "Tubo PVC Soldável Marrom DN 110mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0011", "Tubo PVC Roscável Branco DN 1/2\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0012", "Tubo PVC Roscável Branco DN 3/4\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0013", "Tubo PVC Roscável Branco DN 1\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0014", "Tubo PVC Roscável Branco DN 1.1/4\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0015", "Tubo PVC Roscável Branco DN 1.1/2\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0148", "Registro Gaveta Bruto 15mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0149", "Registro Gaveta Bruto 20mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0150", "Registro Gaveta Bruto 25mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0151", "Registro Gaveta Bruto 32mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0152", "Registro Gaveta Bruto 40mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0153", "Registro Gaveta Bruto 50mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0154", "Registro Gaveta Bruto 65mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0155", "Registro Gaveta Bruto 80mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0156", "Registro Esfera Soldável VS 15mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0157", "Registro Esfera Soldável VS 20mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0158", "Registro Esfera Soldável VS 25mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0159", "Registro Esfera Soldável VS 32mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0160", "Registro Esfera Soldável VS 40mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0161", "Registro Esfera Soldável VS 50mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0162", "Registro Esfera Soldável VS 65mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0196", "Caixa d'Água Polietileno 100L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0197", "Caixa d'Água Polietileno 150L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0198", "Caixa d'Água Polietileno 250L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0199", "Caixa d'Água Polietileno 310L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0200", "Caixa d'Água Polietileno 500L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0201", "Caixa d'Água Polietileno 750L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0202", "Caixa d'Água Polietileno 1000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0203", "Caixa d'Água Polietileno 1500L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0204", "Caixa d'Água Polietileno 2000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0205", "Caixa d'Água Polietileno 3000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0206", "Caixa d'Água Polietileno 5000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0207", "Caixa d'Água Polietileno 7500L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0208", "Caixa d'Água Polietileno 10000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0209", "Caixa d'Água Polietileno 15000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0210", "Caixa d'Água Polietileno 20000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0234", "Aquecedor Solar Coletor 1,0m²", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0235", "Aquecedor Solar Coletor 1,5m²", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0236", "Aquecedor Solar Coletor 2,0m²", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0237", "Reservatório Térmico 200L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0238", "Reservatório Térmico 400L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0239", "Reservatório Térmico 600L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0240", "Aquecedor a Gás Passagem 6L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0241", "Aquecedor a Gás Passagem 10L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0242", "Aquecedor a Gás Passagem 13L Digital", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0243", "Aquecedor a Gás Passagem 18L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0244", "Aquecedor a Gás Passagem 22L Inox", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0245", "Aquecedor a Gás Passagem 32L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0246", "Aquecedor de Acumulação 100L Elétrico", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0247", "Aquecedor de Acumulação 200L Elétrico", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0248", "Boiler Elétrico 200L Inox", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0256", "Bacia Convencional", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0257", "Bacia c/ Caixa Acoplada Branca", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0258", "Bacia c/ Caixa Acoplada Cinza", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0259", "Bacia c/ Caixa Acoplada Preta", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0260", "Bacia Suspensa Cerâmica", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0261", "Bacia Turca", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0262", "Bacia Infantil", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0263", "Lavatório c/ Coluna 45cm", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0264", "Lavatório c/ Coluna 50cm", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0265", "Lavatório Suspenso", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0266", "Lavatório Semi-Coluna", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0267", "Cuba de Embutir Oval", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0268", "Cuba de Embutir Retangular", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0269", "Cuba de Sobrepor Redonda", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0270", "Cuba de Sobrepor Quadrada", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0285", "Torneira Lavatório Bica Baixa Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0286", "Torneira Lavatório Bica Alta Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0287", "Torneira Lavatório Cromada de Parede", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0288", "Torneira Cozinha Bica Móvel Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0289", "Torneira Cozinha Bica Móvel Parede", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0290", "Torneira Cozinha Gourmet Pia Cromada", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0291", "Torneira de Jardim 1/2\"", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0292", "Torneira de Jardim 3/4\"", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0293", "Torneira Tanque Cromada", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0294", "Misturador Lavatório Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0295", "Misturador Cozinha Mesa Bica Móvel", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0296", "Misturador Cozinha Parede", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0297", "Monocomando Lavatório Cromado", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0298", "Monocomando Cozinha Bica Móvel", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0299", "Monocomando Cozinha Gourmet", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.200.0001", "Tubo PVC Esgoto Série Normal DN 40mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0002", "Tubo PVC Esgoto Série Normal DN 50mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0003", "Tubo PVC Esgoto Série Normal DN 75mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0004", "Tubo PVC Esgoto Série Normal DN 100mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0005", "Tubo PVC Esgoto Série Normal DN 150mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0006", "Tubo PVC Esgoto Série Normal DN 200mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0007", "Tubo PVC Esgoto Série Reforçada DN 40mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0008", "Tubo PVC Esgoto Série Reforçada DN 50mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0009", "Tubo PVC Esgoto Série Reforçada DN 75mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0010", "Tubo PVC Esgoto Série Reforçada DN 100mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0011", "Tubo PVC Esgoto Série Reforçada DN 150mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0012", "Tubo PVC Esgoto Série Reforçada DN 200mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0013", "Tubo PVC Esgoto Série Reforçada DN 250mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0014", "Tubo PVC Esgoto Série Reforçada DN 300mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0015", "Joelho 90° Esgoto 40mm", "un", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0075", "Caixa Sifonada PVC 100x100x50 c/ Grelha", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0076", "Caixa Sifonada PVC 100x150x50 c/ Grelha", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0077", "Caixa Sifonada PVC 150x150x50 c/ Grelha", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0078", "Caixa Sifonada Inox 100x150x50", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0079", "Caixa de Inspeção Esgoto 30x30", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0080", "Caixa de Inspeção Esgoto 40x40", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0081", "Caixa de Inspeção Esgoto 60x60", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0082", "Caixa de Gordura PVC Pequena", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0083", "Caixa de Gordura PVC Grande", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0084", "Caixa de Gordura Concreto", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0085", "Caixa de Passagem 30x30", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0086", "Caixa de Passagem 40x40", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0087", "Ralo Sifonado PVC 100x40", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0088", "Ralo Sifonado PVC 100x53", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0089", "Ralo Linear Inox 5x50cm", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.300.0001", "Tubo Galvanizado Schedule 40 DN 1/2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0002", "Tubo Galvanizado Schedule 40 DN 3/4\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0003", "Tubo Galvanizado Schedule 40 DN 1\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0004", "Tubo Galvanizado Schedule 40 DN 1.1/4\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0005", "Tubo Galvanizado Schedule 40 DN 1.1/2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0006", "Tubo Galvanizado Schedule 40 DN 2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0007", "Tubo Galvanizado Schedule 40 DN 2.1/2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0008", "Tubo Galvanizado Schedule 40 DN 3\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0009", "Tubo Galvanizado Schedule 40 DN 4\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
];

// Helpers do catálogo
export const CAT_KM_BUSCA = (termo) => {
  if (!termo || termo.length < 2) return [];
  const t = termo.toLowerCase();
  return CATALOGO_KM_FULL.filter(m =>
    m[1].toLowerCase().includes(t) ||
    m[0].includes(termo) ||
    m[3].toLowerCase().includes(t) ||
    m[4].toLowerCase().includes(t)
  ).slice(0, 30);
};
export const CAT_KM_CATEGORIAS = [...new Set(CATALOGO_KM_FULL.map(m => m[3]))];
export const CAT_KM_SUBCATEGORIAS = (cat) => [...new Set(CATALOGO_KM_FULL.filter(m => m[3] === cat).map(m => m[4]))];

export const MATERIAIS_BANCO_DETALHADO = [
  // ═══ CIMENTO ═══
  { nome: "Cimento CP-II 50kg", un: "sacos", marcas: ["Votorantim", "Itambé", "Mizu", "Holcim", "InterCement"], cat: "Cimento" },
  { nome: "Cimento CP-III 50kg", un: "sacos", marcas: ["Votorantim", "Mizu", "Holcim", "Itambé"], cat: "Cimento" },
  { nome: "Cimento CP-IV 50kg", un: "sacos", marcas: ["Votorantim", "Mizu", "Itambé"], cat: "Cimento" },
  { nome: "Cimento CP-V ARI 50kg", un: "sacos", marcas: ["Votorantim", "Holcim", "Mizu"], cat: "Cimento" },
  { nome: "Cimento branco 25kg", un: "sacos", marcas: ["Votorantim", "Itambé"], cat: "Cimento" },

  // ═══ ARGAMASSA / REJUNTE ═══
  { nome: "Argamassa colante AC-I 20kg (interno)", un: "sacos", marcas: ["Quartzolit", "Votomassa", "Cimentcola", "Fortaleza"], cat: "Argamassa" },
  { nome: "Argamassa colante AC-II 20kg (semi-úmido)", un: "sacos", marcas: ["Quartzolit", "Votomassa", "Cimentcola"], cat: "Argamassa" },
  { nome: "Argamassa colante AC-III 20kg (externo/molhado)", un: "sacos", marcas: ["Quartzolit ACIII", "Votomassa AC-III", "Cimentcola Plus"], cat: "Argamassa" },
  { nome: "Argamassa polimérica flexível 20kg", un: "sacos", marcas: ["Quartzolit", "Votomassa"], cat: "Argamassa" },
  { nome: "Argamassa industrializada de assentamento 20kg", un: "sacos", marcas: ["Quartzolit", "Votomassa"], cat: "Argamassa" },
  { nome: "Argamassa preparada para revestimento 20kg", un: "sacos", marcas: ["Quartzolit", "Votomassa"], cat: "Argamassa" },
  { nome: "Rejunte cinza 1kg", un: "unidades", marcas: ["Quartzolit", "Cera Master", "Portokoll"], cat: "Argamassa" },
  { nome: "Rejunte branco 1kg", un: "unidades", marcas: ["Quartzolit", "Cera Master", "Portokoll"], cat: "Argamassa" },
  { nome: "Rejunte colorido 1kg", un: "unidades", marcas: ["Quartzolit", "Cera Master", "Portokoll"], cat: "Argamassa" },
  { nome: "Rejunte epóxi 1kg", un: "unidades", marcas: ["Quartzolit Epóxi", "Portokoll Epóxi"], cat: "Argamassa" },

  // ═══ CAL / GESSO ═══
  { nome: "Cal hidratada 20kg", un: "sacos", marcas: ["Itaú", "Vimasa", "Hidrocal"], cat: "Cal/Gesso" },
  { nome: "Cal virgem 20kg", un: "sacos", marcas: ["Itaú", "Vimasa"], cat: "Cal/Gesso" },
  { nome: "Gesso 40kg", un: "sacos", marcas: ["Gesso Brasil", "Gypsum"], cat: "Cal/Gesso" },
  { nome: "Massa corrida 18L (PVA)", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams", "Iquine"], cat: "Pintura" },
  { nome: "Massa acrílica 18L", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams"], cat: "Pintura" },

  // ═══ ADITIVOS ═══
  { nome: "Aditivo plastificante 1L", un: "unidades", marcas: ["Vedacit", "Sika", "Otto Baumgart"], cat: "Aditivo" },
  { nome: "Aditivo impermeabilizante 1L", un: "unidades", marcas: ["Vedacit", "Sika", "Otto Baumgart"], cat: "Aditivo" },
  { nome: "Aditivo acelerador de pega 1L", un: "unidades", marcas: ["Vedacit", "Sika"], cat: "Aditivo" },
  { nome: "Aditivo retardador 1L", un: "unidades", marcas: ["Vedacit", "Sika"], cat: "Aditivo" },
  { nome: "Hidrofugante 5L", un: "unidades", marcas: ["Vedacit", "Sika", "Wolf"], cat: "Aditivo" },
  { nome: "Liga para argamassa 1L", un: "unidades", marcas: ["Vedacit", "Sika"], cat: "Aditivo" },

  // ═══ AREIA / BRITA / PEDRA ═══
  { nome: "Areia média lavada", un: "m³", cat: "Agregado" },
  { nome: "Areia grossa", un: "m³", cat: "Agregado" },
  { nome: "Areia fina", un: "m³", cat: "Agregado" },
  { nome: "Areia de reboco", un: "m³", cat: "Agregado" },
  { nome: "Saibro", un: "m³", cat: "Agregado" },
  { nome: "Brita 0", un: "m³", cat: "Agregado" },
  { nome: "Brita 1", un: "m³", cat: "Agregado" },
  { nome: "Brita 2", un: "m³", cat: "Agregado" },
  { nome: "Brita 3", un: "m³", cat: "Agregado" },
  { nome: "Brita 4", un: "m³", cat: "Agregado" },
  { nome: "Pó de pedra", un: "m³", cat: "Agregado" },
  { nome: "Bica corrida", un: "m³", cat: "Agregado" },
  { nome: "Rachão", un: "m³", cat: "Agregado" },
  { nome: "Pedrisco", un: "m³", cat: "Agregado" },
  { nome: "Brita graduada", un: "m³", cat: "Agregado" },

  // ═══ CONCRETO ═══
  { nome: "Concreto FCK 15 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 20 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 25 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 30 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 35 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix"], cat: "Concreto" },
  { nome: "Concreto bombeável FCK 25 MPa", un: "m³", marcas: ["Polimix", "Engemix"], cat: "Concreto" },
  { nome: "Microconcreto autonivelante", un: "m³", marcas: ["Polimix", "Engemix"], cat: "Concreto" },

  // ═══ AÇO / VERGALHÃO ═══
  { nome: "Vergalhão CA-50 4,2mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 5,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 6,3mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 8,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 10,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 12,5mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 16,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-50 20,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-50 25,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-60 5,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-60 6,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Tela soldada Q-138 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-159 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-196 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-246 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-283 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Estribo pronto 5mm CA-60", un: "unidades", marcas: ["Gerdau"], cat: "Aço" },
  { nome: "Estribo pronto 6,3mm CA-60", un: "unidades", marcas: ["Gerdau"], cat: "Aço" },
  { nome: "Estribo pronto 8mm CA-50", un: "unidades", marcas: ["Gerdau"], cat: "Aço" },
  { nome: "Arame recozido nº 18 1kg", un: "kg", marcas: ["Belgo", "Gerdau"], cat: "Aço" },
  { nome: "Arame galvanizado 1kg", un: "kg", marcas: ["Belgo", "Gerdau"], cat: "Aço" },
  { nome: "Arame farpado 500m", un: "rolos", marcas: ["Belgo", "Gerdau"], cat: "Aço" },
  { nome: "Espaçador plástico para ferragem", un: "unidades", cat: "Aço" },

  // ═══ TIJOLOS / BLOCOS ═══
  { nome: "Tijolo cerâmico 9×14×19 (8 furos)", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo cerâmico 9×19×19 (vedação)", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo cerâmico 11,5×14×19", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo baiano 9×14×24", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo maciço comum", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo de vidro 19×19×8", un: "unidades", marcas: ["Cebrace", "Vimar"], cat: "Bloco" },
  { nome: "Bloco de concreto estrutural 14×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco de concreto vedação 9×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco de concreto 14×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco de concreto 19×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco celular autoclavado (Sical)", un: "unidades", marcas: ["Sical", "Celucon"], cat: "Bloco" },

  // ═══ TELHAS ═══
  { nome: "Telha cerâmica colonial", un: "unidades", marcas: ["Telha Forte", "Telhanorte"], cat: "Telha" },
  { nome: "Telha cerâmica francesa", un: "unidades", cat: "Telha" },
  { nome: "Telha cerâmica romana", un: "unidades", cat: "Telha" },
  { nome: "Telha cerâmica portuguesa", un: "unidades", cat: "Telha" },
  { nome: "Telha cerâmica plan", un: "unidades", cat: "Telha" },
  { nome: "Telha de fibrocimento 6mm 2,44m", un: "unidades", marcas: ["Eternit", "Brasilit", "Imbralit"], cat: "Telha" },
  { nome: "Telha de fibrocimento 6mm 3,05m", un: "unidades", marcas: ["Eternit", "Brasilit", "Imbralit"], cat: "Telha" },
  { nome: "Telha de fibrocimento 6mm 3,66m", un: "unidades", marcas: ["Eternit", "Brasilit", "Imbralit"], cat: "Telha" },
  { nome: "Telha de fibrocimento 8mm 4,27m", un: "unidades", marcas: ["Eternit", "Brasilit"], cat: "Telha" },
  { nome: "Telha shingle (madeirada)", un: "unidades", marcas: ["Owens Corning", "IKO"], cat: "Telha" },
  { nome: "Telha translúcida", un: "unidades", marcas: ["Onduline"], cat: "Telha" },
  { nome: "Telha termoacústica", un: "m²", cat: "Telha" },
  { nome: "Telha sanduíche", un: "m²", cat: "Telha" },
  { nome: "Telha galvanizada", un: "m²", cat: "Telha" },
  { nome: "Cumeeira cerâmica", un: "unidades", cat: "Telha" },
  { nome: "Cumeeira fibrocimento", un: "unidades", marcas: ["Eternit", "Brasilit"], cat: "Telha" },
  { nome: "Calha galvanizada 6m", un: "barras", cat: "Telha" },
  { nome: "Rufo galvanizado 6m", un: "barras", cat: "Telha" },

  // ═══ MADEIRA ═══
  { nome: "Caibro 5×6cm × 4m (eucalipto)", un: "peças", cat: "Madeira" },
  { nome: "Caibro 5×6cm × 6m (eucalipto)", un: "peças", cat: "Madeira" },
  { nome: "Sarrafo 2,5×10cm × 4m", un: "peças", cat: "Madeira" },
  { nome: "Sarrafo 2,5×10cm × 6m", un: "peças", cat: "Madeira" },
  { nome: "Ripa 1,5×5cm × 4m", un: "peças", cat: "Madeira" },
  { nome: "Tábua de pinus 2,5×30cm", un: "peças", cat: "Madeira" },
  { nome: "Tábua de cedrinho", un: "peças", cat: "Madeira" },
  { nome: "Madeirite plastificado 14mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite plastificado 17mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite plastificado 20mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite resinado 12mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite resinado 15mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite resinado 18mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Compensado naval 15mm", un: "peças", cat: "Madeira" },
  { nome: "Compensado virola 15mm", un: "peças", cat: "Madeira" },
  { nome: "MDF cru 15mm", un: "peças", marcas: ["Duratex", "Eucatex", "Berneck"], cat: "Madeira" },
  { nome: "MDF cru 18mm", un: "peças", marcas: ["Duratex", "Eucatex", "Berneck"], cat: "Madeira" },
  { nome: "Pontalete 7×7cm × 3m", un: "peças", cat: "Madeira" },
  { nome: "Estaca de madeira 4m", un: "peças", cat: "Madeira" },

  // ═══ ESQUADRIAS ═══
  { nome: "Porta de madeira semi-oca 0,80×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta de madeira semi-oca 0,70×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta de madeira semi-oca 0,60×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta maciça 0,80×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta maciça 0,90×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Batente de madeira 14cm", un: "unidades", cat: "Esquadria" },
  { nome: "Guarnição/alizar (jogo)", un: "unidades", cat: "Esquadria" },
  { nome: "Fechadura interna", un: "unidades", marcas: ["Pado", "La Fonte", "Stam"], cat: "Esquadria" },
  { nome: "Fechadura externa", un: "unidades", marcas: ["Pado", "La Fonte", "Stam"], cat: "Esquadria" },
  { nome: "Fechadura banheiro", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Dobradiça 3 polegadas (par)", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Maçaneta esfera", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Maçaneta alavanca", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Janela de alumínio 1,00×1,00m", un: "unidades", marcas: ["Sasazaki", "Belmetal"], cat: "Esquadria" },
  { nome: "Janela de alumínio 1,20×1,00m", un: "unidades", marcas: ["Sasazaki", "Belmetal"], cat: "Esquadria" },
  { nome: "Janela basculante alumínio 0,60×0,40m", un: "unidades", marcas: ["Sasazaki"], cat: "Esquadria" },
  { nome: "Janela maxim-ar alumínio", un: "unidades", marcas: ["Sasazaki", "Belmetal"], cat: "Esquadria" },
  { nome: "Janela de correr 2 folhas alumínio", un: "unidades", marcas: ["Sasazaki"], cat: "Esquadria" },
  { nome: "Janela veneziana alumínio", un: "unidades", marcas: ["Sasazaki"], cat: "Esquadria" },
  { nome: "Vidro temperado 8mm", un: "m²", marcas: ["Cebrace", "Guardian"], cat: "Esquadria" },
  { nome: "Vidro comum 4mm", un: "m²", marcas: ["Cebrace"], cat: "Esquadria" },
  { nome: "Vidro fantasia", un: "m²", marcas: ["Cebrace"], cat: "Esquadria" },
  { nome: "Box de vidro temperado para banheiro", un: "unidades", cat: "Esquadria" },

  // ═══ PINTURA ═══
  { nome: "Tinta látex PVA 18L branca", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams", "Iquine"], cat: "Pintura" },
  { nome: "Tinta látex PVA 18L colorida", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams"], cat: "Pintura" },
  { nome: "Tinta látex acrílica premium 18L", un: "unidades", marcas: ["Suvinil", "Coral Decora", "Sherwin-Williams"], cat: "Pintura" },
  { nome: "Tinta látex acrílica standard 18L", un: "unidades", marcas: ["Suvinil", "Coral", "Iquine"], cat: "Pintura" },
  { nome: "Tinta semi-brilho 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Tinta esmalte sintético 3,6L", un: "unidades", marcas: ["Suvinil", "Coralit", "Sherwin-Williams"], cat: "Pintura" },
  { nome: "Tinta esmalte base d'água 3,6L", un: "unidades", marcas: ["Coralar", "Suvinil"], cat: "Pintura" },
  { nome: "Tinta para piso 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Tinta para telhado 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Tinta epóxi 3,6L", un: "unidades", marcas: ["Sherwin-Williams", "Renner"], cat: "Pintura" },
  { nome: "Tinta antiferrugem 3,6L", un: "unidades", marcas: ["Suvinil", "Coralit"], cat: "Pintura" },
  { nome: "Verniz marítimo 3,6L", un: "unidades", marcas: ["Coral", "Sayerlack"], cat: "Pintura" },
  { nome: "Selador acrílico 3,6L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Fundo preparador 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Lixa para parede nº 100", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Lixa para parede nº 150", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Lixa para parede nº 220", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Lixa para madeira nº 80", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Rolo de lã 23cm", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Rolo de espuma 15cm", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Rolo de espuma 23cm", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 1 polegada", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 2 polegadas", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 3 polegadas", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 4 polegadas", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Trincha", un: "unidades", marcas: ["Atlas"], cat: "Pintura" },
  { nome: "Bandeja para tinta", un: "unidades", cat: "Pintura" },
  { nome: "Fita crepe 18mm × 50m", un: "unidades", marcas: ["3M", "Adelbras"], cat: "Pintura" },
  { nome: "Fita crepe 24mm × 50m", un: "unidades", marcas: ["3M", "Adelbras"], cat: "Pintura" },
  { nome: "Fita crepe 48mm × 50m", un: "unidades", marcas: ["3M", "Adelbras"], cat: "Pintura" },

  // ═══ HIDRÁULICA — TUBOS PVC ESGOTO ═══
  { nome: "Tubo PVC esgoto Ø 40mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 50mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 75mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 100mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 150mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 200mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },

  // ═══ HIDRÁULICA — TUBOS PVC SOLDÁVEL ═══
  { nome: "Tubo PVC marrom soldável Ø 20mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 25mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 32mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 40mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 50mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 60mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 75mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },

  // ═══ CONEXÕES PVC ═══
  { nome: "Joelho 90° PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 90° PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 90° PVC soldável Ø 40mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 45° PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 45° PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tê PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tê PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tê PVC soldável Ø 40mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Luva PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Luva PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Cap PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Adaptador soldável-roscável", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Curva PVC 90° Ø 100mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Curva PVC 45° Ø 100mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },

  // ═══ HIDRÁULICA — LOUÇAS / METAIS ═══
  { nome: "Vaso sanitário com caixa acoplada", un: "unidades", marcas: ["Deca", "Roca", "Celite", "Incepa"], cat: "Hidráulica" },
  { nome: "Vaso sanitário convencional", un: "unidades", marcas: ["Deca", "Celite", "Incepa"], cat: "Hidráulica" },
  { nome: "Caixa acoplada para vaso", un: "unidades", marcas: ["Deca", "Celite"], cat: "Hidráulica" },
  { nome: "Assento sanitário", un: "unidades", marcas: ["Astra", "Tupan"], cat: "Hidráulica" },
  { nome: "Lavatório com coluna", un: "unidades", marcas: ["Deca", "Celite", "Incepa"], cat: "Hidráulica" },
  { nome: "Pia inox 1,20m com cuba", un: "unidades", marcas: ["Tramontina", "Mekal"], cat: "Hidráulica" },
  { nome: "Cuba de embutir 35×40cm", un: "unidades", marcas: ["Tramontina", "Mekal"], cat: "Hidráulica" },
  { nome: "Tanque de mármore sintético", un: "unidades", marcas: ["Tanque Mor"], cat: "Hidráulica" },
  { nome: "Torneira de mesa lavatório", un: "unidades", marcas: ["Deca", "Lorenzetti", "Hydra"], cat: "Hidráulica" },
  { nome: "Torneira de parede pia", un: "unidades", marcas: ["Deca", "Lorenzetti", "Hydra"], cat: "Hidráulica" },
  { nome: "Torneira para jardim", un: "unidades", marcas: ["Deca", "Hydra"], cat: "Hidráulica" },
  { nome: "Torneira para tanque", un: "unidades", marcas: ["Deca", "Lorenzetti"], cat: "Hidráulica" },
  { nome: "Misturador monocomando lavatório", un: "unidades", marcas: ["Deca", "Docol", "Lorenzetti"], cat: "Hidráulica" },
  { nome: "Chuveiro elétrico", un: "unidades", marcas: ["Lorenzetti", "Hydra", "Cardal"], cat: "Hidráulica" },
  { nome: "Ducha higiênica", un: "unidades", marcas: ["Deca", "Lorenzetti"], cat: "Hidráulica" },
  { nome: "Registro de gaveta 3/4", un: "unidades", marcas: ["Deca", "Docol", "Hydra"], cat: "Hidráulica" },
  { nome: "Registro de gaveta 1\"", un: "unidades", marcas: ["Deca", "Docol", "Hydra"], cat: "Hidráulica" },
  { nome: "Registro de pressão", un: "unidades", marcas: ["Deca", "Docol", "Hydra"], cat: "Hidráulica" },
  { nome: "Registro esfera 3/4", un: "unidades", marcas: ["Tigre", "Hydra"], cat: "Hidráulica" },
  { nome: "Sifão sanfonado", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },
  { nome: "Sifão copo", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },
  { nome: "Engate flexível 30cm", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },
  { nome: "Caixa sifonada 100×40", un: "unidades", marcas: ["Tigre", "Astra"], cat: "Hidráulica" },
  { nome: "Ralo seco 100mm", un: "unidades", marcas: ["Tigre", "Astra"], cat: "Hidráulica" },
  { nome: "Ralo sifonado", un: "unidades", marcas: ["Tigre", "Astra"], cat: "Hidráulica" },
  { nome: "Cola PVC 75g", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Cola PVC 175g", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Cola PVC 850g", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Veda rosca 18m", un: "unidades", marcas: ["Tigre", "3M"], cat: "Hidráulica" },
  { nome: "Caixa d'água 250L", un: "unidades", marcas: ["Fortlev", "Acqualimp", "Tigre"], cat: "Hidráulica" },
  { nome: "Caixa d'água 500L", un: "unidades", marcas: ["Fortlev", "Acqualimp", "Tigre"], cat: "Hidráulica" },
  { nome: "Caixa d'água 1000L", un: "unidades", marcas: ["Fortlev", "Acqualimp", "Tigre"], cat: "Hidráulica" },
  { nome: "Caixa d'água 2000L", un: "unidades", marcas: ["Fortlev", "Acqualimp"], cat: "Hidráulica" },
  { nome: "Caixa d'água 5000L", un: "unidades", marcas: ["Fortlev", "Acqualimp"], cat: "Hidráulica" },
  { nome: "Boia para caixa d'água", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },

  // ═══ ELÉTRICA — ELETRODUTOS / CAIXAS ═══
  { nome: "Eletroduto corrugado 20mm × 25m", un: "rolos", marcas: ["Tigre", "Amanco", "Krona"], cat: "Elétrica" },
  { nome: "Eletroduto corrugado 25mm × 25m", un: "rolos", marcas: ["Tigre", "Amanco", "Krona"], cat: "Elétrica" },
  { nome: "Eletroduto corrugado 32mm × 25m", un: "rolos", marcas: ["Tigre", "Amanco"], cat: "Elétrica" },
  { nome: "Eletroduto rígido PVC 20mm × 3m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Elétrica" },
  { nome: "Eletroduto rígido PVC 25mm × 3m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Elétrica" },
  { nome: "Caixa 4×2 PVC", un: "unidades", marcas: ["Tigre", "Pial Legrand"], cat: "Elétrica" },
  { nome: "Caixa 4×4 PVC", un: "unidades", marcas: ["Tigre", "Pial Legrand"], cat: "Elétrica" },
  { nome: "Caixa octogonal PVC para teto", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },
  { nome: "Caixa de passagem 10×10", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },
  { nome: "Caixa de passagem 15×15", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },

  // ═══ ELÉTRICA — CABOS ═══
  { nome: "Cabo flexível 1,5mm² × 100m (azul)", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 1,5mm² × 100m (preto)", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 1,5mm² × 100m (vermelho)", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo flexível 2,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 4mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 6mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo flexível 10mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo flexível 16mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo paralelo 2×1,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo paralelo 2×2,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo PP 3×2,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo coaxial × 100m", un: "rolos", marcas: ["Furukawa"], cat: "Elétrica" },
  { nome: "Cabo de rede UTP cat5e × 100m", un: "rolos", marcas: ["Furukawa", "Nexans"], cat: "Elétrica" },
  { nome: "Cabo de rede UTP cat6 × 100m", un: "rolos", marcas: ["Furukawa", "Nexans"], cat: "Elétrica" },

  // ═══ ELÉTRICA — DISJUNTORES ═══
  { nome: "Disjuntor monopolar 10A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck", "ABB"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 16A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck", "ABB"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 20A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 25A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 32A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 40A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 50A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 63A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor bipolar 25A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor bipolar 32A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor bipolar 40A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor tripolar 32A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor tripolar 50A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor tripolar 63A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor DR bipolar 25A 30mA", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor DR bipolar 40A 30mA", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "DPS 175V Classe II", un: "unidades", marcas: ["Schneider", "Siemens", "Clamper"], cat: "Elétrica" },
  { nome: "DPS 275V Classe II", un: "unidades", marcas: ["Schneider", "Clamper"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 6 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 12 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 18 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 24 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de medição padrão concessionária", un: "unidades", cat: "Elétrica" },

  // ═══ ELÉTRICA — TOMADAS / INTERRUPTORES ═══
  { nome: "Tomada 2P+T 10A (kit completo)", un: "unidades", marcas: ["Pial Legrand", "Steck", "Siemens"], cat: "Elétrica" },
  { nome: "Tomada 2P+T 20A (kit completo)", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Tomada dupla 2P+T", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Tomada externa IP44", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Tomada USB", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Tomada de telefone RJ-11", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Tomada de TV (coaxial)", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Interruptor simples 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor duplo 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor triplo 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor paralelo 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor intermediário 10A", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Interruptor com tomada", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Dimmer giratório", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },

  // ═══ ELÉTRICA — ILUMINAÇÃO ═══
  { nome: "Lâmpada LED 9W bivolt E27", un: "unidades", marcas: ["Philips", "Osram", "Empalux", "Avant"], cat: "Elétrica" },
  { nome: "Lâmpada LED 12W bivolt E27", un: "unidades", marcas: ["Philips", "Osram", "Empalux", "Avant"], cat: "Elétrica" },
  { nome: "Lâmpada LED 15W bivolt E27", un: "unidades", marcas: ["Philips", "Osram", "Empalux"], cat: "Elétrica" },
  { nome: "Lâmpada LED 20W bivolt E27", un: "unidades", marcas: ["Philips", "Osram"], cat: "Elétrica" },
  { nome: "Lâmpada LED 30W bivolt E27", un: "unidades", marcas: ["Philips", "Osram"], cat: "Elétrica" },
  { nome: "Refletor LED 30W bivolt", un: "unidades", marcas: ["Philips", "Empalux", "Avant"], cat: "Elétrica" },
  { nome: "Refletor LED 50W bivolt", un: "unidades", marcas: ["Philips", "Empalux"], cat: "Elétrica" },
  { nome: "Refletor LED 100W bivolt", un: "unidades", marcas: ["Philips", "Empalux"], cat: "Elétrica" },
  { nome: "Refletor LED 200W bivolt", un: "unidades", marcas: ["Philips", "Empalux"], cat: "Elétrica" },
  { nome: "Plafon redondo embutir", un: "unidades", cat: "Elétrica" },
  { nome: "Plafon quadrado embutir", un: "unidades", cat: "Elétrica" },
  { nome: "Spot embutir", un: "unidades", cat: "Elétrica" },
  { nome: "Pendente para cozinha", un: "unidades", cat: "Elétrica" },
  { nome: "Arandela parede", un: "unidades", cat: "Elétrica" },
  { nome: "Luminária de emergência LED", un: "unidades", marcas: ["Intelbras", "Segurimax"], cat: "Elétrica" },
  { nome: "Sensor de presença teto", un: "unidades", marcas: ["Intelbras", "Margirius"], cat: "Elétrica" },
  { nome: "Sensor de movimento parede", un: "unidades", marcas: ["Intelbras", "Margirius"], cat: "Elétrica" },
  { nome: "Foto-célula 1000W bivolt", un: "unidades", marcas: ["Margirius", "Exatron"], cat: "Elétrica" },

  // ═══ ELÉTRICA — DIVERSOS ═══
  { nome: "Fita isolante 19mm × 20m", un: "unidades", marcas: ["3M", "Pirelli"], cat: "Elétrica" },
  { nome: "Fita isolante alta tensão", un: "unidades", marcas: ["3M"], cat: "Elétrica" },
  { nome: "Fita autofusão 10m", un: "unidades", marcas: ["3M"], cat: "Elétrica" },
  { nome: "Abraçadeira nylon 100mm (pct 100)", un: "unidades", cat: "Elétrica" },
  { nome: "Abraçadeira nylon 200mm (pct 100)", un: "unidades", cat: "Elétrica" },
  { nome: "Abraçadeira nylon 300mm (pct 100)", un: "unidades", cat: "Elétrica" },
  { nome: "Bucha S6 (pct 100)", un: "unidades", marcas: ["Tigre", "Tramontina"], cat: "Elétrica" },
  { nome: "Bucha S8 (pct 100)", un: "unidades", marcas: ["Tigre", "Tramontina"], cat: "Elétrica" },
  { nome: "Bucha S10 (pct 100)", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },

  // ═══ DRENAGEM / PAVIMENTAÇÃO ═══
  { nome: "Manilha cerâmica Ø 200mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha cerâmica Ø 300mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha cerâmica Ø 400mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha cerâmica Ø 600mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 400mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 600mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 800mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 1000mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 1200mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 1500mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado PA-1 Ø 600mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado PA-2 Ø 800mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado PA-3 Ø 1000mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado Ø 1200mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado Ø 1500mm", un: "unidades", cat: "Drenagem" },
  { nome: "Boca de lobo simples", un: "unidades", cat: "Drenagem" },
  { nome: "Boca de lobo dupla", un: "unidades", cat: "Drenagem" },
  { nome: "Boca de leão", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de captação 60×60", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de captação 80×80", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de inspeção 60×60", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de inspeção 80×80", un: "unidades", cat: "Drenagem" },
  { nome: "Tampão de ferro fundido", un: "unidades", cat: "Drenagem" },
  { nome: "Grelha de ferro fundido", un: "unidades", cat: "Drenagem" },
  { nome: "Grelha pluvial concreto", un: "unidades", cat: "Drenagem" },

  // ═══ PAVIMENTAÇÃO ═══
  { nome: "Bloco intertravado 16 faces (paver)", un: "m²", marcas: ["Tatu", "Glasser"], cat: "Pavimentação" },
  { nome: "Bloco intertravado retangular", un: "m²", cat: "Pavimentação" },
  { nome: "Bloco intertravado raquete", un: "m²", cat: "Pavimentação" },
  { nome: "Bloco intertravado sextavado", un: "m²", cat: "Pavimentação" },
  { nome: "Paralelepípedo granito", un: "unidades", cat: "Pavimentação" },
  { nome: "Paralelepípedo basalto", un: "unidades", cat: "Pavimentação" },
  { nome: "Pedra portuguesa 5×5", un: "m²", cat: "Pavimentação" },
  { nome: "Pedra portuguesa 7×7", un: "m²", cat: "Pavimentação" },
  { nome: "Meio-fio comum 100×15×30", un: "unidades", cat: "Pavimentação" },
  { nome: "Meio-fio com sarjeta", un: "unidades", cat: "Pavimentação" },
  { nome: "Sarjeta de concreto pré-moldada", un: "unidades", cat: "Pavimentação" },
  { nome: "Guia rebaixada para acesso", un: "unidades", cat: "Pavimentação" },
  { nome: "Cordão de concreto", un: "unidades", cat: "Pavimentação" },
  { nome: "Asfalto CBUQ (massa quente)", un: "ton", cat: "Pavimentação" },
  { nome: "Massa asfáltica fria 20kg", un: "sacos", cat: "Pavimentação" },
  { nome: "Asfalto a frio 20L", un: "unidades", cat: "Pavimentação" },
  { nome: "Pintura de ligação RR-1C", un: "unidades", cat: "Pavimentação" },
  { nome: "Pintura de ligação CM-30", un: "unidades", cat: "Pavimentação" },
  { nome: "Emulsão asfáltica RR-1C", un: "unidades", cat: "Pavimentação" },
  { nome: "Emulsão asfáltica RR-2C", un: "unidades", cat: "Pavimentação" },
  { nome: "Bidim (geotêxtil)", un: "m²", marcas: ["Bidim"], cat: "Pavimentação" },
  { nome: "Geotêxtil não-tecido", un: "m²", cat: "Pavimentação" },
  { nome: "Geomembrana", un: "m²", cat: "Pavimentação" },
  { nome: "Manta asfáltica 4mm", un: "m²", marcas: ["Vedacit", "Denver", "Sika"], cat: "Pavimentação" },
  { nome: "Manta asfáltica 3mm", un: "m²", marcas: ["Vedacit", "Denver", "Sika"], cat: "Pavimentação" },
  { nome: "Geogrelha", un: "m²", cat: "Pavimentação" },
  { nome: "Tinta para sinalização viária", un: "unidades", cat: "Pavimentação" },
  { nome: "Termoplástico para pintura viária", un: "kg", cat: "Pavimentação" },
  { nome: "Tachão refletivo bidirecional", un: "unidades", cat: "Pavimentação" },
  { nome: "Tacha refletiva monodirecional", un: "unidades", cat: "Pavimentação" },

  // ═══ REVESTIMENTO ═══
  { nome: "Porcelanato 60×60 (m²)", un: "m²", marcas: ["Portobello", "Eliane", "Cecrisa", "Portinari"], cat: "Revestimento" },
  { nome: "Porcelanato 80×80 (m²)", un: "m²", marcas: ["Portobello", "Eliane", "Portinari"], cat: "Revestimento" },
  { nome: "Porcelanato retificado 90×90", un: "m²", marcas: ["Portobello", "Eliane"], cat: "Revestimento" },
  { nome: "Cerâmica 30×30 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Cerâmica 40×40 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Cerâmica 45×45 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane"], cat: "Revestimento" },
  { nome: "Cerâmica 60×60 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane"], cat: "Revestimento" },
  { nome: "Azulejo 20×20 (m²)", un: "m²", marcas: ["Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Azulejo 30×40 (m²)", un: "m²", marcas: ["Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Azulejo 30×60 (m²)", un: "m²", marcas: ["Eliane", "Incepa", "Portobello"], cat: "Revestimento" },
  { nome: "Pastilha de vidro (m²)", un: "m²", marcas: ["Atlas", "Vidrotil"], cat: "Revestimento" },
  { nome: "Piso vinílico (m²)", un: "m²", marcas: ["Tarkett", "Eucafloor"], cat: "Revestimento" },
  { nome: "Piso laminado (m²)", un: "m²", marcas: ["Eucafloor", "Quick Step"], cat: "Revestimento" },
  { nome: "Forro de PVC (m²)", un: "m²", marcas: ["Plasbil"], cat: "Revestimento" },
  { nome: "Forro de gesso (m²)", un: "m²", cat: "Revestimento" },
  { nome: "Drywall ST 1,80m × 1,20m × 12,5mm", un: "peças", marcas: ["Knauf", "Placo"], cat: "Revestimento" },
  { nome: "Drywall RU (resistente à umidade)", un: "peças", marcas: ["Knauf", "Placo"], cat: "Revestimento" },
  { nome: "Drywall RF (resistente ao fogo)", un: "peças", marcas: ["Knauf"], cat: "Revestimento" },
  { nome: "Perfil drywall montante", un: "barras", marcas: ["Knauf"], cat: "Revestimento" },
  { nome: "Massa drywall 20kg", un: "sacos", marcas: ["Knauf"], cat: "Revestimento" },
  { nome: "Soleira granito 0,15m", un: "unidades", cat: "Revestimento" },
  { nome: "Soleira mármore 0,15m", un: "unidades", cat: "Revestimento" },
  { nome: "Pingadeira", un: "unidades", cat: "Revestimento" },
  { nome: "Peitoril granito", un: "m²", cat: "Revestimento" },
  { nome: "Bancada granito (m²)", un: "m²", cat: "Revestimento" },
  { nome: "Bancada mármore (m²)", un: "m²", cat: "Revestimento" },

  // ═══ EPI ═══
  { nome: "Capacete branco com jugular CA", un: "unidades", marcas: ["3M", "MSA", "Plastcor"], cat: "EPI" },
  { nome: "Capacete amarelo CA", un: "unidades", marcas: ["3M", "MSA", "Plastcor"], cat: "EPI" },
  { nome: "Capacete azul CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Capacete vermelho CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Luva de raspa de couro CA", un: "unidades", marcas: ["Volk"], cat: "EPI" },
  { nome: "Luva nitrílica preta CA", un: "unidades", marcas: ["3M", "Volk"], cat: "EPI" },
  { nome: "Luva PVC cano longo CA", un: "unidades", marcas: ["Volk"], cat: "EPI" },
  { nome: "Luva latex pigmentada CA", un: "unidades", marcas: ["Volk"], cat: "EPI" },
  { nome: "Luva anticorte CA", un: "unidades", marcas: ["3M"], cat: "EPI" },
  { nome: "Bota de couro com bico de aço CA", un: "unidades", marcas: ["Marluvas", "Vulcabras"], cat: "EPI" },
  { nome: "Bota de borracha cano longo CA", un: "unidades", marcas: ["Marluvas", "Vulcabras"], cat: "EPI" },
  { nome: "Bota PVC cano curto CA", un: "unidades", marcas: ["Marluvas"], cat: "EPI" },
  { nome: "Óculos de proteção incolor CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Óculos de proteção fumê CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Protetor auricular plug CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Abafador de ruído CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Máscara PFF1 CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Máscara PFF2 CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Máscara descartável (pct)", un: "unidades", marcas: ["3M"], cat: "EPI" },
  { nome: "Máscara semifacial CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Cinto de segurança paraquedista CA", un: "unidades", marcas: ["3M Protecta", "MSA"], cat: "EPI" },

  // ═══ FERRAMENTAS ═══
  { nome: "Trena 5m", un: "unidades", marcas: ["Tramontina", "Vonder", "Stanley"], cat: "Ferramenta" },
  { nome: "Trena 7,5m", un: "unidades", marcas: ["Tramontina", "Vonder", "Stanley"], cat: "Ferramenta" },
  { nome: "Trena 10m", un: "unidades", marcas: ["Tramontina", "Vonder"], cat: "Ferramenta" },
  { nome: "Trena 30m fibra de vidro", un: "unidades", marcas: ["Vonder"], cat: "Ferramenta" },
  { nome: "Trena 50m fibra de vidro", un: "unidades", marcas: ["Vonder"], cat: "Ferramenta" },
  { nome: "Trena a laser 30m", un: "unidades", marcas: ["Bosch", "Vonder", "DeWalt"], cat: "Ferramenta" },
  { nome: "Esquadro de pedreiro", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Nível bolha 30cm", un: "unidades", marcas: ["Tramontina", "Vonder"], cat: "Ferramenta" },
  { nome: "Nível bolha 60cm", un: "unidades", marcas: ["Tramontina", "Vonder"], cat: "Ferramenta" },
  { nome: "Nível a laser linha", un: "unidades", marcas: ["Bosch", "Vonder", "DeWalt"], cat: "Ferramenta" },
  { nome: "Prumo de centro", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Martelo de unha 27mm", un: "unidades", marcas: ["Tramontina", "Vonder", "Stanley"], cat: "Ferramenta" },
  { nome: "Martelo de pedreiro 1kg", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Marreta 1kg cabo madeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Marreta 2kg cabo madeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Marreta 5kg cabo madeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Talhadeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Picareta com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Enxada com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Enxadão com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Pá quadrada com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Pá de bico com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Carrinho de mão 60L", un: "unidades", marcas: ["Tramontina", "Metasul"], cat: "Ferramenta" },
  { nome: "Carrinho de mão reforçado", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Caçamba metálica", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Colher de pedreiro 8\"", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Colher de pedreiro 10\"", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Desempenadeira de aço", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Desempenadeira de PVC", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Desempenadeira dentada", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Régua de alumínio 2m", un: "unidades", cat: "Ferramenta" },
  { nome: "Régua de alumínio 3m", un: "unidades", cat: "Ferramenta" },
  { nome: "Linha de pedreiro 100m", un: "unidades", cat: "Ferramenta" },
  { nome: "Bisnaga para rejunte", un: "unidades", cat: "Ferramenta" },

  // ═══ FERRAMENTAS ELÉTRICAS ═══
  { nome: "Furadeira de impacto 650W", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt", "Vonder"], cat: "Ferramenta" },
  { nome: "Parafusadeira 12V", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },
  { nome: "Esmerilhadeira angular 4 1/2", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt", "Vonder"], cat: "Ferramenta" },
  { nome: "Esmerilhadeira 7\"", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },
  { nome: "Serra circular 7 1/4", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },
  { nome: "Serra mármore 4 3/8", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Martelete rompedor 800W", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },

  // ═══ DISCOS / BROCAS / LÂMINAS ═══
  { nome: "Disco de corte 4 1/2 metal", un: "unidades", marcas: ["Norton", "Bosch", "3M"], cat: "Ferramenta" },
  { nome: "Disco de corte 7\" metal", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Disco diamantado 4 1/2", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Disco diamantado 7\"", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Disco de desbaste 4 1/2", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Broca para concreto 6mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para concreto 8mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para concreto 10mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para concreto 12mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para metal HSS 5mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para madeira 8mm", un: "unidades", marcas: ["Bosch"], cat: "Ferramenta" },
  { nome: "Lâmina de serra de mão", un: "unidades", marcas: ["Starrett", "Bosch"], cat: "Ferramenta" },

  // ═══ FIXAÇÃO ═══
  { nome: "Parafuso autobrocante 4,2×13mm (cx 100)", un: "unidades", cat: "Fixação" },
  { nome: "Parafuso para madeira 3×30mm (cx 100)", un: "unidades", cat: "Fixação" },
  { nome: "Parafuso para drywall 25mm (cx 100)", un: "unidades", cat: "Fixação" },
  { nome: "Prego 17×21 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 17×27 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 18×30 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 19×36 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 20×42 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 22×48 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego sem cabeça 17×24 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Pino de aço para fixação", un: "unidades", cat: "Fixação" },

  // ═══ DIVERSOS ═══
  { nome: "Saco de cimento vazio", un: "unidades", cat: "Diversos" },
  { nome: "Saco de ráfia", un: "unidades", cat: "Diversos" },
  { nome: "Saco de lixo industrial 100L (pct)", un: "unidades", cat: "Diversos" },
  { nome: "Lona plástica preta 4×100m", un: "rolos", cat: "Diversos" },
  { nome: "Lona plástica branca 4×100m", un: "rolos", cat: "Diversos" },
  { nome: "Lona azul reforçada", un: "m²", cat: "Diversos" },
  { nome: "Tela mosquiteiro fibra", un: "m²", cat: "Diversos" },
  { nome: "Tela de proteção fachada", un: "m²", cat: "Diversos" },
  { nome: "Andaime metálico tubular 1×1m", un: "unidades", marcas: ["Mills", "Megalux"], cat: "Diversos" },
  { nome: "Andaime fachadeiro multidirecional", un: "unidades", marcas: ["Mills"], cat: "Diversos" },
  { nome: "Plataforma metálica", un: "unidades", cat: "Diversos" },
  { nome: "Cola branca PVA 1kg", un: "unidades", marcas: ["Cascola", "Tekbond"], cat: "Diversos" },
  { nome: "Cola de contato 750g", un: "unidades", marcas: ["Cascola", "Tekbond"], cat: "Diversos" },
  { nome: "Cola epóxi 12g (par)", un: "unidades", marcas: ["Tekbond", "Loctite"], cat: "Diversos" },
  { nome: "Massa epóxi 100g", un: "unidades", marcas: ["Tekbond"], cat: "Diversos" },
  { nome: "Selante PU (cartucho 310ml)", un: "unidades", marcas: ["Sika", "Vedacit"], cat: "Diversos" },
  { nome: "Selante silicone neutro 280g", un: "unidades", marcas: ["Sika", "Tekbond"], cat: "Diversos" },
  { nome: "Espuma de poliuretano expansiva 750ml", un: "unidades", marcas: ["Sika", "Soudal"], cat: "Diversos" },
  { nome: "Manta isolante térmica subcobertura", un: "m²", cat: "Diversos" },
  { nome: "Lã de rocha 50mm", un: "m²", marcas: ["Rockfibras", "Isover"], cat: "Diversos" },
  { nome: "Lã de vidro 50mm", un: "m²", marcas: ["Isover"], cat: "Diversos" },
  { nome: "Isopor 50mm placa", un: "peças", cat: "Diversos" },
  { nome: "Placa OSB 11,1mm × 1,22×2,44m", un: "peças", marcas: ["LP Building"], cat: "Diversos" },

  // ═══ FÔRMAS ═══
  { nome: "Tábua para fôrma de pinus", un: "peças", cat: "Fôrma" },
  { nome: "Sarrafo para escoramento", un: "peças", cat: "Fôrma" },
  { nome: "Pino metálico para fôrma", un: "unidades", cat: "Fôrma" },
  { nome: "Tirante para fôrma", un: "unidades", cat: "Fôrma" },
  { nome: "Cone para fôrma", un: "unidades", cat: "Fôrma" },
  { nome: "Espaçador plástico para concreto", un: "unidades", cat: "Fôrma" },
  { nome: "Pontalete metálico ajustável", un: "unidades", marcas: ["Mills"], cat: "Fôrma" },
];

// Lista plana só com nomes — pra busca textual
export const MATERIAIS_BANCO = MATERIAIS_BANCO_DETALHADO.map(m => m.nome);
export const MATERIAIS = MATERIAIS_BANCO; // mantém compatibilidade

/* ════════════════════════════════════════════════════
   CATÁLOGO PROFISSIONAL — FROTA / ATIVOS
   Máquinas pesadas, veículos, equipamentos motorizados
══════════════════════════════════════════════════════ */
export const CATALOGO_FROTA = [
  // 🚚 CAMINHÕES
  { nome: "Caminhão Basculante 6m³", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 3.5, valorHora: 150 },
  { nome: "Caminhão Basculante 10m³", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 2.8, valorHora: 180 },
  { nome: "Caminhão Basculante 12m³", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 2.5, valorHora: 200 },
  { nome: "Caminhão Carroceria 4 ton", tipo: "Caminhão", icon: "🚛", combustivel: "Diesel", consumoMedio: 5, valorHora: 120 },
  { nome: "Caminhão Carroceria 8 ton", tipo: "Caminhão", icon: "🚛", combustivel: "Diesel", consumoMedio: 4, valorHora: 140 },
  { nome: "Caminhão Munck 6 ton", tipo: "Caminhão", icon: "🏗️", combustivel: "Diesel", consumoMedio: 3.5, valorHora: 180 },
  { nome: "Caminhão Munck 10 ton", tipo: "Caminhão", icon: "🏗️", combustivel: "Diesel", consumoMedio: 3, valorHora: 220 },
  { nome: "Caminhão Pipa 8.000L", tipo: "Caminhão", icon: "💧", combustivel: "Diesel", consumoMedio: 3.5, valorHora: 160 },
  { nome: "Caminhão Pipa 10.000L", tipo: "Caminhão", icon: "💧", combustivel: "Diesel", consumoMedio: 3, valorHora: 180 },
  { nome: "Caminhão Pipa 15.000L", tipo: "Caminhão", icon: "💧", combustivel: "Diesel", consumoMedio: 2.5, valorHora: 220 },
  { nome: "Caminhão Betoneira 8m³", tipo: "Caminhão", icon: "🚧", combustivel: "Diesel", consumoMedio: 2.5, valorHora: 250 },
  { nome: "Caminhão de Combustível", tipo: "Caminhão", icon: "⛽", combustivel: "Diesel", consumoMedio: 4, valorHora: 180 },
  { nome: "Caminhão Plataforma", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 4, valorHora: 150 },
  { nome: "Caminhão Toco", tipo: "Caminhão", icon: "🚛", combustivel: "Diesel", consumoMedio: 5, valorHora: 110 },
  { nome: "Caminhão Truck", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 3, valorHora: 170 },

  // 🚜 MÁQUINAS PESADAS
  { nome: "Retroescavadeira", tipo: "Retroescavadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 8, valorHora: 130 },
  { nome: "Retroescavadeira 4x4", tipo: "Retroescavadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 9, valorHora: 150 },
  { nome: "Escavadeira Hidráulica 14 ton", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 14, valorHora: 180 },
  { nome: "Escavadeira Hidráulica 20 ton", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 18, valorHora: 220 },
  { nome: "Escavadeira Hidráulica 30 ton", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 25, valorHora: 280 },
  { nome: "Mini Escavadeira", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 5, valorHora: 110 },
  { nome: "Pá Carregadeira", tipo: "Pá Carregadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 12, valorHora: 160 },
  { nome: "Pá Carregadeira Compacta (Bobcat)", tipo: "Mini Carregadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 6, valorHora: 120 },
  { nome: "Motoniveladora (Patrol)", tipo: "Motoniveladora", icon: "🚜", combustivel: "Diesel", consumoMedio: 15, valorHora: 200 },
  { nome: "Rolo Compactador Vibratório", tipo: "Rolo", icon: "🚧", combustivel: "Diesel", consumoMedio: 8, valorHora: 140 },
  { nome: "Rolo Compactador Pé de Carneiro", tipo: "Rolo", icon: "🚧", combustivel: "Diesel", consumoMedio: 9, valorHora: 150 },
  { nome: "Rolo Compactador Pneu", tipo: "Rolo", icon: "🚧", combustivel: "Diesel", consumoMedio: 7, valorHora: 130 },
  { nome: "Trator de Esteira", tipo: "Trator", icon: "🚜", combustivel: "Diesel", consumoMedio: 18, valorHora: 220 },
  { nome: "Trator Agrícola", tipo: "Trator", icon: "🚜", combustivel: "Diesel", consumoMedio: 8, valorHora: 100 },
  { nome: "Empilhadeira Diesel", tipo: "Empilhadeira", icon: "🏗️", combustivel: "Diesel", consumoMedio: 4, valorHora: 80 },
  { nome: "Empilhadeira Elétrica", tipo: "Empilhadeira", icon: "🏗️", combustivel: "Elétrico", consumoMedio: 0, valorHora: 70 },

  // 🏗️ EQUIPAMENTOS ESPECIAIS
  { nome: "Grua / Guindaste", tipo: "Grua", icon: "🏗️", combustivel: "Diesel", consumoMedio: 8, valorHora: 280 },
  { nome: "Plataforma Elevatória Tesoura", tipo: "Plataforma", icon: "🏗️", combustivel: "Elétrico", consumoMedio: 0, valorHora: 100 },
  { nome: "Plataforma Elevatória Articulada", tipo: "Plataforma", icon: "🏗️", combustivel: "Diesel", consumoMedio: 4, valorHora: 130 },
  { nome: "Usina de Asfalto Portátil", tipo: "Usina", icon: "🏗️", combustivel: "Diesel", consumoMedio: 20, valorHora: 400 },
  { nome: "Acabadora de Asfalto", tipo: "Acabadora", icon: "🚧", combustivel: "Diesel", consumoMedio: 14, valorHora: 250 },
  { nome: "Espargidor de Asfalto", tipo: "Espargidor", icon: "🚧", combustivel: "Diesel", consumoMedio: 6, valorHora: 140 },
  { nome: "Compressor Diesel Móvel", tipo: "Compressor", icon: "💨", combustivel: "Diesel", consumoMedio: 4, valorHora: 80 },
  { nome: "Gerador Diesel 50 KVA", tipo: "Gerador", icon: "⚡", combustivel: "Diesel", consumoMedio: 6, valorHora: 90 },
  { nome: "Gerador Diesel 150 KVA", tipo: "Gerador", icon: "⚡", combustivel: "Diesel", consumoMedio: 15, valorHora: 150 },

  // 🚗 VEÍCULOS LEVES
  { nome: "Carro / Veículo de Apoio", tipo: "Carro", icon: "🚗", combustivel: "Gasolina", consumoMedio: 10, valorHora: 0 },
  { nome: "Caminhonete (Pick-up)", tipo: "Caminhonete", icon: "🛻", combustivel: "Diesel", consumoMedio: 8, valorHora: 0 },
  { nome: "Van / Furgão", tipo: "Van", icon: "🚐", combustivel: "Diesel", consumoMedio: 9, valorHora: 0 },
  { nome: "Moto / Motocicleta", tipo: "Moto", icon: "🏍️", combustivel: "Gasolina", consumoMedio: 35, valorHora: 0 },
];

export const CATALOGO_FROTA_NOMES = CATALOGO_FROTA.map(f => f.nome);

/* ════════════════════════════════════════════════════
   CATÁLOGO PROFISSIONAL — EQUIPAMENTOS
   Ferramentas e equipamentos menores de obra
══════════════════════════════════════════════════════ */
export const CATALOGO_EQUIPAMENTOS = [
  // 🔄 CONCRETAGEM
  { nome: "Betoneira 150L", icon: "🔄", valorAprox: 1800 },
  { nome: "Betoneira 250L", icon: "🔄", valorAprox: 2200 },
  { nome: "Betoneira 400L", icon: "🔄", valorAprox: 2500 },
  { nome: "Betoneira 600L", icon: "🔄", valorAprox: 3200 },
  { nome: "Vibrador de Concreto Elétrico", icon: "⚙️", valorAprox: 1800 },
  { nome: "Vibrador de Concreto Gasolina", icon: "⚙️", valorAprox: 2500 },
  { nome: "Régua Vibratória", icon: "🔄", valorAprox: 2200 },
  { nome: "Acabadora de Concreto (Helicóptero)", icon: "⚙️", valorAprox: 4500 },
  { nome: "Bomba de Concreto Manual", icon: "🔧", valorAprox: 1200 },

  // 🛠️ DEMOLIÇÃO E PERFURAÇÃO
  { nome: "Martelete / Rompedor Elétrico", icon: "🔨", valorAprox: 1200 },
  { nome: "Martelete Pneumático", icon: "🔨", valorAprox: 1800 },
  { nome: "Marreta Demolidora", icon: "🔨", valorAprox: 850 },
  { nome: "Furadeira de Impacto", icon: "🔧", valorAprox: 400 },
  { nome: "Furadeira Industrial", icon: "🔧", valorAprox: 850 },
  { nome: "Parafusadeira", icon: "🔧", valorAprox: 350 },
  { nome: "Perfuratriz", icon: "🔧", valorAprox: 2500 },

  // 🪚 CORTE E DESBASTE
  { nome: "Serra Circular", icon: "⚙️", valorAprox: 600 },
  { nome: "Serra Mármore", icon: "⚙️", valorAprox: 700 },
  { nome: "Serra Tico-tico", icon: "⚙️", valorAprox: 400 },
  { nome: "Serra de Bancada", icon: "⚙️", valorAprox: 1500 },
  { nome: "Serra Policorte", icon: "⚙️", valorAprox: 1200 },
  { nome: "Esmerilhadeira Angular", icon: "⚙️", valorAprox: 350 },
  { nome: "Esmerilhadeira Grande", icon: "⚙️", valorAprox: 650 },
  { nome: "Lixadeira Orbital", icon: "🛠️", valorAprox: 450 },
  { nome: "Lixadeira de Parede", icon: "🛠️", valorAprox: 850 },
  { nome: "Lixadeira de Cinta", icon: "🛠️", valorAprox: 600 },
  { nome: "Plaina Elétrica", icon: "🛠️", valorAprox: 550 },

  // 🚧 COMPACTAÇÃO
  { nome: "Compactador de Placa (Sapinho)", icon: "🛠️", valorAprox: 5000 },
  { nome: "Compactador Tipo Sapo", icon: "🛠️", valorAprox: 5500 },
  { nome: "Mini Rolo Compactador", icon: "🚧", valorAprox: 8000 },
  { nome: "Soquete Pneumático", icon: "🔨", valorAprox: 1500 },

  // ⚡ ELÉTRICOS E PNEUMÁTICOS
  { nome: "Gerador Gasolina 2,5 KVA", icon: "⚡", valorAprox: 2000 },
  { nome: "Gerador Gasolina 5 KVA", icon: "⚡", valorAprox: 3500 },
  { nome: "Gerador Diesel 10 KVA", icon: "⚡", valorAprox: 12000 },
  { nome: "Compressor de Ar 10pcm", icon: "💨", valorAprox: 2500 },
  { nome: "Compressor de Ar 20pcm", icon: "💨", valorAprox: 4500 },
  { nome: "Soldadora Inversora", icon: "⚡", valorAprox: 1500 },
  { nome: "Soldadora a Diesel", icon: "⚡", valorAprox: 8000 },
  { nome: "Transformador 220/110V", icon: "⚡", valorAprox: 800 },

  // 💧 BOMBAS E ÁGUA
  { nome: "Bomba Submersa Pequena", icon: "💧", valorAprox: 850 },
  { nome: "Bomba Submersa Grande", icon: "💧", valorAprox: 2200 },
  { nome: "Motobomba Centrífuga", icon: "💧", valorAprox: 1200 },
  { nome: "Motobomba de Lama", icon: "💧", valorAprox: 2800 },
  { nome: "Bomba Recalque", icon: "💧", valorAprox: 1500 },
  { nome: "Lavadora de Alta Pressão", icon: "💧", valorAprox: 1800 },

  // 📏 MEDIÇÃO
  { nome: "Trena Laser", icon: "📏", valorAprox: 350 },
  { nome: "Nível a Laser", icon: "📏", valorAprox: 800 },
  { nome: "Nível de Mangueira", icon: "📏", valorAprox: 80 },
  { nome: "Esquadro Magnético", icon: "📏", valorAprox: 120 },
  { nome: "Teodolito", icon: "📏", valorAprox: 6500 },
  { nome: "Estação Total", icon: "📏", valorAprox: 25000 },
  { nome: "Nível Óptico", icon: "📏", valorAprox: 2200 },
  { nome: "GPS Topográfico", icon: "📏", valorAprox: 18000 },

  // 🏗️ ANDAIMES E ESTRUTURAS
  { nome: "Andaime Tubular (módulo)", icon: "🏗️", valorAprox: 280 },
  { nome: "Andaime Fachadeiro (módulo)", icon: "🏗️", valorAprox: 350 },
  { nome: "Andaime Multidirecional (módulo)", icon: "🏗️", valorAprox: 450 },
  { nome: "Escora Metálica Regulável", icon: "🏗️", valorAprox: 85 },
  { nome: "Escora Metálica Tubular", icon: "🏗️", valorAprox: 120 },
  { nome: "Escada Extensível Alumínio", icon: "🪜", valorAprox: 600 },
  { nome: "Escada Industrial 13 degraus", icon: "🪜", valorAprox: 350 },

  // 🛒 TRANSPORTE
  { nome: "Carrinho de Mão", icon: "🛒", valorAprox: 180 },
  { nome: "Carrinho Plataforma", icon: "🛒", valorAprox: 280 },
  { nome: "Carrinho Hidráulico (Paleteira)", icon: "🛒", valorAprox: 1500 },
  { nome: "Padiola", icon: "🛒", valorAprox: 60 },
  { nome: "Giricos / Caçamba Plástica", icon: "🛒", valorAprox: 120 },

  // 🔧 FERRAMENTAS MANUAIS
  { nome: "Pá Quadrada", icon: "🔧", valorAprox: 35 },
  { nome: "Pá Curva (de bico)", icon: "🔧", valorAprox: 35 },
  { nome: "Enxada", icon: "🔧", valorAprox: 30 },
  { nome: "Picareta", icon: "🔧", valorAprox: 45 },
  { nome: "Marreta", icon: "🔧", valorAprox: 40 },
  { nome: "Chave de Fenda Industrial", icon: "🔧", valorAprox: 35 },
  { nome: "Alicate Industrial", icon: "🔧", valorAprox: 50 },
  { nome: "Jogo de Chaves Combinadas", icon: "🔧", valorAprox: 180 },

  // 🛡️ EPIs E SEGURANÇA
  { nome: "Capacete Aba Frontal", icon: "🛡️", valorAprox: 25 },
  { nome: "Capacete com Jugular", icon: "🛡️", valorAprox: 35 },
  { nome: "Cinto Paraquedista", icon: "🛡️", valorAprox: 280 },
  { nome: "Talabarte Y", icon: "🛡️", valorAprox: 180 },
  { nome: "Linha de Vida", icon: "🛡️", valorAprox: 350 },
  { nome: "Cone Sinalização 75cm", icon: "🛡️", valorAprox: 35 },
  { nome: "Cone Sinalização 100cm", icon: "🛡️", valorAprox: 55 },
  { nome: "Tela de Sinalização (m)", icon: "🛡️", valorAprox: 8 },
  { nome: "Fita Zebrada (rolo)", icon: "🛡️", valorAprox: 25 },

  // 💡 ILUMINAÇÃO
  { nome: "Refletor LED Obra 50W", icon: "💡", valorAprox: 120 },
  { nome: "Refletor LED Obra 100W", icon: "💡", valorAprox: 200 },
  { nome: "Refletor LED Obra 200W", icon: "💡", valorAprox: 380 },
  { nome: "Holofote (Balizador)", icon: "💡", valorAprox: 850 },
  { nome: "Lâmpada Portátil c/ Gancho", icon: "💡", valorAprox: 65 },

  // 🧰 OUTROS
  { nome: "Caixa Ferramenta Profissional", icon: "🧰", valorAprox: 280 },
  { nome: "Bancada de Marceneiro", icon: "🪚", valorAprox: 1200 },
  { nome: "Cavalete de Apoio", icon: "🪚", valorAprox: 180 },
  { nome: "Container 6 metros", icon: "📦", valorAprox: 8500 },
  { nome: "Container 12 metros", icon: "📦", valorAprox: 15000 },
];

export const CATALOGO_EQUIPAMENTOS_NOMES = CATALOGO_EQUIPAMENTOS.map(e => e.nome);
// Acesso rápido por nome -> objeto detalhado
export const MATERIAL_INFO = {};
MATERIAIS_BANCO_DETALHADO.forEach(m => { MATERIAL_INFO[m.nome] = m; });
export const EQUIP_COLOR = { "Em Uso": BLUE, "Quebrada": RED, "Disponível": GREEN };
export const STATUS_COLOR = { "Presente": GREEN, "Falta": RED, "Atestado": ORANGE };

export const DEFAULT_USUARIOS = [
  { id: 1, nome: "Kleber Vieira Martins", email: "kleber@km.com",   senha: "123", pin: "", biometriaAtiva: false, perfil: "gestor",      obraId: null, tel: "(28) 99925-8172" },
];

export const EMPRESA_PADRAO = {
  razaoSocial: "KM CONSULTORIA, ASSESSORIA E SERVICOS DE ENGENHARIA LTDA",
  nomeFantasia: "KM SERVICOS",
  cnpj: "60.368.233/0001-73",
  inscEstadual: "",
  porte: "ME",
  natureza: "Sociedade Empresária Limitada",
  atividadePrincipal: "71.12-0-00 - Serviços de engenharia",
  dataAbertura: "11/04/2025",
  responsavel: "Kleber Vieira Martins",
  email: "kvmprojetos@gmail.com",
  telefone: "(28) 99925-8172",
  registro: "CREA-ES",
  // Endereço completo
  logradouro: "R Pastor da Silva Colares",
  numero: "148",
  complemento: "",
  bairro: "Guararema",
  cidade: "Alegre",
  uf: "ES",
  cep: "29.500-000",
  endereco: "R Pastor da Silva Colares, 148 - Guararema, Alegre - ES, 29.500-000",
  instagram: "km_engenharias",
  // Alimentação (valores configuráveis)
  valorCafeManha: 13,
  valorCafeTarde: 0,
  valorMarmita: 18,
  valorLanche: 0,
};

// Funcionários do escritório (custo INDIRETO, rateado entre obras ativas)
export const DEFAULT_FUNC_ESCRITORIO = [
  { id: 1, nome: "Mozart", cargo: "Engenheiro Orçamentista", salarioMensal: 0, ativo: true, dataAdmissao: "" },
];

export const DEFAULT_ATIVOS = [
  // Retroescavadeiras
  { id: 1, tipo: "Retroescavadeira", nome: "Retroescavadeira 01", placa: "", marca: "", modelo: "", ano: "", obraId: 1, horimetro: 0, valorHora: 80, responsavel: "Geovane", combustivel: "Diesel", consumoMedio: 8, status: "Ativo" },

  // Carro do Kleber (placeholder pra ser editado)
  { id: 2, tipo: "Carro", nome: "Carro do Kleber", placa: "", marca: "", modelo: "", ano: "", cor: "", obraId: null, km: 0, valorHora: 0, responsavel: "Kleber Vieira Martins", combustivel: "Gasolina", consumoMedio: 10, status: "Ativo" },
];

// Valores-hora por cargo (R$/h) para apropriação de custo
export const VALOR_HORA_CARGO = {
  "Pedreiro": 18, "Armador": 16, "Servente": 12, "Auxiliar": 12,
  "Eletricista": 22, "Encanador": 22, "Pintor": 16,
  "Mestre de Obras": 30, "Encarregado": 28, "Encarregado / Operador Retroescavadeira": 32,
  "Operador de Máquina": 25, "Carpinteiro": 18, "Azulejista": 20,
  "Motorista": 18, "Vigia": 12,
};

/* ── SHARED STYLES ── */
