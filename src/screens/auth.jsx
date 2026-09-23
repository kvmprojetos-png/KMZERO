import { useState } from "react";
import { entrarComGoogle } from "../firebase.js";
import { NAVY, GOLD, GREEN, RED, BLUE, LIGHT, labelS, inputS, selS } from "../theme.js";
import { criarConvite, removerConvite, atualizarPerfilNuvem, definirAcessoAtivo } from "../lib/store.js";
import { Btn, KMHeader, KMFooter, Modal } from "../components/ui.jsx";

/* ════════════════════════════════════════════════════════════════════════
   ENTRAR — uma tela só: "Entrar com Google".
   O app decide sozinho o que fazer depois (onGoogle): gestor, equipe,
   convite pendente ou primeiro acesso.
════════════════════════════════════════════════════════════════════════ */
const fundoLogin = {
  flex: 1, position: "relative", display: "flex", flexDirection: "column",
  justifyContent: "center", padding: "28px 24px", overflow: "hidden",
  background: "linear-gradient(125deg, #0f2151 0%, #1e3a8a 25%, #0f2151 50%, #2a1a4e 75%, #0f2151 100%)",
  minHeight: "100vh",
};
const cartaoVidro = {
  background: "rgba(255,255,255,0.1)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 18,
  padding: 22,
};

function LogoKM() {
  return (
    <div style={{ textAlign: "center", marginBottom: 26 }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", letterSpacing: 4, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
        🏗️ Gestão de Obras
      </div>
      <div>
        <span style={{ fontWeight: 900, fontSize: 56, color: "#fff", letterSpacing: -2, textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>KM</span>
        <span style={{ fontWeight: 900, fontSize: 56, color: GOLD, letterSpacing: -2 }}>ZERO</span>
      </div>
      <div style={{ height: 2, width: 60, background: GOLD, margin: "10px auto", borderRadius: 2 }} />
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>Gestão Inteligente de Obras</div>
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.7 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.3 0 20 0 24s.9 7.7 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.7-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4-13.5-9.7l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function TelaEntrar({ onGoogle, erroInicial = "" }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(erroInicial);

  const entrar = async () => {
    if (carregando) return;
    setErro("");
    setCarregando(true);
    const r = await entrarComGoogle();
    if (!r.ok) {
      setCarregando(false);
      if (!r.cancelado) setErro(r.erro || "Não foi possível entrar.");
      return;
    }
    if (r.redirecionando) return; // a página vai sair para o Google e voltar
    const fim = await onGoogle(r.user);
    setCarregando(false);
    if (fim && !fim.ok && fim.erro) setErro(fim.erro);
  };

  return (
    <div style={fundoLogin}>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 420, width: "100%", margin: "0 auto" }}>
        <LogoKM />
        <div style={cartaoVidro}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Entrar</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 16, lineHeight: 1.5 }}>
            Gestor e equipe entram com a própria conta Google (Gmail). Sem senha para decorar.
          </div>

          <button onClick={entrar} disabled={carregando} style={{
            width: "100%", padding: "14px 16px", borderRadius: 12, border: "none",
            background: "#fff", color: "#1f1f1f", fontWeight: 800, fontSize: 15,
            cursor: carregando ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)", opacity: carregando ? 0.75 : 1,
          }}>
            <IconeGoogle />
            {carregando ? "Entrando..." : "Entrar com Google"}
          </button>

          {erro && (
            <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12, border: "1px solid rgba(214,59,59,0.4)", lineHeight: 1.5 }}>
              {erro}
            </div>
          )}

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 16, lineHeight: 1.6 }}>
            <b style={{ color: "rgba(255,255,255,0.8)" }}>Primeira vez?</b> Entre com o Google e escolha "Criar minha empresa".<br />
            <b style={{ color: "rgba(255,255,255,0.8)" }}>Faz parte de uma equipe?</b> Peça ao gestor para cadastrar o seu Gmail em Sistema → Acessos do App e entre com ele.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PRIMEIRO ACESSO — entrou com o Google, mas o e-mail ainda não está em
   nenhuma empresa nem tem convite.
