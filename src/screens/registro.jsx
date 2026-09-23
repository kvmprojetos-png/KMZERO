import { useState } from "react";
import { setEmpresaId, registrarEmpresa } from "../lib/store.js";
import { NAVY, GOLD, GREEN, labelS, inputS } from "../theme.js";

/* Cadastro da empresa. A pessoa já entrou com o Google (usuarioGoogle):
   aqui só faltam os dados da empresa e o nome como quer aparecer no app. */
export function TelaRegistro({ usuarioGoogle, onBack, onRegistrado }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [nomeGestor, setNomeGestor] = useState(usuarioGoogle?.nome || "");
  const [emp, setEmp] = useState({
    razaoSocial: "", nomeFantasia: "", cnpj: "", responsavel: usuarioGoogle?.nome || "",
    telefone: "", email: usuarioGoogle?.email || "", endereco: "",
  });
  const setE = (k, v) => setEmp(f => ({ ...f, [k]: v }));

  const validar = () => {
    if (!usuarioGoogle?.uid) return "Entre com o Google antes de criar a empresa.";
    if (!nomeGestor.trim()) return "Informe seu nome.";
    if (!emp.razaoSocial.trim()) return "Informe a razão social.";
    if (!emp.responsavel.trim()) return "Informe o responsável.";
    if (!emp.telefone.trim()) return "Informe o telefone.";
    return null;
  };

  const registrar = async () => {
    setErro("");
    const e = validar();
    if (e) return setErro(e);
    setCarregando(true);
    const empresaId = await registrarEmpresa(
      {
        razaoSocial: emp.razaoSocial.trim(),
        nomeFantasia: emp.nomeFantasia.trim(),
        cnpj: emp.cnpj.trim(),
        responsavel: emp.responsavel.trim(),
        telefone: emp.telefone.trim(),
        email: emp.email.trim() || usuarioGoogle.email,
        endereco: emp.endereco.trim(),
      },
      usuarioGoogle.uid,
      nomeGestor.trim(),
      usuarioGoogle.email,
      usuarioGoogle.foto || ""
    );
    setCarregando(false);
    if (!empresaId) {
      setErro("Não foi possível registrar a empresa na nuvem. Verifique a internet e tente de novo. Se continuar, as regras do Firebase podem não estar publicadas.");
      return;
    }
    setEmpresaId(empresaId);
    onRegistrado({
      id: usuarioGoogle.uid,
      firebaseUid: usuarioGoogle.uid,
      nome: nomeGestor.trim(),
      email: usuarioGoogle.email,
      foto: usuarioGoogle.foto || "",
      perfil: "gestor",
      cargo: "Gestor",
      obraId: null,
      empresaId,
      ultimoLogin: Date.now(),
    });
  };

  const cardStyle = {
    background: "rgba(255,255,255,0.1)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 18,
    padding: 22,
  };
  const lblStyle = { ...labelS, color: "rgba(255,255,255,0.85)" };
  const inpStyle = { ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" };

  return (
    <div style={{
      flex: 1, position: "relative", display: "flex", flexDirection: "column",
      justifyContent: "center", padding: "28px 24px", overflow: "hidden",
      background: "linear-gradient(125deg, #0f2151 0%, #1e3a8a 25%, #0f2151 50%, #2a1a4e 75%, #0f2151 100%)",
      minHeight: "100vh",
    }}>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 900, fontSize: 40, color: "#fff", letterSpacing: -2 }}>KM</span>
          <span style={{ fontWeight: 900, fontSize: 40, color: GOLD, letterSpacing: -2 }}>ZERO</span>
          <div style={{ height: 2, width: 50, background: GOLD, margin: "8px auto", borderRadius: 2 }} />
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Criar minha empresa</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>
            Você vai entrar sempre com a conta Google <b style={{ color: "#fff" }}>{usuarioGoogle?.email || "—"}</b>. Preencha os dados da construtora ou empresa.
          </div>

          <label style={lblStyle}>Seu nome (como aparece no app) *</label>
          <input value={nomeGestor} onChange={e => setNomeGestor(e.target.value)} placeholder="Seu nome" style={inpStyle} />

          <label style={lblStyle}>Razão social *</label>
          <input value={emp.razaoSocial} onChange={e => setE("razaoSocial", e.target.value)} placeholder="Ex: Construtora ABC Ltda" style={inpStyle} />

          <label style={lblStyle}>Nome fantasia</label>
          <input value={emp.nomeFantasia} onChange={e => setE("nomeFantasia", e.target.value)} placeholder="Ex: ABC Construções" style={inpStyle} />

          <label style={lblStyle}>CNPJ</label>
          <input value={emp.cnpj} onChange={e => setE("cnpj", e.target.value)} placeholder="00.000.000/0001-00" style={inpStyle} />

          <label style={lblStyle}>Responsável *</label>
          <input value={emp.responsavel} onChange={e => setE("responsavel", e.target.value)} placeholder="Nome do responsável" style={inpStyle} />

          <label style={lblStyle}>Telefone *</label>
          <input value={emp.telefone} onChange={e => setE("telefone", e.target.value)} placeholder="(00) 00000-0000" type="tel" style={inpStyle} />

          <label style={lblStyle}>E-mail da empresa</label>
          <input value={emp.email} onChange={e => setE("email", e.target.value)} placeholder="contato@empresa.com" type="email" style={inpStyle} />

          <label style={lblStyle}>Endereço</label>
          <input value={emp.endereco} onChange={e => setE("endereco", e.target.value)} placeholder="Rua, número, cidade - UF" style={inpStyle} />

          {erro && (
            <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, border: "1px solid rgba(214,59,59,0.4)" }}>
              {erro}
            </div>
          )}

          <button onClick={registrar} disabled={carregando} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            background: GREEN, color: "#fff", fontWeight: 800, cursor: carregando ? "default" : "pointer", fontSize: 15,
            marginTop: 4, boxShadow: "0 4px 20px rgba(34,197,94,0.4)", opacity: carregando ? 0.7 : 1,
          }}>
            {carregando ? "⏳ CRIANDO SUA EMPRESA..." : "CRIAR EMPRESA"}
          </button>

          <button onClick={onBack} disabled={carregando} style={{
            width: "100%", marginTop: 10, padding: 8, background: "transparent",
            border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer",
          }}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
