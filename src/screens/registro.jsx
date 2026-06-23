import { useState } from "react";
import { criarContaFirebase } from "../firebase.js";
import { setEmpresaId, registrarEmpresa } from "../lib/store.js";
import { NAVY, GOLD, GREEN, RED, BLUE, labelS, inputS } from "../theme.js";
import { KMFooter } from "../components/ui.jsx";

export function TelaRegistro({ onBack, onRegistrado }) {
  const [etapa, setEtapa] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [emp, setEmp] = useState({
    razaoSocial: "", nomeFantasia: "", cnpj: "", responsavel: "",
    telefone: "", email: "", endereco: "",
  });

  const [conta, setConta] = useState({
    nome: "", email: "", senha: "", confirmar: "",
  });

  const setE = (k, v) => setEmp(f => ({ ...f, [k]: v }));
  const setC = (k, v) => setConta(f => ({ ...f, [k]: v }));

  const validarEtapa1 = () => {
    if (!emp.razaoSocial.trim()) return "Informe a Razao Social.";
    if (!emp.responsavel.trim()) return "Informe o responsavel.";
    if (!emp.telefone.trim()) return "Informe o telefone.";
    return null;
  };

  const validarEtapa2 = () => {
    if (!conta.nome.trim()) return "Informe seu nome.";
    if (!conta.email.trim() || !conta.email.includes("@")) return "Informe um e-mail valido.";
    if (!conta.senha || conta.senha.length < 6) return "Senha deve ter no minimo 6 caracteres.";
    if (conta.senha !== conta.confirmar) return "Senhas nao conferem.";
    return null;
  };

  const avancar = () => {
    setErro("");
    const e = validarEtapa1();
    if (e) return setErro(e);
    setEtapa(2);
  };

  const registrar = async () => {
    setErro("");
    const e = validarEtapa2();
    if (e) return setErro(e);
    setCarregando(true);
    setEtapa(3);

    const r = await criarContaFirebase(conta.email.trim(), conta.senha);
    if (!r.ok) {
      setCarregando(false);
      setEtapa(2);
      setErro(r.erro || "Nao foi possivel criar a conta.");
      return;
    }

    const empresaId = await registrarEmpresa(
      {
        razaoSocial: emp.razaoSocial.trim(),
        nomeFantasia: emp.nomeFantasia.trim(),
        cnpj: emp.cnpj.trim(),
        responsavel: emp.responsavel.trim(),
        telefone: emp.telefone.trim(),
        email: emp.email.trim() || conta.email.trim(),
        endereco: emp.endereco.trim(),
      },
      r.user.uid,
      conta.nome.trim(),
      conta.email.trim()
    );

    if (!empresaId) {
      setCarregando(false);
      setEtapa(2);
      setErro("Erro ao registrar empresa. Tente novamente.");
      return;
    }

    setEmpresaId(empresaId);
    setCarregando(false);

    onRegistrado({
      id: r.user.uid,
      nome: conta.nome.trim(),
      email: conta.email.trim(),
      perfil: "gestor",
      obraId: null,
      empresaId,
      firebaseUid: r.user.uid,
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

        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 900, fontSize: 40, color: "#fff", letterSpacing: -2 }}>KM</span>
          <span style={{ fontWeight: 900, fontSize: 40, color: GOLD, letterSpacing: -2 }}>ZERO</span>
          <div style={{ height: 2, width: 50, background: GOLD, margin: "8px auto", borderRadius: 2 }} />
        </div>

        {/* PROGRESS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                background: etapa >= n ? GOLD : "rgba(255,255,255,0.15)",
                color: etapa >= n ? NAVY : "rgba(255,255,255,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800,
              }}>{n}</div>
              {n < 3 && <div style={{ width: 30, height: 2, background: etapa > n ? GOLD : "rgba(255,255,255,0.15)" }} />}
            </div>
          ))}
        </div>

        {/* ETAPA 1 — Dados da Empresa */}
        {etapa === 1 && (
          <div style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
              Dados da Empresa
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
              Cadastre as informacoes da sua construtora ou empresa.
            </div>

            <label style={lblStyle}>Razao Social *</label>
            <input value={emp.razaoSocial} onChange={e => setE("razaoSocial", e.target.value)} placeholder="Ex: Construtora ABC Ltda" style={inpStyle} />

            <label style={lblStyle}>Nome Fantasia</label>
            <input value={emp.nomeFantasia} onChange={e => setE("nomeFantasia", e.target.value)} placeholder="Ex: ABC Construcoes" style={inpStyle} />

            <label style={lblStyle}>CNPJ</label>
            <input value={emp.cnpj} onChange={e => setE("cnpj", e.target.value)} placeholder="00.000.000/0001-00" style={inpStyle} />

            <label style={lblStyle}>Responsavel *</label>
            <input value={emp.responsavel} onChange={e => setE("responsavel", e.target.value)} placeholder="Nome do responsavel" style={inpStyle} />

            <label style={lblStyle}>Telefone *</label>
            <input value={emp.telefone} onChange={e => setE("telefone", e.target.value)} placeholder="(00) 00000-0000" type="tel" style={inpStyle} />

            <label style={lblStyle}>E-mail da Empresa</label>
            <input value={emp.email} onChange={e => setE("email", e.target.value)} placeholder="contato@empresa.com" type="email" style={inpStyle} />

            <label style={lblStyle}>Endereco</label>
            <input value={emp.endereco} onChange={e => setE("endereco", e.target.value)} placeholder="Rua, numero, cidade - UF" style={inpStyle} />

            {erro && (
              <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, border: "1px solid rgba(214,59,59,0.4)" }}>
                {erro}
              </div>
            )}

            <button onClick={avancar} style={{
              width: "100%", padding: 14, borderRadius: 12, border: "none",
              background: GOLD, color: NAVY, fontWeight: 800, cursor: "pointer", fontSize: 15,
              marginTop: 4, boxShadow: "0 4px 20px rgba(245,166,35,0.4)",
            }}>
              PROXIMO
            </button>

            <button onClick={onBack} style={{
              width: "100%", marginTop: 10, padding: 8, background: "transparent",
              border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer",
            }}>
              Voltar ao login
            </button>
          </div>
        )}

        {/* ETAPA 2 — Conta do Gestor */}
        {etapa === 2 && (
          <div style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
              Criar Conta do Gestor
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
              Dados de acesso do responsavel pela empresa.
            </div>

            <label style={lblStyle}>Nome Completo *</label>
            <input value={conta.nome} onChange={e => setC("nome", e.target.value)} placeholder="Seu nome completo" style={inpStyle} />

            <label style={lblStyle}>E-mail (login) *</label>
            <input value={conta.email} onChange={e => setC("email", e.target.value)} placeholder="seu@email.com" type="email" autoComplete="email" style={inpStyle} />

            <label style={lblStyle}>Senha (min. 6 caracteres) *</label>
            <input value={conta.senha} onChange={e => setC("senha", e.target.value)} placeholder="Crie uma senha" type="password" autoComplete="new-password" style={inpStyle} />

            <label style={lblStyle}>Confirmar Senha *</label>
            <input value={conta.confirmar} onChange={e => setC("confirmar", e.target.value)} placeholder="Repita a senha" type="password" autoComplete="new-password" style={inpStyle} />

            {erro && (
              <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, border: "1px solid rgba(214,59,59,0.4)" }}>
                {erro}
              </div>
            )}

            <button onClick={registrar} style={{
              width: "100%", padding: 14, borderRadius: 12, border: "none",
              background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15,
              marginTop: 4, boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
            }}>
              CRIAR EMPRESA E CONTA
            </button>

            <button onClick={() => { setEtapa(1); setErro(""); }} style={{
              width: "100%", marginTop: 10, padding: 8, background: "transparent",
              border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer",
            }}>
              Voltar
            </button>
          </div>
        )}

        {/* ETAPA 3 — Processando */}
        {etapa === 3 && (
          <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {carregando ? "⏳" : "✅"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
              {carregando ? "Criando sua empresa..." : "Empresa criada!"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
              {carregando
                ? "Registrando dados no servidor. Aguarde..."
                : "Tudo pronto! Voce sera redirecionado ao painel."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