════════════════════════════════════════════════════════════════════════ */
export function TelaPrimeiroAcesso({ usuarioGoogle, onCriarEmpresa, onVerificar, onSair }) {
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState("");

  const verificar = async () => {
    setAviso("");
    setVerificando(true);
    const r = await onVerificar();
    setVerificando(false);
    if (r && r.semConvite) setAviso(`Ainda não há convite para ${usuarioGoogle?.email}. Confira com o gestor se ele cadastrou exatamente este Gmail.`);
    else if (r && !r.ok && r.erro) setAviso(r.erro);
  };

  return (
    <div style={fundoLogin}>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 420, width: "100%", margin: "0 auto" }}>
        <LogoKM />
        <div style={cartaoVidro}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {usuarioGoogle?.foto
              ? <img src={usuarioGoogle.foto} alt="" referrerPolicy="no-referrer" style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover" }} />
              : <div style={{ width: 44, height: 44, borderRadius: 22, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuarioGoogle?.nome || "Olá!"}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuarioGoogle?.email}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 16, lineHeight: 1.6 }}>
            Este e-mail ainda não faz parte de nenhuma empresa no KMZERO. O que você quer fazer?
          </div>

          <button onClick={onCriarEmpresa} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(245,166,35,0.4)", marginBottom: 10,
          }}>
            🏗️ Criar minha empresa (sou o gestor)
          </button>

          <button onClick={verificar} disabled={verificando} style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)",
            fontWeight: 700, fontSize: 13, cursor: verificando ? "default" : "pointer",
          }}>
            {verificando ? "Verificando..." : "👷 Fui convidado por uma empresa — verificar"}
          </button>

          {aviso && (
            <div style={{ background: "rgba(245,166,35,0.18)", color: "#fde68a", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 12, border: "1px solid rgba(245,166,35,0.4)", lineHeight: 1.5 }}>
              {aviso}
            </div>
          )}

          <button onClick={onSair} style={{
            width: "100%", marginTop: 12, padding: 8, background: "transparent",
            border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer",
          }}>
            Sair e usar outra conta Google
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ACESSOS DO APP — o gestor cadastra o Gmail de cada pessoa (convite).
   Quando a pessoa entra com esse Gmail, o convite vira perfil.
════════════════════════════════════════════════════════════════════════ */
const CARGOS_ACESSO = ["Encarregado", "Apontador", "Mestre de Obras", "Técnico", "Supervisor", "Engenheiro", "Administrativo", "Outro"];

