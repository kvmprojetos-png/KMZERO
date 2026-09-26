/* ═══ Códigos (ids) no KMZERO ═══
   Obras, trabalhadores, máquinas etc. nascem com código numérico (Date.now()), mas:
   - um <select> sempre devolve TEXTO ("1727312345678");
   - dados antigos, importados ou vindos da nuvem podem ter o mesmo código como texto;
   - códigos gerados por outros meios podem ser texto de verdade ("abc123").
   Comparar com === entre número e texto dá falso e o registro some do filtro sem aviso.
   Regra do app: TODA comparação de código passa por mesmoId, e TODA gravação por normId. */

/* Código canônico: número quando o texto é um inteiro seguro; texto quando não é; null quando vazio.
   Só vira número o texto que é a forma canônica do inteiro ("123" → 123). Formas com zero à esquerda
   ("007") ou "-0" continuam texto: convertê-las mudaria String(código) e mesmoId deixaria de achar o registro. */
export function normId(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "") return null;
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    return Number.isSafeInteger(n) && String(n) === s ? n : s;
  }
  return s;
}

/* Mesmo código? Vazio (null/undefined/"") nunca é igual a nada — para "sem obra" teste o vazio explicitamente. */
export function mesmoId(a, b) {
  if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") return false;
  return String(a) === String(b);
}

/* Filtro de lista por um campo de código: porId(lista, "obraId", obraSel) */
export const porId = (lista, campo, id) => (Array.isArray(lista) ? lista : []).filter(x => x && mesmoId(x[campo], id));

/* Acha pelo código: acharPorId(obras, obraId) */
export const acharPorId = (lista, id, campo = "id") => (Array.isArray(lista) ? lista : []).find(x => x && mesmoId(x[campo], id));

/* Campos de código de cada coleção, levantados de como as telas gravam cada registro
   (src/screens/*.jsx, src/KMZeroApp.jsx e o gerador da demo em src/data/catalogos.js).
   Só campos no 1º nível do registro; códigos dentro de listas internas (ex.: itens[].trabId
   da folha salva) e chaves de objeto (presencas[trabId], horimetros[ativoId]) ficam de fora. */
export const CAMPOS_ID_COLECAO = Object.freeze({
  obras:           ["id", "clienteId", "apontadorId"],       // apontadorId → usuarios.id
  trabalhadores:   ["id", "obraId"],
  equips:          ["id", "obraId"],
  pedidos:         ["id", "obraId", "fornecedorId"],
  rdos:            ["id", "obraId"],
  rdosEmitidos:    ["id", "obraId"],                         // mesmo conteúdo de "rdos" (nome do estado e do backup)
  fotosObras:      ["id", "obraId"],
  diario:          ["id", "obraId"],
  abastecimentos:  ["id", "ativoId", "obraId"],
  despesasAvulsas: ["id", "obraId"],
  produtividade:   ["id", "obraId"],
  adiantamentos:   ["id", "trabId", "folhaId"],              // folhaId → folhasSalvas.id (vale já descontado)
  ativos:          ["id", "obraId"],
  recebimentos:    ["id", "obraId", "pedidoId"],
  movimentacoes:   ["id", "trabId", "obraOrigem", "obraDestino"],
  movEquip:        ["id", "itemId", "obraOrigemId", "obraDestinoId"], // itemId → equips/ativos/ferramentas (conforme tipoItem)
  manutencoes:     ["id", "itemId", "obraId"],               // itemId → ativos/equips/ferramentas (conforme tipoItem)
  ferias:          ["id", "trabId"],
  ferramentas:     ["id", "obraId"],
  folhasSalvas:    ["id", "obraId"],
  usuarios:        ["obraId"],                               // id é o uid do login (texto): não mexe
  clientes:        ["id"],
  fornecedores:    ["id"],
});

/* Texto que é a forma canônica de um inteiro seguro vira número; qualquer outro valor fica como está. */
function idCanonico(v) {
  if (typeof v !== "string") return v;
  const n = normId(v);
  return typeof n === "number" && String(n) === v ? n : v;
}

/* normalizarColecao("trabalhadores", lista) → lista com os campos de código (CAMPOS_ID_COLECAO) canônicos.
   - só troca texto numérico canônico por número ("1727312345678" → 1727312345678): String(código) não muda,
     então nenhuma relação de mesmoId muda;
   - não cria campo que não existia, não troca a ordem, não remove registros;
   - preserva valores não numéricos ("abc123", "", null, objetos) exatamente como estão;
   - idempotente; devolve a MESMA lista (e os mesmos objetos) quando nada muda;
   - coleção desconhecida ou lista que não é array: devolve o que recebeu. */
export function normalizarColecao(nome, lista) {
  const campos = Object.prototype.hasOwnProperty.call(CAMPOS_ID_COLECAO, nome) ? CAMPOS_ID_COLECAO[nome] : null;
  if (!campos || !Array.isArray(lista)) return lista;
  let mudou = false;
  const nova = lista.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    let copia = null;
    for (const campo of campos) {
      if (!Object.prototype.hasOwnProperty.call(item, campo)) continue;
      const v = item[campo];
      const n = idCanonico(v);
      if (Object.is(n, v)) continue;
      if (!copia) copia = { ...item };
      copia[campo] = n;
    }
    if (!copia) return item;
    mudou = true;
    return copia;
  });
  return mudou ? nova : lista;
}
