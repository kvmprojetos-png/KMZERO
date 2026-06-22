import { carimbarFoto } from "./suprimentos.jsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { loginFirebase, logoutFirebase, observarAutenticacao, recuperarSenha, atualizarSenha, usuarioAtual } from "../firebase.js";
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css } from "../theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm } from "../utils.js";
import { EMPRESA_ID, cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, store } from "../lib/store.js";
import { FILE_DB_NAME, FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "../lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "../lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, DEFAULT_USUARIOS, EMPRESA_PADRAO, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "../data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura } from "../components/ui.jsx";

export function FluxoEncarregado({ obra, trabalhadores, equips, ativos, abastecimentos, pedidos, diario, usuario, empresa, historico, rdosEmitidos, fotosObras = [], onBack, onSavePresencas, onAutoEmitirRDO, onSalvarFotoObra }) {
  const [etapa, setEtapa] = useState(0);
  const [presencas, setPresencas] = useState(() => {
    const m = {}; trabalhadores.forEach(t => { m[t.id] = "Presente"; }); return m;
  });
  // horas trabalhadas: { trabId: 9 }  (padrão 9h: 7-11h + 12-17h, sex 8h)
  const [horasTrabalhadas, setHorasTrabalhadas] = useState(() => {
    const m = {};
    const eSexta = new Date().getDay() === 5;
    const padrao = eSexta ? 8 : 9; // sexta termina às 16h
    trabalhadores.forEach(t => { m[t.id] = padrao; });
    return m;
  });
  const [editandoHoras, setEditandoHoras] = useState(null); // trabId em edição

  // ALIMENTAÇÃO: por padrão, todo presente recebe café manhã + café tarde
  const [alimentacao, setAlimentacao] = useState(() => {
    const m = {};
    trabalhadores.forEach(t => {
      m[t.id] = { cafeManha: true, cafeTarde: true, marmita: false, lanche: false };
    });
    return m;
  });

  const [fotos, setFotos] = useState([]);
  const [equipsLocal, setEquipsLocal] = useState(equips.filter(e => e.obraId === obra.id));
  const [confirmando, setConfirmando] = useState(false);
  const [localizacao, setLocalizacao] = useState(null);
  const [pegandoLoc, setPegandoLoc] = useState(false);

  // Horímetro das máquinas (início/fim)
  const ativosObra = (ativos || []).filter(a => a.obraId === obra.id);
  const [horimetros, setHorimetros] = useState(() => {
    const m = {};
    ativosObra.forEach(a => { m[a.id] = { inicio: a.horimetro || "", fim: "" }; });
    return m;
  });

  const ICONS = ["🏗️", "🧱", "🔨", "⚙️", "💡"];
  const ciclo = { "Em Uso": "Disponível", "Disponível": "Em Uso", "Quebrada": "Disponível" };
  const presentes = Object.values(presencas).filter(v => v === "Presente").length;
  const faltas = Object.values(presencas).filter(v => v === "Falta").length;

  const pegarLocalizacao = () => {
    setPegandoLoc(true);
    if (!navigator.geolocation) {
      setLocalizacao({ erro: "Seu navegador não suporta GPS." });
      setPegandoLoc(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocalizacao({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          ts: new Date().toLocaleTimeString("pt-BR"),
          precisao: Math.round(pos.coords.accuracy),
        });
        setPegandoLoc(false);
      },
      err => {
        let msg = "Erro ao obter localização";
        if (err.code === 1) msg = "🚫 Permissão negada. Toque no cadeado/info do navegador e libere localização.";
        else if (err.code === 2) msg = "📡 GPS indisponível. Verifique se está ligado.";
        else if (err.code === 3) msg = "⏱️ Tempo esgotado. Tente novamente em local aberto.";
        setLocalizacao({ erro: msg });
        setPegandoLoc(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  if (etapa === 0) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Presença" sub={`${obra.nome} — ${obra.local}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, color: NAVY, fontWeight: 700 }}>📅 {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          {!localizacao && (
            <button onClick={pegarLocalizacao} disabled={pegandoLoc} style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1.5px dashed ${BLUE}`, background: "#f0f7ff", color: BLUE, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {pegandoLoc ? "📍 Obtendo localização..." : "📍 Registrar localização (check-in)"}
            </button>
          )}
          {localizacao && !localizacao.erro && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>📍</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>Check-in registrado às {localizacao.ts}</div>
                <div style={{ fontSize: 10, color: "#888" }}>Lat: {localizacao.lat}, Lng: {localizacao.lng} • Precisão: ±{localizacao.precisao}m</div>
                <a href={`https://maps.google.com/?q=${localizacao.lat},${localizacao.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>🗺️ Ver no Google Maps</a>
              </div>
            </div>
          )}
          {localizacao?.erro && (
            <div>
              <div style={{ fontSize: 12, color: RED, fontWeight: 600, marginBottom: 6 }}>{localizacao.erro}</div>
              <button onClick={() => { setLocalizacao(null); pegarLocalizacao(); }} style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🔄 Tentar novamente</button>
            </div>
          )}
        </div>
        {[...trabalhadores].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).map(t => {
          const eHE = (horasTrabalhadas[t.id] || 0) > 9;
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10, flexShrink: 0 }}>👷</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t.cargo}</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["Presente", "Falta", "Atestado"].map(s => (
                    <button key={s} onClick={() => setPresencas(p => ({ ...p, [t.id]: s }))} style={{ padding: "5px 7px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, background: presencas[t.id] === s ? STATUS_COLOR[s] : "#eee", color: presencas[t.id] === s ? "#fff" : "#aaa" }}>{s}</button>
                  ))}
                </div>
              </div>
              {presencas[t.id] === "Presente" && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #eee", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#666", flex: 1 }}>⏱️ Horas trabalhadas:</span>
                  <select
                    value={horasTrabalhadas[t.id] || 9}
                    onChange={e => setHorasTrabalhadas(h => ({ ...h, [t.id]: parseFloat(e.target.value) }))}
                    style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, fontWeight: 700, color: eHE ? RED : NAVY, background: eHE ? "#fef2f2" : "#fff" }}
                  >
                    {[2,3,4,4.5,5,6,7,8,8.5,9,9.5,10,10.5,11,12].map(h => <option key={h} value={h}>{h}h{h > 9 ? " (HE!)" : ""}</option>)}
                  </select>
                  {eHE && (
                    <span style={{ background: RED, color: "#fff", padding: "2px 6px", borderRadius: 5, fontSize: 9, fontWeight: 700 }}>+{((horasTrabalhadas[t.id] - 9) * 1.5).toFixed(1)}h ext (50%)</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {trabalhadores.length === 0 && (
          <EmptyState
            icon="👷"
            titulo="Nenhum trabalhador nesta obra"
            subtitulo="Cadastre trabalhadores em Recursos Humanos → Equipe e vincule-os a esta obra."
            cor={NAVY}
          />
        )}

        {/* ALIMENTAÇÃO */}
        {trabalhadores.filter(t => presencas[t.id] === "Presente").length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, letterSpacing: 0.5, marginBottom: 6 }}>☕ ALIMENTAÇÃO DO DIA</div>
            <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#8b6f00", marginBottom: 10 }}>
              💡 Por padrão, todos os presentes recebem café da manhã (R$ {empresa.valorCafeManha}) e da tarde (R$ {empresa.valorCafeTarde}). Marque exceções e adicione marmita/lanche se for o caso.
            </div>
            {trabalhadores.filter(t => presencas[t.id] === "Presente").map(t => {
              const a = alimentacao[t.id] || {};
              const totalDia = (a.cafeManha ? empresa.valorCafeManha : 0) + (a.cafeTarde ? empresa.valorCafeTarde : 0) + (a.marmita ? empresa.valorMarmita : 0) + (a.lanche ? empresa.valorLanche : 0);
              const toggle = (campo) => setAlimentacao(al => ({ ...al, [t.id]: { ...al[t.id], [campo]: !al[t.id]?.[campo] } }));
              return (
                <div key={t.id} style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", marginBottom: 6, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ flex: 1, fontWeight: 700, color: NAVY, fontSize: 12 }}>{t.nome}</div>
                    <div style={{ fontSize: 11, color: GREEN, fontWeight: 800 }}>R$ {totalDia.toFixed(2)}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    {[
                      { k: "cafeManha", l: "☕ Manhã", c: "#92400e" },
                      { k: "cafeTarde", l: "☕ Tarde", c: "#b45309" },
                      { k: "marmita",   l: "🍱 Marmita", c: "#dc2626" },
                      { k: "lanche",    l: "🥪 Lanche", c: "#0891b2" },
                    ].map(b => (
                      <button key={b.k} onClick={() => toggle(b.k)} style={{
                        padding: "5px 4px", borderRadius: 6,
                        border: a[b.k] ? `2px solid ${b.c}` : "1px solid #ddd",
                        background: a[b.k] ? b.c : "#fff",
                        color: a[b.k] ? "#fff" : "#aaa",
                        fontSize: 9, fontWeight: 700, cursor: "pointer"
                      }}>{b.l}</button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ background: NAVY, color: "#fff", borderRadius: 10, padding: "10px 14px", marginTop: 8, display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>💰 Total do dia em alimentação</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>
                R$ {trabalhadores.filter(t => presencas[t.id] === "Presente").reduce((s, t) => {
                  const a = alimentacao[t.id] || {};
                  return s + (a.cafeManha ? empresa.valorCafeManha : 0) + (a.cafeTarde ? empresa.valorCafeTarde : 0) + (a.marmita ? empresa.valorMarmita : 0) + (a.lanche ? empresa.valorLanche : 0);
                }, 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="CONFIRMAR PRESENÇA" color={GOLD} onClick={() => { onSavePresencas(presencas); setEtapa(1); }} />
      </div>
      <KMFooter />
    </div>
  );

  if (etapa === 1) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Fotos" sub={`${obra.local}  ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`} onBack={() => setEtapa(0)} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <label style={{ ...bigBtn(BLUE), display: "block", textAlign: "center", marginBottom: 8 }}>
          📷  Tirar Foto
          <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(f => {
              if (fotos.length >= 5) return;
              const reader = new FileReader();
              reader.onload = ev => setFotos(fs => fs.length < 5 ? [...fs, ev.target.result] : fs);
              reader.readAsDataURL(f);
            });
            e.target.value = "";
          }} style={{ display: "none" }} />
        </label>
        <div style={{ fontSize: 12, color: "#999", textAlign: "center", margin: "8px 0" }}>{fotos.length}/5 fotos adicionadas</div>
        {fotos.length > 0 && (
          <div style={{ background: "#f0f7ff", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#0c4a6e", textAlign: "center" }}>
            💡 Fotos serão <b>carimbadas com data, hora, obra e número</b> ao finalizar o dia
          </div>
        )}
        {fotos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
            {fotos.map((f, i) => (
              <div key={i} style={{ background: "#dde6f5", borderRadius: 10, height: 90, position: "relative", overflow: "hidden" }}>
                <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, background: RED, color: "#fff", border: "none", borderRadius: 10, width: 22, height: 22, fontSize: 12, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {fotos.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 30, fontSize: 13 }}>Nenhuma foto ainda.</div>}
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="AVANÇAR" color={BLUE} onClick={() => setEtapa(2)} />
      </div>
      <KMFooter />
    </div>
  );

  if (etapa === 2) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Equipamentos" sub={`${obra.local}  ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`} onBack={() => setEtapa(1)} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        {equipsLocal.map(eq => (
          <div key={eq.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 30, marginRight: 12 }}>{eq.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{eq.nome}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{eq.codigo}</div>
            </div>
            <button onClick={() => setEquipsLocal(es => es.map(e => e.id === eq.id ? { ...e, status: ciclo[e.status] } : e))} style={{ background: EQUIP_COLOR[eq.status], color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{eq.status}</button>
          </div>
        ))}
        {equipsLocal.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 30 }}>Nenhum equipamento nesta obra.</div>}

        {/* HORÍMETRO DAS MÁQUINAS — início e fim */}
        {ativosObra.length > 0 && (
          <>
            <div style={{ marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: 800, color: NAVY, letterSpacing: 0.5 }}>🚜 HORÍMETRO DAS MÁQUINAS</div>
            <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#8b6f00", marginBottom: 10 }}>
              💡 Anote a leitura do horímetro no início e no fim do dia. O sistema calcula automaticamente quantas horas a máquina rodou.
            </div>
            {ativosObra.map(a => {
              const h = horimetros[a.id] || { inicio: "", fim: "" };
              const ini = parseFloat(h.inicio);
              const fim = parseFloat(h.fim);
              const horasRodadas = !isNaN(ini) && !isNaN(fim) && fim >= ini ? (fim - ini).toFixed(1) : null;
              return (
                <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 22, marginRight: 8 }}>🚜</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{a.nome}</div>
                      <div style={{ fontSize: 10, color: "#999" }}>{a.placa || a.tipo}</div>
                    </div>
                    {horasRodadas !== null && (
                      <div style={{ background: parseFloat(horasRodadas) > 9 ? RED : GREEN, color: "#fff", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 800 }}>
                        {horasRodadas}h
                      </div>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>📈 Início</label>
                      <input value={h.inicio} onChange={e => setHorimetros(hs => ({ ...hs, [a.id]: { ...h, inicio: e.target.value } }))} type="number" placeholder="Ex: 1250.0" style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>📉 Fim</label>
                      <input value={h.fim} onChange={e => setHorimetros(hs => ({ ...hs, [a.id]: { ...h, fim: e.target.value } }))} type="number" placeholder="Ex: 1258.5" style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }} />
                    </div>
                  </div>
                  {!isNaN(ini) && !isNaN(fim) && fim < ini && (
                    <div style={{ fontSize: 10, color: RED, marginTop: 4, fontWeight: 600 }}>⚠️ Fim deve ser maior que o início</div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="FINALIZAR DIA" color={GREEN} onClick={() => setEtapa(3)} />
      </div>
      <KMFooter />
    </div>
  );

  if (etapa === 3) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Finalizar Dia" sub={`${obra.nome} — ${obra.local}`} onBack={() => setEtapa(2)} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        {[
          { icon: "✅", label: "Presença",              detail: `${presentes} Presentes / ${faltas} Faltas`, color: GREEN },
          { icon: "📷", label: "Fotos Enviadas",         detail: `${fotos.length} foto(s)`,                  color: BLUE },
          { icon: "⚙️", label: "Equipamentos Utilizados",detail: equipsLocal.map(e => `${e.nome}: ${e.status}`).join(" | "), color: ORANGE },
        ].map((item, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", borderLeft: `4px solid ${item.color}`, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 26, marginRight: 12 }}>{item.icon}</span>
            <div><div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{item.label}</div><div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{item.detail}</div></div>
          </div>
        ))}
        <div style={{ background: "#fff8e1", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#7b5800", marginTop: 4 }}>⚠️ Finalizando o dia você confirma o envio do relatório.</div>
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="FINALIZAR DIA" color={GREEN} onClick={() => setConfirmando(true)} />
      </div>
      <KMFooter />
      {confirmando && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, margin: 24, textAlign: "center", maxWidth: 320 }}>
            <div style={{ fontSize: 48 }}>❓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginTop: 10 }}>Deseja finalizar o dia e enviar o relatório?</div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setConfirmando(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>CANCELAR</button>
              <button onClick={async () => {
                setConfirmando(false);

                // ⚡ AUTO-GERAR RDO ao finalizar
                const numero = (rdosEmitidos?.length || 0) + 1;
                const dataStr = new Date().toLocaleDateString("pt-BR");
                const horaStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                const hojeIso = hojeStr();
                const autorNome = usuario?.nome || "Encarregado";

                // 📸 CARIMBA E ENVIA FOTOS PRA GALERIA
                const totalFotosObra = (fotosObras || []).filter(f => f.obraId === obra.id).length;
                const fotosCarimbadas = [];
                for (let i = 0; i < fotos.length; i++) {
                  const numeroFoto = totalFotosObra + i + 1;
                  const fotoOriginal = fotos[i].url || fotos[i];
                  const carimbada = await carimbarFoto(fotoOriginal, {
                    numero: numeroFoto,
                    obra: obra.nome,
                    autor: autorNome,
                    data: dataStr,
                    hora: horaStr,
                  });
                  fotosCarimbadas.push(carimbada);

                  // Manda pra galeria
                  if (onSalvarFotoObra) {
                    onSalvarFotoObra({
                      id: Date.now() + i,
                      numero: numeroFoto,
                      obraId: obra.id,
                      obraNome: obra.nome,
                      foto: carimbada,
                      legenda: "📅 Foto do dia (RDO)",
                      autor: autorNome,
                      data: dataStr,
                      hora: horaStr,
                      origemRDO: numero,
                    });
                  }
                }

                // Calcula horas extras totais
                let totalHE = 0;
                trabalhadores.forEach(t => {
                  if (presencas[t.id] === "Presente") {
                    const h = horasTrabalhadas[t.id] || 9;
                    if (h > 9) totalHE += (h - 9);
                  }
                });

                // Salva horímetros
                const horimetrosFinais = {};
                Object.entries(horimetros).forEach(([id, h]) => {
                  const ini = parseFloat(h.inicio);
                  const fim = parseFloat(h.fim);
                  if (!isNaN(ini) && !isNaN(fim) && fim >= ini) {
                    horimetrosFinais[id] = { inicio: ini, fim, horas: +(fim - ini).toFixed(1) };
                  }
                });

                const rdo = {
                  id: Date.now(),
                  numero,
                  obraId: obra.id,
                  data: dataStr,
                  dataIso: hojeIso,
                  encarregado: autorNome,
                  clima: "Bom",
                  observacoes: `Relatório gerado automaticamente ao finalizar o dia. ${presentes} presente(s), ${faltas} falta(s). ${fotos.length} foto(s) registrada(s).`,
                  ts: Date.now(),
                  autoGerado: true,
                  horasTrabalhadas: { ...horasTrabalhadas },
                  totalHE: +totalHE.toFixed(1),
                  horimetros: horimetrosFinais,
                  fotos: fotosCarimbadas,
                  presencas: { ...presencas },
                  alimentacao: { ...alimentacao },
                  totalAlimentacao: trabalhadores.filter(t => presencas[t.id] === "Presente").reduce((s, t) => {
                    const a = alimentacao[t.id] || {};
                    return s + (a.cafeManha ? empresa.valorCafeManha : 0) + (a.cafeTarde ? empresa.valorCafeTarde : 0) + (a.marmita ? empresa.valorMarmita : 0) + (a.lanche ? empresa.valorLanche : 0);
                  }, 0),
                };
                if (onAutoEmitirRDO) onAutoEmitirRDO(rdo);

                setEtapa(4);
              }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, background: `linear-gradient(160deg,${NAVY},#071030)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 32 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 16 }}>Relatório Enviado!</div>
        <div style={{ color: "rgba(255,255,255,0.7)", marginTop: 8, fontSize: 14 }}>Ótimo trabalho hoje!</div>
        <div style={{ background: "rgba(245,166,35,0.15)", border: `1px solid ${GOLD}55`, color: GOLD, borderRadius: 10, padding: "10px 14px", fontSize: 12, fontWeight: 600, marginTop: 16 }}>
          📄 RDO Nº {String((rdosEmitidos?.length || 0)).padStart(3, "0")} gerado e salvo automaticamente.<br/>
          <span style={{ fontSize: 10, opacity: 0.85 }}>O gestor poderá baixar o PDF no painel.</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, width: "calc(100% - 48px)" }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 28, color: "#fff", letterSpacing: -1 }}>KM</span>
          <span style={{ fontWeight: 900, fontSize: 28, color: GOLD, letterSpacing: -1 }}>ZERO</span>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2.5 }}>GESTÃO DE OBRAS</div>
        </div>
        <Btn label="VOLTAR AO INÍCIO" color={GOLD} onClick={onBack} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   SOLICITAR MATERIAL
════════════════════════════════════ */

export function TelaCalendario({ obras, trabalhadores, historico, onBack }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(null);

  const trabObra = trabalhadores.filter(t => t.obraId === obraId);
  const primDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < primDia; i++) cells.push(null);
  for (let d = 1; d <= totalDias; d++) cells.push(d);

  const corDoDia = (d) => {
    if (!d) return "transparent";
    const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pres = historico[iso];
    if (!pres) return "#f0f0f0";
    const total = trabObra.length;
    const presentes = trabObra.filter(t => pres[t.id] === "Presente").length;
    if (total === 0) return "#f0f0f0";
    const pct = presentes / total;
    if (pct >= 0.8) return GREEN;
    if (pct >= 0.5) return ORANGE;
    return RED;
  };

  const navMes = (delta) => {
    const novo = new Date(ano, mes + delta, 1);
    setMes(novo.getMonth()); setAno(novo.getFullYear());
  };

  const isoDia = diaSel ? `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaSel).padStart(2, "0")}` : null;
  const presenDia = isoDia ? historico[isoDia] || {} : {};
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Calendário" sub="Histórico de presenças" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 12 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => navMes(-1)} style={{ background: LIGHT, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>‹</button>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{meses[mes]} {ano}</div>
            <button onClick={() => navMes(1)} style={{ background: LIGHT, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, color: "#888", fontWeight: 700 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {cells.map((d, i) => (
              <button key={i} disabled={!d} onClick={() => setDiaSel(d)} style={{
                aspectRatio: "1", border: diaSel === d ? `2px solid ${NAVY}` : "none", borderRadius: 8,
                background: corDoDia(d), color: !d || corDoDia(d) === "#f0f0f0" ? "#888" : "#fff",
                fontWeight: 700, fontSize: 13, cursor: d ? "pointer" : "default", opacity: d ? 1 : 0,
              }}>{d || ""}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 10, color: "#666", justifyContent: "center" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: GREEN, borderRadius: 2, marginRight: 4 }}></span>≥80%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: ORANGE, borderRadius: 2, marginRight: 4 }}></span>50-79%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: RED, borderRadius: 2, marginRight: 4 }}></span>&lt;50%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f0f0f0", borderRadius: 2, marginRight: 4 }}></span>Sem dados</span>
          </div>
        </div>

        {diaSel && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📅 Dia {diaSel}/{mes + 1}/{ano}</div>
            {trabObra.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>Sem trabalhadores nesta obra.</div>}
            {trabObra.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ flex: 1, fontSize: 13, color: NAVY }}>{t.nome}</span>
                <Badge label={presenDia[t.id] || "—"} color={STATUS_COLOR[presenDia[t.id]] || "#888"} small />
              </div>
            ))}
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FOLHA DE PAGAMENTO
════════════════════════════════════ */

export function TelaFolha({ obras, trabalhadores, historico, onBack }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [obraId, setObraId] = useState("todas");

  const totalDiasUteis = (() => {
    const total = new Date(ano, mes + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= total; d++) {
      const dt = new Date(ano, mes, d).getDay();
      if (dt !== 0) count++; // dom = 0
    }
    return count;
  })();

  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => String(t.obraId) === String(obraId));

  const calcular = (t) => {
    const total = new Date(ano, mes + 1, 0).getDate();
    let presentes = 0, faltas = 0, atestados = 0;
    for (let d = 1; d <= total; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente") presentes++;
      else if (s === "Falta") faltas++;
      else if (s === "Atestado") atestados++;
    }
    const diaria = parseFloat(t.diaria) || 0;
    const diasPagos = presentes + atestados;
    const bruto = diaria * diasPagos;
    return { presentes, faltas, atestados, diaria, diasPagos, bruto, liquido: bruto };
  };

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const totalFolha = trabFiltro.reduce((s, t) => s + calcular(t).liquido, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Folha de Pagamento" sub={`${meses[mes]}/${ano}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={{ ...selS, flex: 2, marginBottom: 0 }}>
            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: `linear-gradient(135deg,${GREEN},#1a8540)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #2aa84f44" }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Total da folha (líquido)</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>R$ {totalFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{trabFiltro.length} trabalhador(es) • {totalDiasUteis} dias úteis</div>
        </div>

        {trabFiltro.filter(t => { const c = calcular(t); return c.diasPagos > 0; }).map(t => {
          const c = calcular(t);
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t.cargo}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: GREEN }}>R$ {c.liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{c.diasPagos} dias × R$ {c.diaria.toFixed(2)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, fontSize: 10 }}>
                <span style={{ background: "#f0fdf4", color: GREEN, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>✓ {c.presentes}</span>
                <span style={{ background: "#fef2f2", color: RED, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>✗ {c.faltas}</span>
                <span style={{ background: "#fff8f0", color: ORANGE, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>📋 {c.atestados}</span>
              </div>
            </div>
          );
        })}
        {trabFiltro.filter(t => { const c = calcular(t); return c.diasPagos > 0; }).length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum trabalhador com dias trabalhados no mês.</div>}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DIÁRIO DE OBRA — anotações livres
════════════════════════════════════ */

export function TelaDiario({ obra, usuario, diario, fotosObras = [], onBack, onAdd, onRemove, onSalvarFotoObra }) {
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [erroVoz, setErroVoz] = useState("");
  const [fotoVer, setFotoVer] = useState(null); // visualização fullscreen
  const minhasObras = diario.filter(d => d.obraId === obra.id).sort((a, b) => b.ts - a.ts);

  const adicionar = async () => {
    if (!texto.trim() && !foto) return;
    setSalvando(true);

    let fotoFinal = foto;

    // Se tem foto, carimba antes de salvar
    if (foto) {
      const dataAtual = new Date().toLocaleDateString("pt-BR");
      const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const autorNome = usuario?.nome || "—";
      const totalFotosObra = (fotosObras || []).filter(f => f.obraId === obra.id).length;
      const numeroFoto = totalFotosObra + 1;

      try {
        fotoFinal = await carimbarFoto(foto, {
          numero: numeroFoto,
          obra: obra.nome,
          autor: autorNome,
          data: dataAtual,
          hora: horaAtual,
        });

        // Manda pra galeria também
        if (onSalvarFotoObra) {
          onSalvarFotoObra({
            id: Date.now(),
            numero: numeroFoto,
            obraId: obra.id,
            obraNome: obra.nome,
            foto: fotoFinal,
            legenda: texto.trim().substring(0, 80) || "📒 Diário de obra",
            autor: autorNome,
            data: dataAtual,
            hora: horaAtual,
            origemDiario: true,
          });
        }
      } catch (e) {
        console.warn("Carimbo falhou:", e);
      }
    }

    onAdd({ id: Date.now(), obraId: obra.id, autor: usuario?.nome || "—", texto: texto.trim(), foto: fotoFinal, ts: Date.now() });
    setTexto("");
    setFoto(null);
    setSalvando(false);
  };

  const tirarFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setFoto(ev.target.result);
    r.readAsDataURL(f);
  };

  const iniciarVoz = () => {
    setErroVoz("");
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErroVoz("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge no celular.");
      return;
    }
    const rec = new SpeechRec();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    let textoFinal = texto;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) textoFinal += transcript + " ";
        else interim += transcript;
      }
      setTexto(textoFinal + interim);
    };
    rec.onerror = (e) => { setErroVoz("Erro: " + e.error); setGravando(false); };
    rec.onend = () => setGravando(false);
    rec.start();
    setRecognition(rec);
    setGravando(true);
  };

  const pararVoz = () => {
    if (recognition) recognition.stop();
    setGravando(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Diário de Obra" sub={obra.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} placeholder="Anote aqui ou use o botão de voz: incidentes, observações, mudanças, problemas..." style={{ ...inputS, resize: "none", fontFamily: "inherit", marginBottom: 8 }} />

          {!gravando ? (
            <button onClick={iniciarVoz} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, cursor: "pointer", marginBottom: 8, boxShadow: "0 3px 10px #dc262644", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              🎤 Ditar por Voz
            </button>
          ) : (
            <button onClick={pararVoz} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, cursor: "pointer", marginBottom: 8, animation: "pulse 1.5s infinite", boxShadow: "0 3px 10px #dc262688", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, background: "#fff", borderRadius: 5, animation: "blink 0.8s infinite" }}></span>
              ⏹️ Parar Gravação (gravando...)
            </button>
          )}

          {erroVoz && <div style={{ background: "#fef2f2", color: RED, padding: "6px 10px", borderRadius: 6, fontSize: 11, marginBottom: 8 }}>⚠️ {erroVoz}</div>}

          {/* Anexar foto na ocorrência */}
          {foto ? (
            <div style={{ position: "relative", marginBottom: 8 }}>
              <img src={foto} alt="Foto" style={{ width: "100%", borderRadius: 10, border: "1.5px solid #dde2ef" }} />
              <button onClick={() => setFoto(null)} style={{ position: "absolute", top: 6, right: 6, background: RED, color: "#fff", border: "none", borderRadius: 16, width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          ) : (
            <label style={{ display: "block", textAlign: "center", padding: 10, marginBottom: 8, border: "1.5px dashed #dde2ef", borderRadius: 10, color: "#666", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              📷 Anexar foto (opcional)
              <input type="file" accept="image/*" capture="environment" onChange={tirarFoto} style={{ display: "none" }} />
            </label>
          )}

          {foto && (
            <div style={{ background: "#f0f7ff", borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 10, color: "#0c4a6e", textAlign: "center" }}>
              💡 Foto será <b>carimbada</b> e enviada pra galeria
            </div>
          )}
          <Btn label={salvando ? "⏳ Carimbando foto..." : "📝 Adicionar Anotação"} color={salvando ? "#ccc" : NAVY} disabled={salvando} onClick={adicionar} />
        </div>

        <style>{`@keyframes blink { 50% { opacity: 0.3; } } @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }`}</style>

        {minhasObras.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>📓 Nenhuma anotação ainda.</div>}

        {minhasObras.map(d => (
          <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>📌 {d.autor} • {new Date(d.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              {(() => {
                const isGestor = usuario && usuario.perfil === "gestor";
                const ehMeuLancamentoDeHoje = usuario && d.autor === usuario.nome && (Date.now() - d.ts) < 24 * 60 * 60 * 1000;
                if (isGestor || ehMeuLancamentoDeHoje) {
                  return <button onClick={() => onRemove(d.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>;
                }
                return null;
              })()}
            </div>
            {d.texto && <div style={{ fontSize: 14, color: NAVY, whiteSpace: "pre-wrap", lineHeight: 1.4, marginBottom: d.foto ? 8 : 0 }}>{d.texto}</div>}
            {d.foto && <img src={d.foto} alt="Foto da ocorrência" onClick={() => setFotoVer({ src: d.foto, legenda: d.texto })} style={{ width: "100%", borderRadius: 8, border: "1px solid #eee", cursor: "pointer" }} />}
          </div>
        ))}
      </div>
      <KMFooter />
      {fotoVer && <FotoViewer src={fotoVer.src} legenda={fotoVer.legenda} onClose={() => setFotoVer(null)} />}
    </div>
  );
}

/* ════════════════════════════════════
   GESTÃO DE EQUIPAMENTOS (adicionar/editar)
════════════════════════════════════ */

export function TelaFolhaQuinzenal({ obras, trabalhadores, historico, adiantamentos, abastecimentos = [], ativos = [], empresa, onBack, onSalvarFolha, onMarcarPago }) {
  const hoje = new Date();
  // ════ ESCOLHA DO REGIME DA FOLHA (definida pelo gestor) ════
  const [tipoRegime, setTipoRegime] = useState("quinzenal"); // diaria | semanal | quinzenal | mensal
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [quinzena, setQuinzena] = useState(hoje.getDate() <= 15 ? 1 : 2);
  // ════ NOVOS: datas de pagamento definidas pelo gestor ════
  const [dataPagamento, setDataPagamento] = useState(""); // data específica que o gestor escolhe pagar
  const [diaPagDiario, setDiaPagDiario] = useState(hoje.toISOString().slice(0, 10)); // diária: dia específico
  const [diaPagSemanal, setDiaPagSemanal] = useState(hoje.toISOString().slice(0, 10)); // semanal: dia que paga
  const [semanaSelecionada, setSemanaSelecionada] = useState(1); // 1-5 (qual semana do mês)
  const [diaPagQuinzenal1, setDiaPagQuinzenal1] = useState(""); // 1ª quinzena: data de pagamento
  const [diaPagQuinzenal2, setDiaPagQuinzenal2] = useState(""); // 2ª quinzena: data de pagamento
  const [diaPagMensal, setDiaPagMensal] = useState(""); // mensal: data de pagamento
  // ════ PERSONALIZADO: período totalmente livre ════
  const [persInicio, setPersInicio] = useState(""); // data inicial (YYYY-MM-DD)
  const [persFim, setPersFim] = useState("");        // data final (YYYY-MM-DD)
  const [persPagamento, setPersPagamento] = useState(""); // data de pagamento
  // ════ obra ════
  const [obraId, setObraId] = useState("todas");
  const [salvoAviso, setSalvoAviso] = useState(false);

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const dia1 = quinzena === 1 ? 1 : 16;
  const dia2 = quinzena === 1 ? 15 : ultimoDia;

  // ════ Calcula início/fim do período conforme regime ════
  const calcularPeriodo = () => {
    if (tipoRegime === "diaria") {
      // 1 dia específico
      const data = new Date(diaPagDiario + "T12:00:00");
      return {
        diaInicio: data.getDate(),
        diaFim: data.getDate(),
        mesInicio: data.getMonth(),
        mesFim: data.getMonth(),
        anoInicio: data.getFullYear(),
        anoFim: data.getFullYear(),
        descricao: "Diária",
      };
    } else if (tipoRegime === "semanal") {
      // 7 dias terminando no diaPagSemanal
      const fim = new Date(diaPagSemanal + "T12:00:00");
      const inicio = new Date(fim);
      inicio.setDate(inicio.getDate() - 6);
      return {
        diaInicio: inicio.getDate(),
        diaFim: fim.getDate(),
        mesInicio: inicio.getMonth(),
        mesFim: fim.getMonth(),
        anoInicio: inicio.getFullYear(),
        anoFim: fim.getFullYear(),
        descricao: "Semanal",
      };
    } else if (tipoRegime === "mensal") {
      // Mês completo
      return {
        diaInicio: 1,
        diaFim: ultimoDia,
        mesInicio: mes,
        mesFim: mes,
        anoInicio: ano,
        anoFim: ano,
        descricao: "Mensal",
      };
    } else if (tipoRegime === "personalizado") {
      // PERSONALIZADO: período totalmente livre (data inicial e final escolhidas)
      if (!persInicio || !persFim) {
        // Se faltar data, usa o mês corrente como fallback seguro
        return {
          diaInicio: 1,
          diaFim: ultimoDia,
          mesInicio: mes,
          mesFim: mes,
          anoInicio: ano,
          anoFim: ano,
          descricao: "Personalizado (defina as datas)",
        };
      }
      const ini = new Date(persInicio + "T12:00:00");
      const fim = new Date(persFim + "T12:00:00");
      return {
        diaInicio: ini.getDate(),
        diaFim: fim.getDate(),
        mesInicio: ini.getMonth(),
        mesFim: fim.getMonth(),
        anoInicio: ini.getFullYear(),
        anoFim: fim.getFullYear(),
        descricao: "Personalizado",
      };
    } else {
      // QUINZENAL (padrão)
      return {
        diaInicio: dia1,
        diaFim: dia2,
        mesInicio: mes,
        mesFim: mes,
        anoInicio: ano,
        anoFim: ano,
        descricao: "Quinzenal",
      };
    }
  };

  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => String(t.obraId) === String(obraId));

  const calcularCiclo = (t) => {
    const tipo = t.tipoFolha || "quinzenal";
    const nUteis = tipo === "semanal" ? 5 : tipo === "mensal" ? 22 : 10;
    const diaria = parseFloat(t.diaria) || 0;
    const salarioFixo = parseFloat(t.salarioFixo) || 0;
    const formaCalculo = t.formaCalculo || "diaria";
    const ehCLT = formaCalculo === "mensal_fixo";
    const pagaFeriado = t.pagaFeriado !== undefined ? t.pagaFeriado === true : ehCLT;
    const pagaAtestado = t.pagaAtestado !== undefined ? t.pagaAtestado === true : ehCLT;
    const base = { presentes: 0, faltas: 0, atestados: 0, feriados: 0, diaria, salarioFixo, diasPagos: 0, diasTotaisPeriodo: 0, bruto: 0, adiantDesconto: 0, liquido: 0, tipoFolha: tipo, descricaoPeriodo: "Ciclo", formaCalculo, semAncora: false, periodoIni: null, periodoFim: null, proxPagamento: null };
    if (!t.ultimoPagamento) return { ...base, semAncora: true };
    const ancora = new Date(t.ultimoPagamento + "T12:00:00");
    let presentes = 0, faltas = 0, atestados = 0, feriados = 0, contados = 0;
    let cursor = new Date(ancora), primeiroDiaUtil = null, ultimoDiaUtil = null, guard = 0;
    while (contados < nUteis && guard < 120) {
      guard++;
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === 0 || cursor.getDay() === 6) continue;
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (!primeiroDiaUtil) primeiroDiaUtil = iso;
      ultimoDiaUtil = iso;
      contados++;
      const sdia = (historico[iso] || {})[t.id];
      const fer = feriadoEm(iso);
      if (fer && fer.tipo === "nacional" && (sdia === undefined || sdia === "" || sdia === "Feriado" || sdia === "Falta")) { feriados++; continue; }
      if (sdia === "Presente") presentes++;
      else if (sdia === "Falta") faltas++;
      else if (sdia === "Atestado") atestados++;
      else if (sdia === "Feriado") feriados++;
    }
    const diasPagos = presentes + (pagaAtestado ? atestados : 0) + (pagaFeriado ? feriados : 0);
    const bruto = diaria * diasPagos;
    let adiantDesconto = 0;
    if (adiantamentos && primeiroDiaUtil && ultimoDiaUtil) {
      adiantDesconto = adiantamentos.filter(a => a.trabId === t.id).filter(a => {
        try { const [d, m, an] = a.data.split("/"); const isoA = `${an}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return isoA >= primeiroDiaUtil && isoA <= ultimoDiaUtil; } catch { return false; }
      }).reduce((sm, a) => sm + a.valor, 0);
    }
    const liquido = Math.max(0, bruto - adiantDesconto);
    return { ...base, presentes, faltas, atestados, feriados, diasPagos, diasTotaisPeriodo: contados, bruto, adiantDesconto, liquido, periodoIni: primeiroDiaUtil, periodoFim: ultimoDiaUtil, proxPagamento: ultimoDiaUtil };
  };

  const calcular = (t) => {
    if (tipoRegime === "ciclo") return calcularCiclo(t);
    // ════ NOVO: usa o tipo GLOBAL escolhido pelo gestor no topo da tela ════
    const periodo = calcularPeriodo();
    const formaCalculo = t.formaCalculo || "diaria";

    // ────── CONTAR PRESENÇAS NO PERÍODO ──────
    let presentes = 0, faltas = 0, atestados = 0, feriados = 0;
    let diasTotaisPeriodo = 0;
    const contarDia = (d, mAtual, aAtual) => {
      const iso = `${aAtual}-${String(mAtual + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      const feriado = feriadoEm(iso);
      diasTotaisPeriodo++;
      // FERIADO NACIONAL: conta como pago (Lei brasileira)
      // Só conta como feriado se o registro for vazio OU "Feriado" OU "Falta" (faltas em feriado nacional viram feriado pago)
      if (feriado && feriado.tipo === "nacional" && (s === undefined || s === "" || s === "Feriado" || s === "Falta")) {
        feriados++;
        return;
      }
      if (s === "Presente") presentes++;
      else if (s === "Falta") faltas++;
      else if (s === "Atestado") atestados++;
      else if (s === "Feriado") feriados++;
    };

    if (periodo.mesInicio === periodo.mesFim && periodo.anoInicio === periodo.anoFim) {
      for (let d = periodo.diaInicio; d <= periodo.diaFim; d++) contarDia(d, periodo.mesInicio, periodo.anoInicio);
    } else {
      const ultDiaPrimeiroMes = new Date(periodo.anoInicio, periodo.mesInicio + 1, 0).getDate();
      for (let d = periodo.diaInicio; d <= ultDiaPrimeiroMes; d++) contarDia(d, periodo.mesInicio, periodo.anoInicio);
      for (let d = 1; d <= periodo.diaFim; d++) contarDia(d, periodo.mesFim, periodo.anoFim);
    }

    // ────── CÁLCULO DO VALOR BRUTO ──────
    const diaria = parseFloat(t.diaria) || 0;
    const salarioFixo = parseFloat(t.salarioFixo) || 0;
    // #3: feriado/atestado pagam conforme config do trabalhador (default: CLT paga, diarista não)
    const ehCLT = formaCalculo === "mensal_fixo";
    const pagaFeriado = t.pagaFeriado !== undefined ? t.pagaFeriado === true : ehCLT;
    const pagaAtestado = t.pagaAtestado !== undefined ? t.pagaAtestado === true : ehCLT;
    const diasPagos = presentes + (pagaAtestado ? atestados : 0) + (pagaFeriado ? feriados : 0);
    let bruto = 0;

    if (formaCalculo === "mensal_fixo" && salarioFixo > 0) {
      if (tipoRegime === "mensal") {
        const diaUtilMes = 30; // CLT: divisão por 30 avos, independente dos dias do mês
        if (faltas === 0) bruto = salarioFixo;
        else bruto = salarioFixo - (salarioFixo / diaUtilMes) * faltas;
      } else {
        const proporcao = diasTotaisPeriodo / 30;
        const salarioPeriodo = salarioFixo * proporcao;
        if (faltas === 0) bruto = salarioPeriodo;
        else bruto = salarioPeriodo - (salarioPeriodo / diasTotaisPeriodo) * faltas;
      }
      if (bruto < 0) bruto = 0;
    } else {
      // CÁLCULO POR DIÁRIA (padrão)
      bruto = diaria * diasPagos;
    }

    // ────── ADIANTAMENTOS DO MÊS ──────
    // Desconta na 2ª quinzena (quinzenal) ou no fechamento (mensal/semanal/diária)
    let adiantDesconto = 0;
    const aplicarDesconto = (tipoRegime === "quinzenal" && quinzena === 2) ||
                            (tipoRegime === "mensal") ||
                            (tipoRegime === "semanal") ||
                            (tipoRegime === "diaria");
    if (aplicarDesconto && adiantamentos) {
      adiantDesconto = adiantamentos
        .filter(a => a.trabId === t.id)
        .filter(a => {
          try {
            const [d, m, an] = a.data.split("/");
            return parseInt(m) - 1 === mes && parseInt(an) === ano;
          } catch { return false; }
        })
        .reduce((s, a) => s + a.valor, 0);
    }

    const liquido = Math.max(0, bruto - adiantDesconto); // nunca paga negativo
    return {
      presentes, faltas, atestados, feriados, diaria, salarioFixo,
      diasPagos, diasTotaisPeriodo, bruto, adiantDesconto, liquido,
      tipoFolha: tipoRegime, descricaoPeriodo: periodo.descricao, formaCalculo,
      diaInicio: periodo.diaInicio, diaFim: periodo.diaFim,
      mesInicio: periodo.mesInicio, mesFim: periodo.mesFim,
      anoInicio: periodo.anoInicio, anoFim: periodo.anoFim,
    };
  };

  const totalFolha = trabFiltro.reduce((s, t) => s + calcular(t).liquido, 0);
  const totalAdiantQuinzena = trabFiltro.reduce((s, t) => s + calcular(t).adiantDesconto, 0);
  // Filtra: só mostra quem tem dias trabalhados ou adiantamento (evita lista cheia de zeros)
  const trabComMov = trabFiltro.filter(t => { const c = calcular(t); return c.diasPagos > 0 || c.adiantDesconto > 0; });

  const exportarPDF = () => {
    const ehCiclo = tipoRegime === "ciclo";
    const fmt = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fbr = (iso) => { if (!iso) return "—"; const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; };
    const lista = trabComMov;
    const periodoTxt = ehCiclo ? "Por ciclo do colaborador (seg–sex)"
      : `${String(dia1).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano} a ${String(dia2).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano}`;
    const obraNome = obraId === "todas" ? "Todas as obras" : (obras.find(o => String(o.id) === String(obraId))?.nome || "—");
    const totBruto = lista.reduce((s, t) => s + calcular(t).bruto, 0);
    const totAdiant = lista.reduce((s, t) => s + calcular(t).adiantDesconto, 0);
    const totLiq = lista.reduce((s, t) => s + calcular(t).liquido, 0);
    const colPeriodo = ehCiclo ? `<th>Período</th>` : "";
    const colspanTotal = ehCiclo ? 9 : 8;
    const rows = lista.map((t, i) => {
      const c = calcular(t);
      const obra = obras.find(o => String(o.id) === String(t.obraId));
      const periodoCell = ehCiclo ? `<td style="white-space:nowrap">${fbr(c.periodoIni)} a ${fbr(c.periodoFim)}</td>` : "";
      return `<tr>
        <td class="num">${i + 1}</td>
        <td><b>${t.nome}</b></td>
        <td>${t.cargo || "—"}</td>
        <td>${obra?.nome?.substring(0, 22) || "—"}</td>
        ${periodoCell}
        <td class="num">${fmt(c.diaria)}</td>
        <td class="num ok">${c.presentes}</td>
        <td class="num warn">${c.atestados || "—"}</td>
        <td class="num crit">${c.faltas || "—"}</td>
        <td class="num"><b>${c.diasPagos}</b></td>
        <td class="num">${fmt(c.bruto)}</td>
        <td class="num">${c.adiantDesconto > 0 ? "−" + fmt(c.adiantDesconto) : "—"}</td>
        <td class="num liq">${fmt(c.liquido)}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Folha de Pagamento — KMZERO</title>
    <style>
      @page{size:A4 landscape;margin:0;}
      *{box-sizing:border-box;} body{margin:0;font-family:Arial,"Segoe UI",sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .page{width:297mm;min-height:210mm;padding:14mm 18mm 16mm 20mm;position:relative;}
      .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #C9A227;padding-bottom:6px;}
      .logo{font-size:20pt;font-weight:900;color:#14253F;letter-spacing:-.5px;line-height:1;}
      .logo span{color:#C9A227;} .logo small{display:block;font-size:6pt;letter-spacing:2px;font-weight:700;}
      .hd-doc{text-align:right;font-size:8.5pt;color:#14253F;line-height:1.5;} .hd-doc b{font-size:11pt;}
      h1{color:#14253F;font-size:13pt;margin:10px 0 2px;}
      .ident{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #c9ced6;font-size:8.5pt;margin:6px 0 10px;}
      .ident div{padding:5px 8px;border-right:1px solid #c9ced6;} .ident div:last-child{border-right:none;}
      .ident k{display:block;color:#777;font-size:7pt;text-transform:uppercase;letter-spacing:.5px;} .ident b{font-size:9pt;}
      table{width:100%;border-collapse:collapse;font-size:8.5pt;}
      th{background:#14253F;color:#fff;text-align:left;padding:5px 7px;border:1px solid #14253F;white-space:nowrap;}
      td{padding:4px 7px;border:1px solid #c9ced6;} .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
      .ok{color:#2E7D32;font-weight:700;} .warn{color:#E08A00;font-weight:700;} .crit{color:#C0392B;font-weight:700;} .liq{color:#2E7D32;font-weight:800;}
      tr:nth-child(even) td{background:#f8fafc;}
      tr.total td{font-weight:800;color:#14253F;background:#eef2f8;border-top:2px solid #14253F;}
      .cap{font-size:8pt;color:#666;margin:5px 0;}
      .ft{position:absolute;left:20mm;right:18mm;bottom:9mm;border-top:1px solid #C9A227;padding-top:4px;display:flex;justify-content:space-between;font-size:7.5pt;color:#14253F;}
      @media print{tr{page-break-inside:avoid;} thead{display:table-header-group;}}
    </style></head><body><div class="page">
      <div class="hd"><div class="logo">KM<span>ZERO</span><small>ENGENHARIA &amp; ARQUITETURA</small></div>
      <div class="hd-doc"><b>FOLHA DE PAGAMENTO</b><br>KMZ-PL-001<br>${ehCiclo ? "Por Ciclo" : "Regime " + tipoRegime}</div></div>
      <h1>Folha de Pagamento${ehCiclo ? " — Por Ciclo" : ""}</h1>
      <div class="ident">
        <div><k>Empresa</k><b>${empresa.razaoSocial || empresa.nomeFantasia || "KM"}</b></div>
        <div><k>CNPJ</k><b>${empresa.cnpj || "—"}</b></div>
        <div><k>Obra</k><b>${obraNome}</b></div>
        <div><k>Período</k><b>${periodoTxt}</b></div>
      </div>
      <table>
        <tr><th class="num">Nº</th><th>Nome</th><th>Cargo</th><th>Obra</th>${colPeriodo}<th class="num">Diária</th><th class="num">Pres.</th><th class="num">Atest.</th><th class="num">Falta</th><th class="num">Dias pagos</th><th class="num">Bruto (R$)</th><th class="num">Adiant.</th><th class="num">Líquido (R$)</th></tr>
        ${rows}
        <tr class="total"><td colspan="${colspanTotal}">TOTAL DA FOLHA</td><td class="num">${fmt(totBruto)}</td><td class="num">${totAdiant > 0 ? "−" + fmt(totAdiant) : "—"}</td><td class="num">${fmt(totLiq)}</td></tr>
      </table>
      <div class="cap">Pres. = dias presentes · Atest. = atestados (pagos conforme cadastro) · Falta não paga · cor semântica nos dados, marca só na moldura.${ehCiclo ? " Período por ciclo de cada colaborador (seg–sex), a partir do último pagamento." : ""}</div>
      <div class="ft"><span>${empresa.razaoSocial || "KM"}</span><span>KMZ-PL-001 · Validado pelo KMZERO</span><span>Emitido em ${new Date().toLocaleDateString("pt-BR")}</span></div>
    </div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
    </body></html>`;
    abrirOuBaixarHTML(html, `Folha-KMZERO-${ehCiclo ? "ciclo" : tipoRegime}-${new Date().toISOString().slice(0, 10)}.html`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Folha de Pagamento" sub={`${meses[mes]}/${ano} · ${tipoRegime.charAt(0).toUpperCase() + tipoRegime.slice(1)}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* ════ 4 BOTÕES DE TIPO DE FOLHA (escolha simples) ════ */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, letterSpacing: 2, marginBottom: 8 }}>📋 TIPO DA FOLHA</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { k: "diaria", l: "📅 Diária", c: "#0891b2", d: "1 dia específico" },
              { k: "semanal", l: "📆 Semanal", c: "#16a34a", d: "7 dias corridos" },
              { k: "quinzenal", l: "🗓️ Quinzenal", c: GOLD, d: "15 dias" },
              { k: "mensal", l: "📊 Mensal", c: "#7c3aed", d: "Mês completo" },
              { k: "personalizado", l: "⚙️ Personalizado", c: "#e87722", d: "Você escolhe o período" },
              { k: "ciclo", l: "🔁 Por Ciclo", c: "#0e7490", d: "Sexta a sexta, por colaborador" },
            ].map(opt => (
              <button
                key={opt.k}
                onClick={() => setTipoRegime(opt.k)}
                style={{
                  padding: "10px 8px",
                  borderRadius: 10,
                  border: tipoRegime === opt.k ? `2px solid ${opt.c}` : "1px solid #e5e7eb",
                  background: tipoRegime === opt.k ? `${opt.c}15` : "#fff",
                  color: tipoRegime === opt.k ? opt.c : NAVY,
                  fontWeight: 800,
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: tipoRegime === opt.k ? `0 3px 10px ${opt.c}30` : "none",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 13 }}>{opt.l}</div>
                <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 500, marginTop: 2 }}>{opt.d}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ════ MÊS / ANO ════ */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={{ ...selS, flex: 2, marginBottom: 0 }}>
            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* ════ CAMPOS DE DATA DE PAGAMENTO (variam conforme tipo escolhido) ════ */}
        {tipoRegime === "diaria" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #0891b215" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0891b2", letterSpacing: 1, marginBottom: 6 }}>📅 DIA DA FOLHA DIÁRIA</div>
            <input
              type="date"
              value={diaPagDiario}
              onChange={e => setDiaPagDiario(e.target.value)}
              style={{ ...dateS, marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
              💡 Folha calculada apenas para esse dia específico. Use para pagar diária avulsa.
            </div>
          </div>
        )}

        {tipoRegime === "semanal" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #16a34a15" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: GREEN, letterSpacing: 1, marginBottom: 6 }}>📆 ÚLTIMO DIA DA SEMANA (DATA DE PAGAMENTO)</div>
            <input
              type="date"
              value={diaPagSemanal}
              onChange={e => setDiaPagSemanal(e.target.value)}
              style={{ ...dateS, marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
              💡 Calcula os 7 dias anteriores (inclusive) ao dia escolhido. Ex: pagamento toda sexta-feira.
            </div>
          </div>
        )}

        {tipoRegime === "quinzenal" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {[1, 2].map(q => (
                <button key={q} onClick={() => setQuinzena(q)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer", background: quinzena === q ? NAVY : "#fff", color: quinzena === q ? "#fff" : NAVY, fontWeight: 700, fontSize: 13, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  {q}ª Quinzena<br/><span style={{ fontSize: 10, opacity: 0.8 }}>{q === 1 ? "01-15" : `16-${ultimoDia}`}</span>
                </button>
              ))}
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: `1px solid ${GOLD}15` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#b8801a", letterSpacing: 1, marginBottom: 6 }}>🗓️ DATA DE PAGAMENTO DA {quinzena}ª QUINZENA</div>
              <input
                type="date"
                value={quinzena === 1 ? diaPagQuinzenal1 : diaPagQuinzenal2}
                onChange={e => quinzena === 1 ? setDiaPagQuinzenal1(e.target.value) : setDiaPagQuinzenal2(e.target.value)}
                style={{ ...dateS, marginBottom: 6 }}
              />
              <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
                💡 Período calculado: {quinzena === 1 ? "dia 01 ao 15" : `dia 16 ao ${ultimoDia}`}. Data informada será exibida na folha.
              </div>
            </div>
          </>
        )}

        {tipoRegime === "mensal" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #7c3aed15" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", letterSpacing: 1, marginBottom: 6 }}>📊 DATA DE PAGAMENTO DO MÊS</div>
            <input
              type="date"
              value={diaPagMensal}
              onChange={e => setDiaPagMensal(e.target.value)}
              style={{ ...dateS, marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
              💡 Período calculado: mês inteiro ({meses[mes]}/{ano}, dia 1 ao {ultimoDia}). Data informada será exibida na folha.
            </div>
          </div>
        )}

        {tipoRegime === "personalizado" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #e8772230" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#e87722", letterSpacing: 1, marginBottom: 6 }}>⚙️ PERÍODO PERSONALIZADO</div>

            <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>DATA INICIAL</label>
            <input
              type="date"
              value={persInicio}
              onChange={e => setPersInicio(e.target.value)}
              style={{ ...dateS }}
            />

            <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>DATA FINAL</label>
            <input
              type="date"
              value={persFim}
              onChange={e => setPersFim(e.target.value)}
              style={{ ...dateS }}
            />

            <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>DATA DE PAGAMENTO</label>
            <input
              type="date"
              value={persPagamento}
              onChange={e => setPersPagamento(e.target.value)}
              style={{ ...dateS, marginBottom: 6 }}
            />
            {persInicio && persFim ? (
              <div style={{ background: "#fff5e6", borderRadius: 6, padding: "6px 8px", fontSize: 11, color: "#9a5a1a", lineHeight: 1.4 }}>
                ✓ Período: <b>{new Date(persInicio + "T12:00:00").toLocaleDateString("pt-BR")}</b> até <b>{new Date(persFim + "T12:00:00").toLocaleDateString("pt-BR")}</b>
                {(() => {
                  const ini = new Date(persInicio + "T12:00:00");
                  const fim = new Date(persFim + "T12:00:00");
                  const dias = Math.round((fim - ini) / (1000 * 60 * 60 * 24)) + 1;
                  return dias > 0 ? <span> · <b>{dias} dia{dias > 1 ? "s" : ""}</b></span> : <span style={{ color: RED }}> · ⚠️ Data final deve ser depois da inicial</span>;
                })()}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
                💡 Use para quinzenas atípicas (ex: dia 18 ao 29), períodos de empreitada ou qualquer intervalo livre.
              </div>
            )}
          </div>
        )}

        {/* ════ BANNER DE FERIADOS NO PERÍODO ════ */}
        {tipoRegime !== "ciclo" && (() => {
          const p = calcularPeriodo();
          const feriadosNoPeriodo = [];
          const adicionarSe = (dia, m, a) => {
            const iso = `${a}-${String(m + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            const f = feriadoEm(iso);
            if (f) feriadosNoPeriodo.push({ data: iso, ...f });
          };
          if (p.mesInicio === p.mesFim && p.anoInicio === p.anoFim) {
            for (let d = p.diaInicio; d <= p.diaFim; d++) adicionarSe(d, p.mesInicio, p.anoInicio);
          } else {
            const ult = new Date(p.anoInicio, p.mesInicio + 1, 0).getDate();
            for (let d = p.diaInicio; d <= ult; d++) adicionarSe(d, p.mesInicio, p.anoInicio);
            for (let d = 1; d <= p.diaFim; d++) adicionarSe(d, p.mesFim, p.anoFim);
          }
          if (feriadosNoPeriodo.length === 0) return null;
          return (
            <div style={{ background: "#fff7e6", borderRadius: 12, padding: 12, marginBottom: 10, border: `1px solid ${GOLD}30` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a6d1a", letterSpacing: 1, marginBottom: 6 }}>🎉 FERIADO(S) NESTE PERÍODO</div>
              {feriadosNoPeriodo.map(f => {
                const [a, m, d] = f.data.split("-");
                return (
                  <div key={f.data} style={{ fontSize: 12, color: "#5c5210", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                    <span>{f.emoji} <b>{f.nome}</b></span>
                    <span style={{ color: f.tipo === "nacional" ? "#16a34a" : "#888", fontSize: 10, fontWeight: 700, alignSelf: "center" }}>
                      {d}/{m} • {f.tipo === "nacional" ? "PAGO" : "FACULTATIVO"}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: "#7c6f3a", marginTop: 6, lineHeight: 1.4 }}>
                ℹ️ Feriados nacionais são contados como dia pago automaticamente (Lei 605/49). Facultativos seguem o registro de presença.
              </div>
            </div>
          );
        })()}

        <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: `linear-gradient(135deg,${GREEN},#1a8540)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #2aa84f44" }}>
          <div style={{ fontSize: 11, opacity: 0.9 }}>Total da folha {tipoRegime} (líquido)</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>R$ {totalFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{trabFiltro.length} trabalhador(es) • {tipoRegime === "ciclo" ? "ciclo por colaborador" : (() => {
            const p = calcularPeriodo();
            if (p.mesInicio === p.mesFim) return `${p.diaFim - p.diaInicio + 1} dias`;
            return `${p.diaInicio}/${p.mesInicio + 1} a ${p.diaFim}/${p.mesFim + 1}`;
          })()}</div>
          {totalAdiantQuinzena > 0 && (
            <div style={{ fontSize: 11, opacity: 0.95, marginTop: 6, background: "rgba(0,0,0,0.15)", padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
              💸 Adiantamentos descontados: R$ {totalAdiantQuinzena.toFixed(2)}
            </div>
          )}
        </div>

        {tipoRegime !== "ciclo" && (<>
        {/* Tabela compacta */}
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ background: NAVY, color: "#fff", padding: "8px 12px", fontSize: 11, fontWeight: 700, display: "grid", gridTemplateColumns: "1fr 40px 70px 80px", gap: 6 }}>
            <span>Nome / Cargo</span><span style={{ textAlign: "center" }}>Dias</span><span style={{ textAlign: "right" }}>Diária</span><span style={{ textAlign: "right" }}>Líquido</span>
          </div>
          {trabComMov.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>Sem dias trabalhados nesta quinzena.</div>}
          {trabComMov.map(t => {
            const c = calcular(t);
            return (
              <div key={t.id} style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", display: "grid", gridTemplateColumns: "1fr 40px 70px 80px", gap: 6, alignItems: "center", fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 12 }}>{t.nome}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{t.cargo}{c.feriados > 0 && <span style={{ color: GOLD, fontWeight: 700 }}> • 🎉 {c.feriados} feriado{c.feriados > 1 ? "s" : ""}</span>}{c.adiantDesconto > 0 && <span style={{ color: ORANGE, fontWeight: 700 }}> • Vale R$ {c.adiantDesconto.toFixed(2)}</span>}{c.formaCalculo === "mensal_fixo" && <span style={{ color: "#7c3aed", fontWeight: 700 }}> • Salário fixo</span>}</div>
                </div>
                <div style={{ textAlign: "center", fontWeight: 800, color: NAVY }}>{c.diasPagos}</div>
                <div style={{ textAlign: "right", color: "#666", fontSize: 11 }}>R$ {c.formaCalculo === "mensal_fixo" ? (c.salarioFixo / 30).toFixed(2) : c.diaria.toFixed(2)}</div>
                <div style={{ textAlign: "right", fontWeight: 800, color: GREEN, fontSize: 13 }}>R$ {c.liquido.toFixed(2)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#0c4a6e", marginBottom: 8 }}>
          💡 <b>Regime atual:</b> {tipoRegime === "diaria" ? "Diária (1 dia específico)" : tipoRegime === "semanal" ? "Semanal (7 dias)" : tipoRegime === "quinzenal" ? `${quinzena}ª Quinzena (${dia1}-${dia2}/${mes + 1})` : tipoRegime === "mensal" ? "Mensal (mês completo)" : (persInicio && persFim ? `Personalizado (${new Date(persInicio + "T12:00:00").toLocaleDateString("pt-BR")} - ${new Date(persFim + "T12:00:00").toLocaleDateString("pt-BR")})` : "Personalizado (defina as datas acima)")}. Faltas não pagam. Atestados pagam. Adiantamentos descontados no fechamento.
        </div>

        <Btn label="📄 EXPORTAR FOLHA EM PDF" color={GOLD} onClick={exportarPDF} />

        <button onClick={() => {
          if (!confirm(`Salvar folha da ${quinzena}ª quinzena de ${meses[mes]}/${ano} no histórico?`)) return;
          const periodo = `${String(dia1).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano} a ${String(dia2).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano}`;
          const itens = trabFiltro.map(t => {
            const c = calcular(t);
            return { trabId: t.id, nome: t.nome, cargo: t.cargo, ...c };
          });
          onSalvarFolha({
            id: Date.now(), mes, ano, quinzena, periodo,
            obraId: obraId === "todas" ? null : obraId,
            itens, totalLiquido: totalFolha, totalAdiant: totalAdiantQuinzena,
            ts: Date.now(),
          });
          setSalvoAviso(true);
          setTimeout(() => setSalvoAviso(false), 3000);
        }} style={{ width: "100%", padding: 12, marginTop: 8, background: "#fff", color: NAVY, border: `1.5px solid ${NAVY}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          📥 Arquivar esta folha no histórico
        </button>

        {salvoAviso && (
          <div style={{ background: "#f0fdf4", color: GREEN, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginTop: 8, textAlign: "center" }}>
            ✅ Folha salva no histórico!
          </div>
        )}
        </>)}

        {tipoRegime === "ciclo" && (
          <>
            <div style={{ background: "#ecfeff", border: "1px solid #0e749030", borderRadius: 12, padding: "10px 14px", fontSize: 11, color: "#155e63", marginBottom: 10, lineHeight: 1.5 }}>
              🔁 <b>Folha por ciclo:</b> cada colaborador fecha conforme o regime dele (semanal = 5 dias úteis · quinzenal = 10), contando só seg–sex a partir do <b>último pagamento</b>. Ao pagar, toque em <b>"Marcar pago"</b> que o ciclo avança sozinho. Configure regime e último pagamento na ficha de cada um (Equipe › trabalhador).
            </div>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              {trabFiltro.map(t => {
                const c = calcular(t);
                const fmt = iso => iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
                return (
                  <div key={t.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: NAVY }}>{t.nome}</div>
                        <div style={{ fontSize: 10, color: "#888" }}>{t.cargo} • {(t.tipoFolha || "quinzenal") === "semanal" ? "Semanal" : "Quinzenal"} • R$ {(parseFloat(t.diaria) || 0).toFixed(2)}/dia</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: GREEN, fontSize: 14 }}>R$ {c.liquido.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: "#888" }}>{c.diasPagos} dia(s) pago(s)</div>
                      </div>
                    </div>
                    {c.semAncora ? (
                      <div style={{ background: "#fff7e6", color: "#9a6a1a", borderRadius: 6, padding: "5px 8px", marginTop: 6, fontSize: 11 }}>
                        ⚠️ Sem âncora. Defina o "Último pagamento" na ficha desse colaborador para abrir o ciclo.
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 8 }}>
                        <div style={{ fontSize: 11, color: "#666" }}>
                          Período: <b>{fmt(c.periodoIni)}</b> a <b>{fmt(c.periodoFim)}</b> • {c.presentes}P {c.faltas}F{c.atestados > 0 ? ` ${c.atestados}A` : ""}{c.adiantDesconto > 0 ? ` • vale R$ ${c.adiantDesconto.toFixed(2)}` : ""}
                        </div>
                        <button onClick={() => {
                          if (!confirm(`Marcar ${t.nome} como PAGO até ${fmt(c.proxPagamento)} (líquido R$ ${c.liquido.toFixed(2)})?\n\nO próximo ciclo começa no dia seguinte.`)) return;
                          onMarcarPago && onMarcarPago(t, c.proxPagamento);
                        }} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>✓ Marcar pago</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {trabFiltro.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum trabalhador.</div>}
            </div>
          <Btn label="📄 EXPORTAR FOLHA EM PDF" color={GOLD} onClick={exportarPDF} />
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MOVIMENTAÇÃO DE PESSOAL (com aprovação do gestor)
════════════════════════════════════ */

export function TelaHistFolha({ obras, trabalhadores, folhasSalvas, onBack, onRemover }) {
  const [busca, setBusca] = useState("");

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const lista = [...folhasSalvas].sort((a, b) => b.ts - a.ts).filter(f => {
    if (!busca) return true;
    const txt = `${meses[f.mes]} ${f.ano} ${f.quinzena}`.toLowerCase();
    return txt.includes(busca.toLowerCase());
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Histórico de Folhas" sub="Pagamentos quinzenais salvos" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por mês ou ano..." style={inputS} />

        {lista.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            📋 Nenhuma folha salva ainda.<br/>
            <span style={{ fontSize: 11 }}>Use o botão "Salvar Folha" na tela de Folha de Pagamento.</span>
          </div>
        )}

        {lista.map(f => (
          <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>📅 {f.quinzena}ª quinzena de {meses[f.mes]}/{f.ano}</div>
                <div style={{ fontSize: 11, color: "#888" }}>Período: {f.periodo}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Salvo em {new Date(f.ts).toLocaleString("pt-BR")}</div>
              </div>
              <button onClick={() => { confirmar(`Remover folha de ${meses[f.mes]}/${f.ano}?`, () => { onRemover(f.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 6 }}>
              <span style={{ background: "#f0fdf4", color: GREEN, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>👷 {f.itens?.length || 0} trab.</span>
              <span style={{ background: "#fff8f0", color: ORANGE, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>📌 {f.itens?.reduce((s, i) => s + i.faltas, 0) || 0} faltas</span>
              {f.totalAdiant > 0 && <span style={{ background: "#fef2f2", color: RED, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>💸 R$ {f.totalAdiant.toFixed(2)}</span>}
            </div>
            <div style={{ background: `linear-gradient(135deg,${GREEN},#1a8540)`, borderRadius: 8, padding: "10px 12px", color: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.9 }}>Total Líquido Pago</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>R$ {f.totalLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        ))}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DIAGNÓSTICO — testar cada botão do app
════════════════════════════════════ */