export function TelaAcessosApp({ usuario, usuarios = [], obras = [], empresa, onBack }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const formVazio = { nome: "", email: "", cargo: "Encarregado", obraId: "", perfil: "encarregado", tel: "" };
  const [form, setForm] = useState(formVazio);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const meuUid = usuario?.firebaseUid || usuario?.id;
  const lista = usuarios.filter(u => !(u.firebaseUid && u.firebaseUid === meuUid));

  const abrirNovo = () => { setEditando(null); setForm(formVazio); setModal(true); };
  const abrirEdicao = (u) => {
    setEditando(u);
    setForm({ nome: u.nome || "", email: u.email || "", cargo: u.cargo || "Encarregado", obraId: u.obraId ?? "", perfil: u.perfil || "encarregado", tel: u.tel || "" });
    setModal(true);
  };

  const salvar = async () => {
    if (salvando) return;
    const emailNorm = form.email.trim().toLowerCase();
    if (!form.nome.trim()) { alert("⚠️ Informe o nome"); return; }
    if (!editando && (!emailNorm.includes("@") || emailNorm.length < 6)) { alert("⚠️ Informe o Gmail da pessoa (é com ele que ela vai entrar)."); return; }
    if (form.perfil !== "gestor" && form.obraId === "") { alert("⚠️ Selecione a obra deste acesso.\n\nSem obra vinculada, o encarregado não vê a equipe nem os pedidos certos."); return; }
    const obraId = form.obraId === "" ? null : (isNaN(Number(form.obraId)) ? form.obraId : Number(form.obraId));
    const dados = { nome: form.nome.trim(), cargo: form.cargo, obraId, perfil: form.perfil, tel: form.tel.trim() };

    setSalvando(true);
    try {
      if (editando && editando.firebaseUid) {
        // Já entrou pelo menos uma vez: edita o perfil da nuvem
        const ok = await atualizarPerfilNuvem(editando.firebaseUid, dados);
        if (!ok) { alert("❌ Não deu para atualizar o perfil na nuvem. Verifique a conexão e tente de novo."); return; }
        alert(`✅ Acesso atualizado!\n\n${dados.nome}${obraId !== null ? "\n🏗️ " + (obras.find(o => String(o.id) === String(obraId))?.nome || "") : ""}`);
      } else {
        // Convite novo ou convite ainda pendente (a chave é o e-mail)
        if (!editando && usuarios.some(u => (u.email || "").toLowerCase() === emailNorm)) { alert("⚠️ Já existe um acesso ou convite com esse e-mail."); return; }
        const r = await criarConvite({ email: editando ? editando.email : emailNorm, ...dados, empresaNome: empresa?.nomeFantasia || empresa?.razaoSocial || "" });
        if (!r.ok) { alert("❌ Não foi possível salvar o convite:\n\n" + r.erro); return; }
        alert(`✅ Convite registrado!\n\n👤 ${dados.nome}\n📧 ${editando ? editando.email : emailNorm}\n\nNo celular da pessoa: abrir o app → "Entrar com Google" com este Gmail. Ela entra direto na sua empresa.`);
      }
      setModal(false);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (u) => {
    if (u.convite) {
      if (!confirm(`Cancelar o convite de "${u.nome}" (${u.email})?`)) return;
      const r = await removerConvite(u.email);
      if (!r.ok) alert("❌ Não foi possível cancelar: " + r.erro);
      return;
    }
    if (!confirm(`Desativar o acesso de "${u.nome}"?\n\nEla não consegue mais entrar em nenhum aparelho. Você pode reativar depois.`)) return;
    const ok = await definirAcessoAtivo(u.firebaseUid, false);
    if (!ok) alert("❌ Não foi possível desativar. Verifique a conexão.");
  };
  const reativar = async (u) => {
    const ok = await definirAcessoAtivo(u.firebaseUid, true);
    if (!ok) alert("❌ Não foi possível reativar. Verifique a conexão.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Acessos do App" sub="Quem entra na sua empresa" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#f0f9ff", borderRadius: 12, padding: 12, marginBottom: 12, border: "1px solid #bae6fd", fontSize: 11, color: "#0c4a6e", lineHeight: 1.6 }}>
          Cadastre o <b>Gmail</b> de cada pessoa. Ela entra no app com "Entrar com Google" usando esse Gmail e já cai na sua empresa, na obra escolhida. Sem senha para passar.
        </div>

        <Btn label="➕ ADICIONAR ACESSO" color={GREEN} onClick={abrirNovo} />

        {lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#888", fontSize: 13 }}>Nenhum acesso cadastrado ainda.</div>
        ) : (
          lista.map(u => {
            const obra = obras.find(o => String(o.id) === String(u.obraId));
            const iniciais = (u.nome || "?").split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
            const inativo = u.ativo === false;
            const cor = u.convite ? "#b45309" : inativo ? "#9ca3af" : u.perfil === "gestor" ? GOLD : BLUE;
            return (
              <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, opacity: inativo ? 0.75 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  {u.foto
                    ? <img src={u.foto} alt="" referrerPolicy="no-referrer" style={{ width: 42, height: 42, borderRadius: 21, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 42, height: 42, borderRadius: 21, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{iniciais}</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {u.perfil === "gestor" ? "👔 Gestor" : `👷 ${u.cargo || "Encarregado"}`}{obra ? ` · ${obra.nome}` : u.perfil === "gestor" ? "" : " · sem obra"}
                    </div>
                  </div>
                </div>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 8, marginBottom: 8, fontSize: 10, color: "#666" }}>
                  📧 {u.email}<br />
                  {u.convite
                    ? <span style={{ color: "#b45309" }}>⏳ Convite pendente — ainda não entrou com este Gmail</span>
                    : inativo
                      ? <span style={{ color: "#6b7280" }}>⛔ Acesso desativado</span>
                      : <span style={{ color: "#15803d" }}>☁️ Ativo — entra em qualquer celular com o Google</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {inativo
                    ? <button onClick={() => reativar(u)} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✅ Reativar</button>
                    : <button onClick={() => abrirEdicao(u)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>}
                  {!inativo && <button onClick={() => remover(u)} style={{ background: "#fee2e2", color: RED, border: `2px solid ${RED}`, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{u.convite ? "✖ Cancelar" : "⛔ Desativar"}</button>}
                </div>
              </div>
            );
          })
        )}
      </div>
      <KMFooter />

      <Modal show={modal} title={editando ? "Editar acesso" : "Novo acesso"} onClose={() => setModal(false)}>
        <label style={labelS}>📧 Gmail da pessoa (é o login dela)</label>
        <input value={form.email} onChange={e => set("email", e.target.value)} type="email" placeholder="exemplo@gmail.com" autoComplete="off" disabled={!!editando} style={{ ...inputS, opacity: editando ? 0.6 : 1 }} />

        <label style={labelS}>👤 Nome completo</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome da pessoa" style={inputS} />

        <label style={labelS}>🔑 Tipo de acesso</label>
        <select value={form.perfil} onChange={e => set("perfil", e.target.value)} style={selS}>
          <option value="encarregado">Equipe de campo (encarregado / apontador)</option>
          <option value="gestor">Gestor (vê e edita tudo)</option>
        </select>

        {form.perfil !== "gestor" && (
          <>
            <label style={labelS}>👷 Cargo / função</label>
            <select value={form.cargo} onChange={e => set("cargo", e.target.value)} style={selS}>
              {CARGOS_ACESSO.map(c => <option key={c}>{c}</option>)}
            </select>

            <label style={labelS}>🏗️ Obra em que vai lançar</label>
            <select value={form.obraId} onChange={e => set("obraId", e.target.value)} style={selS}>
              <option value="">Selecione a obra</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </>
        )}

        <label style={labelS}>📞 Telefone (opcional)</label>
        <input value={form.tel} onChange={e => set("tel", e.target.value)} placeholder="(28) 9 9999-9999" style={inputS} />

        <Btn label={salvando ? "⏳ SALVANDO..." : editando ? "💾 SALVAR" : "➕ CADASTRAR ACESSO"} color={GREEN} onClick={salvar} disabled={salvando} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MINHA CONTA — conta Google, empresa e sair
════════════════════════════════════════════════════════════════════════ */
export function TelaMinhaConta({ usuario, empresa, onBack, onLogout }) {
  const [modalSair, setModalSair] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Minha Conta" sub="Conta Google e empresa" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a8a 100%)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 4px 16px rgba(15,33,81,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {usuario?.foto
              ? <img src={usuario.foto} alt="" referrerPolicy="no-referrer" style={{ width: 54, height: 54, borderRadius: 27, objectFit: "cover" }} />
              : <div style={{ width: 54, height: 54, borderRadius: 27, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👤</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuario?.nome || "—"}</div>
              <div style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuario?.email || "—"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(34,197,94,0.25)", border: "1px solid rgba(34,197,94,0.5)", borderRadius: 14, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>🔒 Conta Google</div>
            <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 14, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
              {usuario?.perfil === "gestor" ? "👔 Gestor" : `👷 ${usuario?.cargo || "Equipe"}`}
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🏢 Empresa vinculada</div>
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>
            <div><b>Razão social:</b> {empresa?.razaoSocial || "—"}</div>
            {empresa?.nomeFantasia && <div><b>Nome fantasia:</b> {empresa.nomeFantasia}</div>}
            <div><b>CNPJ:</b> {empresa?.cnpj || "—"}</div>
            {empresa?.endereco && <div style={{ marginTop: 4 }}><b>📍</b> {empresa.endereco}</div>}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>🚪 Sair desta conta</div>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 10, lineHeight: 1.5 }}>
            Para entrar de novo neste aparelho você vai precisar de internet e da mesma conta Google.
          </div>
          <button onClick={() => setModalSair(true)} className="km-btn-danger" style={{ width: "100%", padding: 12, background: "#fff", color: RED, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🚪 Sair da conta
          </button>
        </div>

        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: 12, fontSize: 11, color: "#075985", lineHeight: 1.5 }}>
          💡 A senha é a da sua conta Google e fica só no Google. Para trocar, use as configurações da sua conta Google (myaccount.google.com).
        </div>
      </div>
      <KMFooter />

      <Modal show={modalSair} title="🚪 Sair da conta?" onClose={() => setModalSair(false)}>
        <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 14 }}>
          Você vai precisar de internet para entrar de novo com o Google. Confirma?
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setModalSair(false)} style={{ flex: 1, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { setModalSair(false); onLogout && onLogout(true); }} className="km-btn-danger" style={{ flex: 1, padding: 12, background: RED, color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🚪 Sair</button>
        </div>
      </Modal>
    </div>
  );
}
