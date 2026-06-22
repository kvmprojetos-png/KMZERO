export const hojeStr = () => new Date().toISOString().split("T")[0]; // YYYY-MM-DD
export const fmtData = (iso) => { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
export const ultimosDias = (n) => {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    arr.push(d.toISOString().split("T")[0]);
  }
  return arr;
};

/* ── PALETTE ── */

export function dataPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

export function feriadosDoAno(ano) {
  const pascoa = dataPascoa(ano);
  // Carnaval = 47 dias antes da Páscoa
  const carnavalSeg = new Date(pascoa); carnavalSeg.setDate(carnavalSeg.getDate() - 48);
  const carnavalTer = new Date(pascoa); carnavalTer.setDate(carnavalTer.getDate() - 47);
  // Sexta-feira Santa = 2 dias antes da Páscoa
  const sextaSanta = new Date(pascoa); sextaSanta.setDate(sextaSanta.getDate() - 2);
  // Corpus Christi = 60 dias após Páscoa
  const corpusChristi = new Date(pascoa); corpusChristi.setDate(corpusChristi.getDate() + 60);

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    [`${ano}-01-01`]: { nome: "Confraternização Universal", tipo: "nacional", emoji: "🎉" },
    [iso(carnavalSeg)]: { nome: "Carnaval (Segunda)", tipo: "facultativo", emoji: "🎭" },
    [iso(carnavalTer)]: { nome: "Carnaval (Terça)", tipo: "facultativo", emoji: "🎭" },
    [iso(sextaSanta)]: { nome: "Sexta-feira Santa", tipo: "nacional", emoji: "✝️" },
    [iso(pascoa)]: { nome: "Páscoa", tipo: "nacional", emoji: "🥚" },
    [`${ano}-04-21`]: { nome: "Tiradentes", tipo: "nacional", emoji: "⚒️" },
    [`${ano}-05-01`]: { nome: "Dia do Trabalho", tipo: "nacional", emoji: "👷" },
    [iso(corpusChristi)]: { nome: "Corpus Christi", tipo: "facultativo", emoji: "🍞" },
    [`${ano}-09-07`]: { nome: "Independência do Brasil", tipo: "nacional", emoji: "🇧🇷" },
    [`${ano}-10-12`]: { nome: "Nossa Senhora Aparecida", tipo: "nacional", emoji: "🙏" },
    [`${ano}-11-02`]: { nome: "Finados", tipo: "nacional", emoji: "🕯️" },
    [`${ano}-11-15`]: { nome: "Proclamação da República", tipo: "nacional", emoji: "🇧🇷" },
    [`${ano}-11-20`]: { nome: "Consciência Negra", tipo: "nacional", emoji: "✊🏿" },
    [`${ano}-12-25`]: { nome: "Natal", tipo: "nacional", emoji: "🎄" },
  };
}

// Cache de feriados por ano para evitar recalcular
export const _cacheFeriados = {};
export function feriadoEm(dataISO) {
  // dataISO: "YYYY-MM-DD"
  if (!dataISO || !dataISO.includes("-")) return null;
  const ano = parseInt(dataISO.split("-")[0]);
  if (isNaN(ano)) return null;
  if (!_cacheFeriados[ano]) _cacheFeriados[ano] = feriadosDoAno(ano);
  return _cacheFeriados[ano][dataISO] || null;
}

/* ── STORAGE ── */
