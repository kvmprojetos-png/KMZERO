import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { loginFirebase, logoutFirebase, observarAutenticacao, recuperarSenha, atualizarSenha, usuarioAtual } from "../firebase.js";
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css } from "../theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm } from "../utils.js";
import { setEmpresaId, getEmpresaId, buscarEmpresaIdDoUsuario, cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, store } from "../lib/store.js";
import { FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "../lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "../lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, EMPRESA_TEMPLATE, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "../data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura } from "../components/ui.jsx";

export function TelaPerfilPIN({ usuario, onBack, onAtualizar }) {
  const [biometriaSuportada, setBiometriaSuportada] = useState(false);

  useEffect(() => {
    biometriaDisponivel().then(setBiometriaSuportada);
  }, []);

  const removerPIN = () => {
    if (!confirm("Remover seu PIN? Você precisará criá-lo novamente no próximo login.")) return;
    onAtualizar({ ...usuario, pin: "", biometriaAtiva: false });
    alert("✅ PIN removido. No próximo login, será solicitado um novo PIN.");
  };

  const trocarBiometria = () => {
    if (!biometriaSuportada) {
      alert("ℹ️ Seu dispositivo não suporta biometria ou o app está rodando dentro do Claude.ai (que bloqueia).\n\nPra usar Face ID / Touch ID, é necessário publicar o app como PWA (Vercel/Netlify).");
      return;
    }
    onAtualizar({ ...usuario, biometriaAtiva: !usuario.biometriaAtiva });
    alert(usuario.biometriaAtiva ? "✓ Biometria desativada" : "✓ Biometria ativada");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Meu PIN" sub={usuario.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Card usuário */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},#1e3a8a)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              {usuario.perfil === "gestor" ? "🏢" : "👷"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{usuario.nome}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{usuario.perfil === "gestor" ? "Gestor" : "Encarregado"}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{usuario.email}</div>
            </div>
          </div>
        </div>

        {/* Status do PIN */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${usuario.pin ? GREEN : ORANGE}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>🔐 PIN de Acesso</div>
            <div style={{ background: usuario.pin ? GREEN : ORANGE, color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 800 }}>
              {usuario.pin ? "✓ ATIVO" : "⚠️ NÃO CADASTRADO"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>
            {usuario.pin
              ? "Seu PIN de 4 dígitos está ativo. É solicitado a cada login."
              : "Sem PIN ainda. Será criado no próximo login."}
          </div>
          {usuario.pin && (
            <button onClick={removerPIN} style={{ width: "100%", marginTop: 10, padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              🗑️ Remover PIN (criar novo no próximo login)
            </button>
          )}
        </div>

        {/* Status biometria */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${usuario.biometriaAtiva ? GREEN : "#ccc"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>😊 Face ID / Touch ID</div>
            <div style={{ background: usuario.biometriaAtiva ? GREEN : "#ccc", color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 800 }}>
              {usuario.biometriaAtiva ? "✓ ATIVA" : "DESATIVADA"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
            {biometriaSuportada
              ? (usuario.biometriaAtiva
                  ? "Login automático com Face ID / Touch ID está ativo."
                  : "Seu dispositivo suporta biometria. Ative pra login mais rápido.")
              : "Dispositivo ou ambiente não suporta biometria."}
          </div>
          {biometriaSuportada && (
            <button onClick={trocarBiometria} style={{ width: "100%", padding: 10, background: usuario.biometriaAtiva ? "#fef2f2" : GREEN, color: usuario.biometriaAtiva ? RED : "#fff", border: usuario.biometriaAtiva ? `1px solid ${RED}33` : "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              {usuario.biometriaAtiva ? "🔓 Desativar biometria" : "🔒 Ativar biometria"}
            </button>
          )}
          {!biometriaSuportada && (
            <div style={{ background: "#fef9e7", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "#8b6f00", marginTop: 4 }}>
              💡 Pra usar biometria: publique o app como PWA (Vercel) e abra no Safari. Dentro do Claude.ai não funciona.
            </div>
          )}
        </div>

        {/* Info segurança */}
        <div style={{ background: "#f0f7ff", borderRadius: 12, padding: 12, fontSize: 11, color: "#0c4a6e", lineHeight: 1.5 }}>
          🔒 <b>Segurança:</b><br/>
          • PIN é salvo localmente no dispositivo<br/>
          • Cada usuário tem PIN próprio<br/>
          • Email/senha ainda funcionam como fallback<br/>
          • Após 3 tentativas erradas, app sugere usar email/senha
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   PIN — Login com 4 dígitos + biometria preparada
════════════════════════════════════ */

// Detecta se o dispositivo SUPORTA biometria via WebAuthn
async function biometriaDisponivel() {
  try {
    if (!window.PublicKeyCredential) return false;
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
    const ok = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return !!ok;
  } catch (e) {
    return false;
  }
}

// Dispara biometria nativa (Face ID / Touch ID) — SÓ funciona em PWA/HTTPS
async function autenticarComBiometria(usuario) {
  try {
    if (!window.PublicKeyCredential) throw new Error("WebAuthn não suportado");

    // Em produção isso seria challenge servidor. Aqui é demo local.
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credentialOptions = {
      publicKey: {
        challenge,
        rp: { name: "KMZERO" },
        user: {
          id: new TextEncoder().encode(String(usuario.id)),
          name: usuario.email,
          displayName: usuario.nome,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 30000,
      }
    };

    const credential = await navigator.credentials.create(credentialOptions);
    return !!credential;
  } catch (e) {
    console.warn("Biometria falhou:", e);
    return false;
  }
}


export function TelaPIN({ usuario, modo, onSucesso, onCancelar, onCriarPIN }) {
  // modo: "digitar" (já tem pin), "criar" (sem pin ainda), "confirmar" (após criar)
  const [pin, setPin] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [pinConfirma, setPinConfirma] = useState("");
  const [etapa, setEtapa] = useState(modo === "criar" ? "novo" : modo === "confirmar" ? "confirmar" : "digitar");
  const [erro, setErro] = useState("");
  const [tentativas, setTentativas] = useState(0);
  const [biometriaSuportada, setBiometriaSuportada] = useState(false);

  // Detecta biometria ao carregar
  useEffect(() => {
    biometriaDisponivel().then(setBiometriaSuportada);
  }, []);

  // Se já tem PIN e biometria ativa, tenta biometria primeiro
  useEffect(() => {
    if (etapa === "digitar" && usuario.biometriaAtiva && biometriaSuportada) {
      setTimeout(async () => {
        const ok = await autenticarComBiometria(usuario);
        if (ok) onSucesso();
      }, 300);
    }
  }, [biometriaSuportada]);

  const valorAtual = etapa === "digitar" ? pin : etapa === "novo" ? pinNovo : pinConfirma;

  const adicionar = (n) => {
    setErro("");
    if (etapa === "digitar") {
      if (pin.length >= 4) return;
      const novoPin = pin + n;
      setPin(novoPin);
      if (novoPin.length === 4) {
        // Valida
        setTimeout(() => {
          if (novoPin === usuario.pin) {
            onSucesso();
          } else {
            setTentativas(t => t + 1);
            setErro("PIN incorreto");
            setPin("");
            // Vibração no celular se disponível
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          }
        }, 150);
      }
    } else if (etapa === "novo") {
      if (pinNovo.length >= 4) return;
      const novo = pinNovo + n;
      setPinNovo(novo);
      if (novo.length === 4) {
        setTimeout(() => setEtapa("confirmar"), 200);
      }
    } else if (etapa === "confirmar") {
      if (pinConfirma.length >= 4) return;
      const conf = pinConfirma + n;
      setPinConfirma(conf);
      if (conf.length === 4) {
        setTimeout(() => {
          if (conf === pinNovo) {
            // Pergunta sobre biometria se suportada
            if (biometriaSuportada) {
              if (confirm("✅ PIN criado!\n\n📱 Seu dispositivo suporta Face ID / Touch ID.\nDeseja ativar biometria pra login mais rápido?\n\n(Funciona quando o app estiver publicado no Vercel/PWA)")) {
                onCriarPIN(pinNovo, true);
              } else {
                onCriarPIN(pinNovo, false);
              }
            } else {
              onCriarPIN(pinNovo, false);
            }
          } else {
            setErro("PINs não coincidem. Tente novamente.");
            setPinNovo("");
            setPinConfirma("");
            setEtapa("novo");
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          }
        }, 150);
      }
    }
  };

  const apagar = () => {
    setErro("");
    if (etapa === "digitar") setPin(p => p.slice(0, -1));
    else if (etapa === "novo") setPinNovo(p => p.slice(0, -1));
    else setPinConfirma(p => p.slice(0, -1));
  };

  const limpar = () => {
    setErro("");
    if (etapa === "digitar") setPin("");
    else if (etapa === "novo") setPinNovo("");
    else setPinConfirma("");
  };

  const titulo = etapa === "digitar" ? "Digite seu PIN" : etapa === "novo" ? "Criar PIN de 4 dígitos" : "Confirme seu PIN";
  const subtitulo = etapa === "digitar" ? "Para acessar o app" : etapa === "novo" ? "Escolha 4 números fáceis de lembrar" : "Digite o mesmo PIN de novo";

  return (
    <div style={{ flex: 1, background: `linear-gradient(175deg,${NAVY} 0%,#071030 100%)`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 24px", color: "#fff" }}>
      {/* Cabeçalho */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 68, height: 68, borderRadius: 34, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 10px" }}>
          {usuario.perfil === "gestor" ? "🏢" : "👷"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{usuario.nome}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{usuario.perfil === "gestor" ? "Gestor" : "Encarregado"}</div>
      </div>

      {/* Título do estado */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{titulo}</div>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>{subtitulo}</div>
      </div>

      {/* Indicador dos 4 dígitos */}
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 14 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 8,
            border: `2px solid ${erro ? RED : "rgba(255,255,255,0.4)"}`,
            background: valorAtual.length > i ? (erro ? RED : "#fff") : "transparent",
            transition: "all 0.15s",
          }} />
        ))}
      </div>

      {/* Erro */}
      {erro && (
        <div style={{ textAlign: "center", color: "#ff8a8a", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
          ⚠️ {erro} {tentativas >= 3 && "(Tente o login com email/senha)"}
        </div>
      )}

      {/* Biometria — botão se disponível e estiver no modo digitar */}
      {etapa === "digitar" && biometriaSuportada && usuario.biometriaAtiva && (
        <button onClick={async () => { const ok = await autenticarComBiometria(usuario); if (ok) onSucesso(); else setErro("Biometria falhou. Use o PIN."); }} style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff", padding: "10px 14px", borderRadius: 12, marginBottom: 14,
          cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>
          😊 Entrar com Face ID / Touch ID
        </button>
      )}

      {/* Teclado numérico */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 280, margin: "0 auto", width: "100%" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} onClick={() => adicionar(String(n))} style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff", fontSize: 22, fontWeight: 700,
            padding: "16px 0", borderRadius: 14, cursor: "pointer",
            transition: "all 0.1s",
          }}>{n}</button>
        ))}
        <button onClick={limpar} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700,
          padding: "16px 0", borderRadius: 14, cursor: "pointer",
        }}>LIMPAR</button>
        <button onClick={() => adicionar("0")} style={{
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff", fontSize: 22, fontWeight: 700,
          padding: "16px 0", borderRadius: 14, cursor: "pointer",
        }}>0</button>
        <button onClick={apagar} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)", fontSize: 18, fontWeight: 700,
          padding: "16px 0", borderRadius: 14, cursor: "pointer",
        }}>⌫</button>
      </div>

      {/* Voltar */}
      <button onClick={onCancelar} style={{
        background: "transparent", border: "none", color: "rgba(255,255,255,0.5)",
        marginTop: 18, cursor: "pointer", fontSize: 12, fontWeight: 600,
      }}>← Trocar usuário</button>

      {/* Aviso biometria pra quando tiver suporte mas não estiver ativa */}
      {etapa === "digitar" && biometriaSuportada && !usuario.biometriaAtiva && tentativas === 0 && (
        <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 14 }}>
          💡 Seu dispositivo suporta biometria
        </div>
      )}
    </div>
  );
}

// Encarregados usam "usuário" (sem @); o Firebase Auth exige email — mapeia p/ email interno
const emailAuthKM = (e) => { const v = String(e || "").trim().toLowerCase(); return v.includes("@") ? v : v + "@kmzero.app"; };


export function TelaLogin({ usuarios, obras = [], onLogin, onAtualizarUsuario, onCadastrar, onRegistro }) {
  const [tipo, setTipo] = useState("encarregado");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [modoForm, setModoForm] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [modoPIN, setModoPIN] = useState(null);
  const [tela, setTelaInterna] = useState("inicial"); // "inicial" | "gestor" | "primeiro_acesso"
  const [emailPrim, setEmailPrim] = useState("");
  const [senhaPrim, setSenhaPrim] = useState("");
  const [emailGestor, setEmailGestor] = useState("");
  const [senhaGestor, setSenhaGestor] = useState("");

  // Busca último usuário logado pra mostrar de cara o PIN
  const [ultimoUsuario, setUltimoUsuario] = useState(null);
  useEffect(() => {
    const u = usuarios.find(x => x.ultimoLogin);
    if (u) setUltimoUsuario(u);
  }, [usuarios]);

  const [carregando, setCarregando] = useState(false);

  const entrarGestor = async () => {
    setErro("");
    if (!emailGestor || !senhaGestor) {
      return setErro("Preencha email e senha.");
    }
    setCarregando(true);

    const r = await loginFirebase(emailGestor.trim(), senhaGestor);
    if (r.ok) {
      const empresaId = await buscarEmpresaIdDoUsuario(r.user.uid);
      if (!empresaId) {
        setCarregando(false);
        setErro("Conta sem empresa vinculada. Faca o cadastro primeiro.");
        return;
      }
      setEmpresaId(empresaId);

      let u = usuarios.find(x => x.email.toLowerCase() === r.user.email.toLowerCase() && x.perfil === "gestor");
      if (!u) {
        u = {
          id: r.user.uid,
          nome: "Gestor",
          email: r.user.email,
          perfil: "gestor",
          ativo: true,
          firebaseUid: r.user.uid,
        };
      }
      setCarregando(false);
      onLogin({ ...u, firebaseUid: r.user.uid, empresaId, ultimoLogin: Date.now() });
      return;
    }

    setCarregando(false);
    setErro(r.erro || "Email ou senha incorretos.");
  };

  const entrarPrimeiroAcesso = async () => {
    setErro("");
    const u = usuarios.find(u => u.email.toLowerCase() === emailPrim.toLowerCase().trim() && u.senha === senhaPrim && u.perfil !== "gestor");
    if (!u) return setErro("Acesso não encontrado. Confirme com o gestor o e-mail e senha cadastrados.");
    setCarregando(true);
    const r = await loginFirebase(emailAuthKM(u.email), senhaPrim);
    if (r.ok) {
      const empresaId = await buscarEmpresaIdDoUsuario(r.user.uid);
      if (empresaId) setEmpresaId(empresaId);
      const cachedEid = empresaId || u.empresaId || localStorage.getItem("_kmzero_empresaId");
      setCarregando(false);
      onLogin({ ...u, firebaseUid: r.user.uid, empresaId: cachedEid, ultimoLogin: Date.now() });
      return;
    }
    if (r.codigo === "auth/network-request-failed") {
      const cachedEid = u.empresaId || localStorage.getItem("_kmzero_empresaId");
      if (cachedEid) setEmpresaId(cachedEid);
      setCarregando(false);
      onLogin({ ...u, empresaId: cachedEid, ultimoLogin: Date.now() });
      return;
    }
    setCarregando(false);
    setErro(r.erro || "Não foi possível autenticar. Tente novamente.");
  };

  const entrarComPIN = (u) => {
    if (u.perfil === "gestor") {
      setEmailGestor(u.email || "");
      setTelaInterna("gestor");
      return;
    }
    const fbUser = usuarioAtual();
    if (!fbUser || fbUser.isAnonymous) {
      setEmailPrim(u.email || "");
      setTelaInterna("primeiro_acesso");
      return;
    }
    const cachedEid = u.empresaId || localStorage.getItem("_kmzero_empresaId");
    if (cachedEid) setEmpresaId(cachedEid);
    onLogin({ ...u, firebaseUid: u.firebaseUid || fbUser.uid, empresaId: cachedEid, ultimoLogin: Date.now() });
  };

  if (modoPIN && usuarioSelecionado) {
    return (
      <TelaPIN
        usuario={usuarioSelecionado}
        modo={modoPIN}
        onSucesso={() => onLogin({ ...usuarioSelecionado, ultimoLogin: Date.now() })}
        onCancelar={() => { setUsuarioSelecionado(null); setModoPIN(null); setTelaInterna("inicial"); }}
        onCriarPIN={(pin, biometriaAtiva) => {
          const atualizado = { ...usuarioSelecionado, pin, biometriaAtiva, ultimoLogin: Date.now() };
          if (onAtualizarUsuario) onAtualizarUsuario(atualizado);
          onLogin(atualizado);
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "28px 24px", paddingTop: "max(28px, env(safe-area-inset-top, 28px))", paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))", overflow: "hidden" }}>
      {/* CSS animation injetado */}
      <style>{`
        @keyframes kmGradiente {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes kmFlutua {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
        @keyframes kmPulsa {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes kmFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes kmBrilhoLogo {
          0%, 100% { text-shadow: 0 4px 20px rgba(245,166,35,0.4), 0 0 30px rgba(245,166,35,0.2); }
          50% { text-shadow: 0 4px 30px rgba(245,166,35,0.7), 0 0 50px rgba(245,166,35,0.4); }
        }
        @keyframes kmRaioLuz {
          0% { transform: translateX(-150%) skewX(-20deg); opacity: 0; }
          40%, 60% { opacity: 1; }
          100% { transform: translateX(250%) skewX(-20deg); opacity: 0; }
        }
        @keyframes kmParticula {
          0% { transform: translateY(100vh) translateX(0); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-10vh) translateX(20px); opacity: 0; }
        }
        @keyframes kmLinhaBrilho {
          0% { box-shadow: 0 0 8px rgba(245,166,35,0.4); transform: scaleX(0.8); }
          50% { box-shadow: 0 0 18px rgba(245,166,35,0.9); transform: scaleX(1.1); }
          100% { box-shadow: 0 0 8px rgba(245,166,35,0.4); transform: scaleX(0.8); }
        }
        .km-bg-anim {
          background: linear-gradient(125deg, #0f2151 0%, #1e3a8a 25%, #0f2151 50%, #2a1a4e 75%, #0f2151 100%);
          background-size: 300% 300%;
          animation: kmGradiente 18s ease infinite;
        }
        .km-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          pointer-events: none;
        }
        .km-orb-1 {
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(245,166,35,0.4), transparent 70%);
          top: -60px; right: -60px;
          animation: kmFlutua 9s ease-in-out infinite, kmPulsa 6s ease-in-out infinite;
        }
        .km-orb-2 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(124,58,237,0.35), transparent 70%);
          bottom: -40px; left: -40px;
          animation: kmFlutua 11s ease-in-out infinite reverse, kmPulsa 7s ease-in-out infinite;
        }
        .km-orb-3 {
          width: 180px; height: 180px;
          background: radial-gradient(circle, rgba(56,189,248,0.3), transparent 70%);
          top: 40%; left: -50px;
          animation: kmFlutua 13s ease-in-out infinite, kmPulsa 8s ease-in-out infinite;
        }
        .km-card-anim { animation: kmFadeIn 0.5s ease-out; }
        .km-btn-glow {
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(245,166,35,0.4);
        }
        .km-btn-glow:active {
          transform: scale(0.97);
          box-shadow: 0 2px 10px rgba(245,166,35,0.6);
        }
        /* Acessibilidade mobile: melhor toque e área mínima em campos */
        button { touch-action: manipulation; }
        input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        select, textarea { min-height: 44px; box-sizing: border-box; }
        /* Botão destrutivo: borda vermelha discreta + animação no hover */
        .km-btn-danger {
          border: 2px solid rgba(220,38,38,0.6) !important;
          transition: all 0.15s ease;
        }
        .km-btn-danger:hover:not([disabled]) {
          border-color: rgba(220,38,38,1) !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.15) !important;
        }
        .km-btn-danger:active:not([disabled]) {
          transform: scale(0.97);
        }
        /* ONDA 2 — Efeitos sofisticados da tela de boas-vindas */
        .km-logo-zero {
          animation: kmBrilhoLogo 4s ease-in-out infinite;
        }
        .km-linha-dourada {
          animation: kmLinhaBrilho 3s ease-in-out infinite;
          transform-origin: center;
        }
        .km-raio-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .km-raio {
          position: absolute;
          top: 0; left: 0;
          width: 200px; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 40%, rgba(245,166,35,0.08) 50%, rgba(255,255,255,0.04) 60%, transparent 100%);
          animation: kmRaioLuz 12s ease-in-out infinite;
        }
        .km-raio-2 {
          animation-delay: 6s;
          animation-duration: 16s;
          opacity: 0.6;
        }
        .km-particula {
          position: absolute;
          width: 3px; height: 3px;
          background: rgba(245,166,35,0.6);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(0.5px);
        }
        .km-particula-1 { left: 10%; animation: kmParticula 14s linear infinite; }
        .km-particula-2 { left: 25%; animation: kmParticula 18s linear infinite 3s; }
        .km-particula-3 { left: 45%; animation: kmParticula 12s linear infinite 7s; }
        .km-particula-4 { left: 65%; animation: kmParticula 16s linear infinite 1s; }
        .km-particula-5 { left: 80%; animation: kmParticula 20s linear infinite 5s; }
        .km-particula-6 { left: 92%; animation: kmParticula 15s linear infinite 9s; }
        /* Cartão de continuar como — efeito de glassmorphism elevado */
        .km-card-glass {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.18);
          transition: all 0.3s ease;
        }
        .km-card-glass:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(245,166,35,0.5);
          box-shadow: 0 6px 30px rgba(245,166,35,0.15);
          transform: translateY(-2px);
        }
        .km-card-glass:active { transform: translateY(0); }
        /* Botão Sou Gestor com aura dourada animada */
        .km-btn-gestor {
          position: relative;
          overflow: hidden;
        }
        .km-btn-gestor::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(135deg, rgba(245,166,35,0.8), rgba(255,200,80,0.4), rgba(245,166,35,0.8));
          background-size: 200% 200%;
          animation: kmGradiente 6s ease infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.7;
        }
        /* Respeita preferência de redução de movimento */
        @media (prefers-reduced-motion: reduce) {
          .km-bg-anim, .km-orb, .km-logo-zero, .km-linha-dourada,
          .km-raio, .km-particula, .km-btn-gestor::before {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background animado */}
      <div className="km-bg-anim" style={{ position: "absolute", inset: 0, zIndex: 0 }} />
      <div className="km-orb km-orb-1" />
      <div className="km-orb km-orb-2" />
      <div className="km-orb km-orb-3" />

      {/* ONDA 2 — Raios de luz cruzando o fundo (sutis) */}
      <div className="km-raio-container">
        <div className="km-raio" />
        <div className="km-raio km-raio-2" />
      </div>

      {/* ONDA 2 — Partículas douradas subindo (efeito canteiro de obra) */}
      <div className="km-raio-container">
        <div className="km-particula km-particula-1" />
        <div className="km-particula km-particula-2" />
        <div className="km-particula km-particula-3" />
        <div className="km-particula km-particula-4" />
        <div className="km-particula km-particula-5" />
        <div className="km-particula km-particula-6" />
      </div>

      {/* Conteúdo */}
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 28 }} className="km-card-anim">
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: 4, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
            🏗️ Gestão de Obras
          </div>
          <div>
            <span style={{ fontWeight: 900, fontSize: 56, color: "#fff", letterSpacing: -2, textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>KM</span>
            <span className="km-logo-zero" style={{ fontWeight: 900, fontSize: 56, color: GOLD, letterSpacing: -2, display: "inline-block" }}>ZERO</span>
          </div>
          <div className="km-linha-dourada" style={{ height: 2, width: 60, background: GOLD, margin: "10px auto", borderRadius: 2 }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>
            Gestao Inteligente de Obras
          </div>
        </div>

        {/* TELA INICIAL — MOSTRA ÚLTIMO USUÁRIO + BOTÕES */}
        {tela === "inicial" && (
          <div className="km-card-anim">

            {/* Se tem último usuário logado, mostra acesso direto */}
            {ultimoUsuario && (
              <div onClick={() => entrarComPIN(ultimoUsuario)} className="km-card-glass" style={{
                borderRadius: 16,
                padding: "16px 18px",
                marginBottom: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              }}>
                <div style={{ width: 50, height: 50, borderRadius: 25, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "0 4px 14px rgba(245,166,35,0.5)" }}>
                  {ultimoUsuario.perfil === "gestor" ? "🏢" : "👷"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 600, textTransform: "uppercase" }}>Continuar como</div>
                  <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ultimoUsuario.nome}</div>
                  <div style={{ fontSize: 10, color: GOLD, fontWeight: 600, marginTop: 2 }}>👆 Toque pra entrar</div>
                </div>
                <span style={{ color: "#fff", fontSize: 24, opacity: 0.7 }}>›</span>
              </div>
            )}

            {/* Texto de boas-vindas */}
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 18, marginBottom: 14, lineHeight: 1.6 }}>
              👤 Toque no seu perfil pra entrar:
            </div>

            {/* LISTA DE ENCARREGADOS — perfis cadastrados pelo gestor */}
            {(() => {
              const lancadores = usuarios.filter(u => u.perfil !== "gestor");
              if (lancadores.length === 0) {
                return (
                  <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 1.6, border: "1px dashed rgba(255,255,255,0.15)" }}>
                    👷 Nenhum lançador cadastrado ainda.<br/>
                    O gestor pode cadastrar em <b>👥 Acessos do App → + Adicionar</b>
                  </div>
                );
              }
              return (
                <div style={{ marginBottom: 14 }}>
                  {lancadores.map(u => {
                    const obra = obras.find(o => o.id === u.obraId);
                    const cores = ["#0891b2", "#7c3aed", "#16a34a", "#dc2626", "#e87722", "#0284c7", "#9333ea"];
                    const cor = cores[u.id % cores.length];
                    const iniciais = u.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <button key={u.id} onClick={() => entrarComPIN(u)} className="km-btn-glow" style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        marginBottom: 8,
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                      }}>
                        <div style={{ width: 42, height: 42, borderRadius: 21, background: cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, color: "#fff", boxShadow: `0 2px 8px ${cor}80` }}>
                          {iniciais}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            👷 {u.cargo || "Encarregado"}{obra ? ` · ${obra.nome.substring(0, 30)}` : ""}
                          </div>
                        </div>
                        <span style={{ opacity: 0.6, fontSize: 16 }}>›</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Divisor */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px", color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
              GESTÃO
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Botão: Sou gestor — abre a tela de email/senha (Firebase) */}
            <button onClick={() => setTelaInterna("gestor")} className="km-btn-glow" style={{
              width: "100%",
              padding: "16px 18px",
              borderRadius: 14,
              border: "none",
              background: GOLD,
              color: NAVY,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              boxShadow: "0 4px 20px rgba(245,166,35,0.5)",
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", flexShrink: 0 }}>🏢</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Entrar como Gestor</div>
                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 1 }}>Acesso com e-mail e senha</div>
              </div>
              <span style={{ opacity: 0.7 }}>›</span>
            </button>

            {/* Botão: Criar empresa */}
            {onRegistro && (
              <button onClick={onRegistro} style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", flexShrink: 0 }}>+</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Criar minha empresa</div>
                  <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>Cadastro gratuito</div>
                </div>
                <span style={{ opacity: 0.5 }}>›</span>
              </button>
            )}

            <div style={{ marginTop: 24, padding: 14, background: "rgba(255,255,255,0.05)", borderRadius: 12, fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 1.6 }}>
              Equipe sem acesso? Peca pro gestor cadastrar voce na Equipe.
            </div>
          </div>
        )}

        {/* TELA GESTOR — login email + senha */}
        {tela === "gestor" && (
          <div className="km-card-anim" style={{
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 18,
            padding: 22,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <button onClick={() => { setTelaInterna("inicial"); setErro(""); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>‹</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Acesso Gestor</div>
                <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, marginTop: 2 }}>🏢 Entrar na Empresa</div>
              </div>
            </div>

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>📧 E-mail</label>
            <input value={emailGestor} onChange={e => setEmailGestor(e.target.value)} type="email" placeholder="seu@email.com" autoComplete="email" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>🔑 Senha</label>
            <input value={senhaGestor} onChange={e => setSenhaGestor(e.target.value)} type="password" placeholder="••••••" autoComplete="current-password" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            {erro && (
              <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, border: "1px solid rgba(214,59,59,0.4)" }}>
                ⚠️ {erro}
              </div>
            )}

            <button
              onClick={entrarGestor}
              disabled={carregando}
              className="km-btn-glow"
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "none",
                background: carregando ? "rgba(192,160,64,0.5)" : GOLD,
                color: NAVY,
                fontWeight: 800,
                cursor: carregando ? "wait" : "pointer",
                fontSize: 15,
              }}
            >
              {carregando ? "Verificando..." : "▶  ENTRAR"}
            </button>

            <button
              onClick={async () => {
                if (!emailGestor) {
                  setErro("Digite seu email para receber o link de recuperação.");
                  return;
                }
                const r = await recuperarSenha(emailGestor.trim());
                if (r.ok) {
                  alert("Enviamos um link de recuperação para " + emailGestor + ". Verifique sua caixa de entrada e a pasta de spam.");
                } else {
                  setErro(r.erro || "Não foi possível enviar o email de recuperação.");
                }
              }}
              style={{
                width: "100%",
                marginTop: 10,
                padding: 8,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        {/* TELA PRIMEIRO ACESSO ENCARREGADO */}
        {tela === "primeiro_acesso" && (
          <div className="km-card-anim" style={{
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 18,
            padding: 22,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setTelaInterna("inicial"); setErro(""); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>‹</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Acesso Equipe</div>
                <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, marginTop: 2 }}>👷 Primeiro Acesso</div>
              </div>
            </div>

            <div style={{ background: "rgba(56,189,248,0.15)", color: "#bae6fd", padding: 12, borderRadius: 10, fontSize: 11, marginBottom: 14, border: "1px solid rgba(56,189,248,0.3)", lineHeight: 1.5 }}>
              💡 Use o e-mail e senha que o <b>gestor te passou</b>. No primeiro acesso, você cria seu PIN de 4 dígitos.
            </div>

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>📧 E-mail (informado pelo gestor)</label>
            <input value={emailPrim} onChange={e => setEmailPrim(e.target.value)} type="email" placeholder="exemplo@km.com" autoComplete="email" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>🔑 Senha temporária</label>
            <input value={senhaPrim} onChange={e => setSenhaPrim(e.target.value)} type="password" placeholder="123" autoComplete="current-password" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            {erro && (
              <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, border: "1px solid rgba(214,59,59,0.4)" }}>
                ⚠️ {erro}
              </div>
            )}

            <button onClick={entrarPrimeiroAcesso} className="km-btn-glow" style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: BLUE, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
              CRIAR MEU PIN  ▶
            </button>

            <div style={{ marginTop: 14, fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.5 }}>
              Não tem acesso? Pede pro gestor te cadastrar em <b>👥 Equipe → + Adicionar</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════════════
   HOME ENCARREGADO
════════════════════════════════════ */

export function TelaAcessosApp({ usuarios, obras, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "123",
    cargo: "Encarregado",
    obraId: "",
    perfil: "encarregado",
    tel: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: "", email: "", senha: "123", cargo: "Encarregado", obraId: "", perfil: "encarregado", tel: "" });
    setModal(true);
  };

  const abrirEdicao = (u) => {
    setEditando(u);
    setForm({
      nome: u.nome || "",
      email: u.email || "",
      senha: u.senha || "123",
      cargo: u.cargo || "Encarregado",
      obraId: u.obraId || "",
      perfil: u.perfil || "encarregado",
      tel: u.tel || "",
    });
    setModal(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) { alert("⚠️ Informe o nome"); return; }
    if (!form.email.trim()) { alert("⚠️ Informe o e-mail"); return; }
    if (!form.senha.trim()) { alert("⚠️ Informe a senha"); return; }
    if (form.perfil !== "gestor" && !form.obraId) { alert("⚠️ Selecione a obra deste acesso.\n\nSem obra vinculada, o encarregado não vê a equipe nem os pedidos certos."); return; }

    if (editando) {
      // Edição
      onEditar({ ...editando, ...form, obraId: form.obraId ? parseInt(form.obraId) : null });
      alert(`✅ Acesso atualizado!\n\n${form.nome}\n📧 ${form.email}\n🔑 ${form.senha}`);
    } else {
      // Novo
      const jaExiste = usuarios.find(u => u.email.toLowerCase() === form.email.toLowerCase().trim());
      if (jaExiste) { alert("⚠️ Já existe um acesso com esse e-mail"); return; }
      const novo = {
        id: Date.now(),
        nome: form.nome.trim(),
        email: form.email.toLowerCase().trim(),
        senha: form.senha,
        cargo: form.cargo,
        obraId: form.obraId ? parseInt(form.obraId) : null,
        perfil: form.perfil,
        tel: form.tel,
        pin: "",
        biometriaAtiva: false,
      };
      onAdd(novo);
      alert(`✅ Acesso criado!\n\n👤 ${novo.nome}\n📧 ${novo.email}\n🔑 Senha: ${novo.senha}\n\nPasse esses dados pra pessoa.\nAo abrir o app, ela toca no perfil dela.`);
    }
    setModal(false);
  };

  const remover = (u) => {
    confirmar(`⚠️ Remover acesso de ${u.nome}?\n\nA pessoa NÃO conseguirá mais entrar no app.\n(Dados de presença, RDOs, etc continuam preservados)`, () => {
      onRemover(u.id);
    });
  };

  const cores = ["#0891b2", "#7c3aed", "#16a34a", "#dc2626", "#e87722", "#0284c7", "#9333ea", "#0d9488"];
  const gestores = usuarios.filter(u => u.perfil === "gestor");
  const lancadores = usuarios.filter(u => u.perfil !== "gestor");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Acessos do App" sub={`${usuarios.length} usuário(s)`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD EXPLICATIVO */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},#1e3a8a)`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🔑</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Acessos do App</div>
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4, lineHeight: 1.5 }}>
            Aqui você cria os perfis dos lançadores (encarregados, apontadores).
            Cada um vai aparecer na tela inicial do app.
          </div>
        </div>

        {/* BOTÃO ADICIONAR */}
        <button onClick={abrirNovo} style={{ width: "100%", padding: 14, background: GOLD, color: NAVY, border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16, boxShadow: "0 3px 10px rgba(245,166,35,0.3)" }}>
          ➕ ADICIONAR LANÇADOR
        </button>

        {/* GESTORES */}
        {gestores.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>
              🏢 GESTORES ({gestores.length})
            </div>
            {gestores.map(u => {
              const iniciais = u.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${GOLD}`, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: GOLD, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {iniciais}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>📧 {u.email}</div>
                  </div>
                  <button onClick={() => abrirEdicao(u)} style={{ background: "#f5f7fa", border: "1px solid #ddd", color: NAVY, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️</button>
                </div>
              );
            })}
          </>
        )}

        {/* LANÇADORES */}
        <div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4, marginTop: 16 }}>
          👷 LANÇADORES ({lancadores.length})
        </div>

        {lancadores.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", border: "2px dashed #ddd" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
              Nenhum lançador cadastrado.<br/>
              Toque em <b>"➕ ADICIONAR LANÇADOR"</b> acima.
            </div>
          </div>
        ) : (
          lancadores.map(u => {
            const iniciais = u.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
            const cor = cores[u.id % cores.length];
            const obra = obras.find(o => o.id === u.obraId);
            return (
              <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {iniciais}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      👷 {u.cargo || "Encarregado"}{obra ? ` · ${obra.nome}` : " · sem obra"}
                    </div>
                  </div>
                </div>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 8, marginBottom: 8, fontSize: 10, color: "#666", fontFamily: "monospace" }}>
                  📧 {u.email}<br/>
                  🔑 Senha: <b>{u.senha}</b>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => abrirEdicao(u)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                  <button onClick={() => remover(u)} style={{ background: "#fee2e2", color: RED, border: `2px solid ${RED}`, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🗑️</button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <KMFooter />

      {/* MODAL CRIAR / EDITAR */}
      <Modal show={modal} title={editando ? "Editar Acesso" : "Novo Lançador"} onClose={() => setModal(false)}>
        <label style={labelS}>👤 Nome Completo</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome do lançador" style={inputS} />

        <label style={labelS}>👷 Cargo / Função</label>
        <select value={form.cargo} onChange={e => set("cargo", e.target.value)} style={selS}>
          <option>Encarregado</option>
          <option>Apontador</option>
          <option>Mestre de Obras</option>
          <option>Técnico</option>
          <option>Supervisor</option>
          <option>Outro</option>
        </select>

        <label style={labelS}>🏗️ Obra que vai gerenciar</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value === "" ? "" : parseInt(e.target.value))} style={selS}>
          <option value="">Sem obra fixa</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>📞 Telefone (opcional)</label>
        <input value={form.tel} onChange={e => set("tel", e.target.value)} placeholder="(28) 9 9999-9999" style={inputS} />

        <div style={{ background: "#f0f9ff", borderRadius: 10, padding: 12, marginBottom: 10, border: "1px solid #bae6fd" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🔐 Dados de Acesso</div>

          <label style={labelS}>📧 E-mail (login)</label>
          <input value={form.email} onChange={e => set("email", e.target.value)} type="email" placeholder="exemplo@gmail.com" autoComplete="off" style={inputS} />

          <label style={labelS}>🔑 Senha temporária</label>
          <input value={form.senha} onChange={e => set("senha", e.target.value)} placeholder="123" autoComplete="off" style={inputS} />

          <div style={{ fontSize: 10, color: "#0c4a6e", lineHeight: 1.5 }}>
            💡 Anote pra passar pra pessoa. Ao abrir o app, ela vai aparecer na lista de perfis.
          </div>
        </div>

        <Btn label={editando ? "💾 SALVAR ALTERAÇÕES" : "➕ CRIAR ACESSO"} color={GREEN} onClick={salvar} />

        {editando && (
          <button onClick={() => { setModal(false); remover(editando); }} style={{ width: "100%", marginTop: 8, padding: 12, background: "#fee2e2", color: RED, border: `2px solid ${RED}`, borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
            🗑️ EXCLUIR ESTE ACESSO
          </button>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   MINHA CONTA — Segurança e Privacidade
   Permite ao gestor trocar senha, recuperar acesso,
   sair de todas as sessões e ver informações de segurança.
════════════════════════════════════ */

export function TelaMinhaConta({ usuario, empresa, onBack, onLogout }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [modalSair, setModalSair] = useState(false);

  const isFirebase = !!usuario?.firebaseUid;

  const trocarSenha = async () => {
    setErro(""); setSucesso("");
    if (!senhaNova || senhaNova.length < 6) {
      return setErro("A nova senha deve ter pelo menos 6 caracteres.");
    }
    if (senhaNova !== senhaConfirma) {
      return setErro("A confirmação de senha não confere com a nova senha.");
    }
    if (!isFirebase) {
      return setErro("A troca de senha pelo aplicativo só funciona para contas autenticadas pelo Firebase.");
    }
    setCarregando(true);
    // Reautentica antes de trocar (boa prática Firebase)
    const r1 = await loginFirebase(usuario.email, senhaAtual);
    if (!r1.ok) {
      setCarregando(false);
      return setErro("Senha atual incorreta. Tente novamente.");
    }
    const r2 = await atualizarSenha(senhaNova);
    setCarregando(false);
    if (r2.ok) {
      setSucesso("Senha alterada com sucesso! Use a nova senha no próximo login.");
      setSenhaAtual(""); setSenhaNova(""); setSenhaConfirma("");
      setTimeout(() => setSucesso(""), 6000);
    } else {
      setErro(r2.erro || "Não foi possível alterar a senha. Tente novamente.");
    }
  };

  const enviarRecuperacao = async () => {
    setErro(""); setSucesso("");
    if (!usuario?.email) return setErro("E-mail da conta não encontrado.");
    setCarregando(true);
    const r = await recuperarSenha(usuario.email);
    setCarregando(false);
    if (r.ok) {
      setSucesso(`Link de recuperação enviado para ${usuario.email}. Verifique sua caixa de entrada e a pasta de spam.`);
      setTimeout(() => setSucesso(""), 8000);
    } else {
      setErro(r.erro || "Não foi possível enviar o link de recuperação.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Minha Conta" sub="Segurança e privacidade" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD: Informações da conta */}
        <div style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a8a 100%)`,
          color: "#fff",
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
          boxShadow: "0 4px 16px rgba(15,33,81,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              background: GOLD,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: "0 4px 14px rgba(245,166,35,0.5)",
            }}>👤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {usuario?.nome || "Gestor"}
              </div>
              <div style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {usuario?.email || "—"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{
              background: isFirebase ? "rgba(34,197,94,0.25)" : "rgba(234,179,8,0.25)",
              border: `1px solid ${isFirebase ? "rgba(34,197,94,0.5)" : "rgba(234,179,8,0.5)"}`,
              borderRadius: 14,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}>
              {isFirebase ? "🔒 Autenticado pelo Firebase" : "⚠️ Login local (sem nuvem)"}
            </div>
            <div style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 14,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}>
              {usuario?.perfil === "gestor" ? "👔 Gestor" : "👷 Encarregado"}
            </div>
          </div>
        </div>

        {/* CARD: Trocar Senha (apenas Firebase) */}
        {isFirebase ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              🔑 Trocar Senha
            </div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
              Para sua segurança, informe a senha atual antes de definir uma nova. A nova senha precisa ter no mínimo 6 caracteres.
            </div>

            <label style={labelS}>🔐 Senha atual</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              placeholder="Sua senha atual"
              style={inputS}
              autoComplete="current-password"
            />

            <label style={labelS}>✨ Nova senha (mínimo 6 caracteres)</label>
            <input
              type="password"
              value={senhaNova}
              onChange={e => setSenhaNova(e.target.value)}
              placeholder="Nova senha"
              style={inputS}
              autoComplete="new-password"
            />

            <label style={labelS}>🔁 Confirme a nova senha</label>
            <input
              type="password"
              value={senhaConfirma}
              onChange={e => setSenhaConfirma(e.target.value)}
              placeholder="Repita a nova senha"
              style={inputS}
              autoComplete="new-password"
            />

            {erro && (
              <div style={{ background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                ⚠️ {erro}
              </div>
            )}
            {sucesso && (
              <div style={{ background: "#f0fdf4", color: GREEN, border: `1px solid ${GREEN}33`, borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                ✅ {sucesso}
              </div>
            )}

            <Btn
              label={carregando ? "PROCESSANDO..." : "💾 ALTERAR SENHA"}
              color={GREEN}
              onClick={trocarSenha}
              disabled={carregando || !senhaAtual || !senhaNova || !senhaConfirma}
            />
          </div>
        ) : (
          <div style={{ background: "#fef9e7", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid rgba(234,179,8,0.4)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#8b6f00", marginBottom: 6 }}>
              ⚠️ Conta não está autenticada pelo Firebase
            </div>
            <div style={{ fontSize: 11, color: "#8b6f00", lineHeight: 1.5 }}>
              Você entrou com um login local antigo. A troca de senha pelo aplicativo só funciona para contas autenticadas pelo Firebase. Saia e entre novamente usando seu email e senha cadastrados.
            </div>
          </div>
        )}

        {/* CARD: Recuperação de senha */}
        {isFirebase && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              📧 Enviar link de recuperação
            </div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10, lineHeight: 1.5 }}>
              Caso você precise redefinir a senha sem lembrar da atual, enviamos um link de recuperação para o seu e-mail cadastrado: <b>{usuario.email}</b>.
            </div>
            <button
              onClick={enviarRecuperacao}
              disabled={carregando}
              style={{
                width: "100%",
                padding: 12,
                background: "#fff",
                color: BLUE,
                border: `2px solid ${BLUE}`,
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: carregando ? "default" : "pointer",
              }}
            >
              {carregando ? "Enviando..." : "✉️ Enviar link para meu e-mail"}
            </button>
          </div>
        )}

        {/* CARD: Sessões */}
        {isFirebase && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              🚪 Sair desta sessão
            </div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10, lineHeight: 1.5 }}>
              Encerra a sessão atual deste aparelho. Você pode entrar novamente quando quiser.
            </div>
            <button
              onClick={() => setModalSair(true)}
              className="km-btn-danger"
              style={{
                width: "100%",
                padding: 12,
                background: "#fff",
                color: RED,
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              🚪 Sair da conta
            </button>
          </div>
        )}

        {/* CARD: Informações da empresa (compacto) */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            🏢 Empresa vinculada
          </div>
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>
            <div><b>Razão Social:</b> {empresa?.razaoSocial || "—"}</div>
            {empresa?.nomeFantasia && <div><b>Nome fantasia:</b> {empresa.nomeFantasia}</div>}
            <div><b>CNPJ:</b> {empresa?.cnpj || "—"}</div>
            {empresa?.registro && <div><b>Registro:</b> {empresa.registro}</div>}
            {empresa?.endereco && <div style={{ marginTop: 4 }}><b>📍</b> {empresa.endereco}</div>}
          </div>
        </div>

        {/* Dica de segurança */}
        <div style={{
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 10,
          padding: 12,
          fontSize: 11,
          color: "#075985",
          lineHeight: 1.5,
        }}>
          💡 <b>Dica de segurança:</b> Use senhas com no mínimo 8 caracteres, misturando letras, números e símbolos. Não compartilhe sua senha com ninguém. Em caso de suspeita de acesso indevido, troque sua senha imediatamente.
        </div>
      </div>
      <KMFooter />

      {/* Modal: Confirmar Sair */}
      <Modal show={modalSair} title="🚪 Sair da conta?" onClose={() => setModalSair(false)}>
        <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 14 }}>
          Você vai precisar entrar com email e senha novamente neste aparelho. Confirma?
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setModalSair(false)}
            style={{ flex: 1, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >Cancelar</button>
          <button
            onClick={() => { setModalSair(false); onLogout && onLogout(); }}
            className="km-btn-danger"
            style={{ flex: 1, padding: 12, background: RED, color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}
          >🚪 Sair</button>
        </div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   AJUDA & SUPORTE — FAQ, Termos, LGPD, Contato
════════════════════════════════════ */
