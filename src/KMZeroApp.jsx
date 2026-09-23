import { LINKS_PADRAO } from "./screens/equipe.jsx";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { logoutFirebase, resultadoRedirecionamento, aguardarSessao } from "./firebase.js";

/* ── Blocos extraídos (refatoração: separação por camada) ── */
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css } from "./theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm } from "./utils.js";
import { setEmpresaId, getEmpresaId, cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, carregarPerfilNuvem, carregarCadastroEmpresa, aplicarPerfilNuvem, resolverEntradaGoogle, observarEquipeNuvem, observarConvitesNuvem, definirAcessoAtivo, jsonEstavel, store } from "./lib/store.js";
import { FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "./lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "./lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, EMPRESA_TEMPLATE, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "./data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura, UsuarioContext } from "./components/ui.jsx";
import { MenuLateral } from "./components/MenuLateral.jsx";
import { useModoEscritorio } from "./lib/useLargura.js";
import { useSyncColecao, porIdAsc, porIdDesc } from "./lib/cloudSync.js";

/* ── Telas separadas por domínio ── */
import { TelaEntrar, TelaPrimeiroAcesso, TelaMinhaConta, TelaAcessosApp } from "./screens/auth.jsx";
import { TelaRegistro } from "./screens/registro.jsx";
import { TelaHome, TelaPainelGestor, CategoriaCard, TelaDashboard, TelaRelatorio, TelaRelatorioConsolidado, TelaAlertas, gerarAlertas } from "./screens/home.jsx";
import { TelaObras, TelaObraDetalhe, TelaMapa } from "./screens/obras.jsx";
import { TelaClientes } from "./screens/clientes.jsx";
import { TelaEquipe, TelaFicha, TelaTrabalhadorDetalhe, CalendarioPresenca, TabelaResumoEquipe, TelaRH, TelaContatos, TelaExames, TelaFerias, TelaAdiantamentos, gerarFichaCadastralPDF } from "./screens/equipe.jsx";
import { FluxoEncarregado, TelaFolha, TelaFolhaQuinzenal, TelaHistFolha, TelaCalendario, TelaDiario } from "./screens/presenca.jsx";
import { TelaMaterial, TelaPedidos, TelaPedidoDetalhe, TelaFornecedores, TelaRecebimento, gerarSolicitacaoPedidoPDF } from "./screens/suprimentos.jsx";
import { TelaEquip, TelaEquipamentosGestao, TelaFrota, TelaAtivos, TelaFerramentas, TelaManutencao, TelaMovEquip, TelaMovEquipDetalhe, TelaSolicitarMov, TelaMovPessoalDetalhe, TelaAprovarMov } from "./screens/equipamentos.jsx";
import { TelaCustos, TelaDespesasAvulsas, TelaPagamentos } from "./screens/financeiro.jsx";
import { TelaRDO, gerarPDFRDORabnt, TelaCronograma, TelaCronogramaPro, CurvaSChart, calcularKPIsCronograma, detectarInconsistenciasCronograma, calcularPctPrevistoEtapa, gerarPontosCurvaS, TelaProdutividade } from "./screens/rdo.jsx";
import { TelaFotos, TelaGaleria, TelaAnexosObra, TelaMensagens, TelaLinks } from "./screens/midia.jsx";
import { TelaAvisos } from "./screens/avisos.jsx";
import { observarAvisosNuvem, observarLeituraAvisos, marcarAvisosLidos, publicarAviso, renovarNotificacoes, desligarNotificacoes, situacaoNotificacoes } from "./lib/avisos.js";
import { avisoEhPara, uidDe } from "./lib/avisosRegras.js";
import { TelaConfigEmpresa, TelaEscritorio, TelaAjuda, TelaBackup, TelaGerarSimulacao, TelaDiagnostico, TelaZerarTudo } from "./screens/sistema.jsx";

export default function App() {
  const [splashAtivo, setSplashAtivo] = useState(true);
  const [splashSaindo, setSplashSaindo] = useState(false);
  useEffect(() => {
    const tSaida = setTimeout(() => setSplashSaindo(true), 4100); // inicia fade-out
    const tFim = setTimeout(() => setSplashAtivo(false), 4500);   // remove de vez
    return () => { clearTimeout(tSaida); clearTimeout(tFim); };
  }, []);

  const [tela, setTelaRaw]        = useState("login");
  const [historicoTelas, setHistoricoTelas] = useState([]); // pilha de navegação
  const [usuario, setUsuario]     = useState(null);
  // Largura da tela: >= 1024 px vira "modo escritório" (só para gestor, ver `escritorio` abaixo)
  const modoEscritorio = useModoEscritorio();

  // Wrapper inteligente: quando muda de tela, guarda a anterior no histórico
  const setTela = (novaTela) => {
    setTelaRaw(prev => {
      // Não guarda no histórico se: é login, é a mesma tela, ou é "home/gestor" (telas raiz)
      const ehTelaRaiz = ["login", "home", "gestor"].includes(prev);
      if (prev !== novaTela && !ehTelaRaiz) {
        setHistoricoTelas(h => [...h, prev]);
      } else if (ehTelaRaiz && prev !== novaTela) {
        // Quando sai de uma tela raiz, limpa histórico
        setHistoricoTelas([]);
      }
      return novaTela;
    });
  };

  // Voltar: vai pra última tela do histórico, ou pra raiz se vazio
  const voltar = () => {
    setHistoricoTelas(h => {
      if (h.length > 0) {
        const novaPilha = [...h];
        const anterior = novaPilha.pop();
        setTelaRaw(anterior);
        return novaPilha;
      }
      // Sem histórico: vai pra tela raiz baseado no perfil
      if (usuario?.perfil === "gestor") setTelaRaw("gestor");
      else if (usuario) setTelaRaw("home");
      else setTelaRaw("login");
      return [];
    });
  };

  const [empresaIdState, setEmpresaIdState] = useState(null);
  const [usuarios, setUsuarios]   = useState([]);
  const [usuarioGoogle, setUsuarioGoogle] = useState(null); // conta Google sem empresa (primeiro acesso)
  const [erroEntrada, setErroEntrada] = useState("");        // erro vindo do login por redirecionamento
  const [obras, setObras]         = useState([]);
  const [trabalhadores, setTrab]  = useState([]);
  const [equips, setEquips]       = useState([]);
  const [pedidos, setPedidos]     = useState([]);
  // Refs para os avisos automáticos lerem o valor atual dentro de callbacks estáveis
  const usuarioRef = useRef(null); usuarioRef.current = usuario;
  const pedidosRef = useRef([]);   pedidosRef.current = pedidos;
  const enviarAvisoRef = useRef(null); // preenchido mais abaixo, onde enviarAviso é criado

  // ── SYNC PEDIDOS (Fase 2): lançador cria na obra, gestor vê de qualquer cidade ──
  const criarPedidoSync = useCallback(p0 => {
    const p = { ...p0, criadoPorUid: p0.criadoPorUid || uidDe(usuarioRef.current) || null };
    setPedidos(ps => [p, ...ps]);
    enviarDocNuvem("pedidos", p.id, p);
    // Aviso: gestores recebem o pedido novo
    const itens = (p.itens || []).map(i => [i.material, i.qtd && `(${i.qtd}${i.unidade ? " " + i.unidade : ""})`].filter(Boolean).join(" "));
    enviarAvisoRef.current?.({
      tipo: "pedido", titulo: `📦 Pedido de material — ${p.obra || "obra"}`,
      texto: `${p.enc || "Encarregado"} pediu: ${itens.slice(0, 4).join(", ") || p.material || ""}${itens.length > 4 ? ` e mais ${itens.length - 4}` : ""}`,
      para: { tipo: "gestores" }, navegarPara: "pedidos",
    });
  }, []);
  const mudarStatusPedidoSync = useCallback((id, status, extras = {}) => {
    // Aviso: quem pediu fica sabendo que o gestor aprovou/negou/entregou
    const antes = pedidosRef.current.find(x => x.id === id);
    if (antes && antes.status !== status && ["Aprovado", "Negado", "Entregue", "Recebido"].includes(status)) {
      const icone = status === "Negado" ? "❌" : "✅";
      enviarAvisoRef.current?.({
        tipo: "pedido", titulo: `${icone} Pedido ${status.toLowerCase()} — ${antes.obra || "obra"}`,
        texto: [antes.material, extras.prazoEntrega && `Entrega: ${extras.prazoEntrega}`].filter(Boolean).join(" · "),
        para: antes.criadoPorUid ? { tipo: "pessoa", uid: antes.criadoPorUid } : { tipo: "obra", obraId: antes.obraId, perfil: "encarregado" },
        navegarPara: "home",
      });
    }
    setPedidos(ps => ps.map(p => {
      if (p.id !== id) return p;
      const novo = { ...p, status, ...extras };
      enviarDocNuvem("pedidos", id, novo);
      return novo;
    }));
  }, []);
  const editarPedidoSync = useCallback(pa => {
    setPedidos(ps => ps.map(p => p.id === pa.id ? pa : p));
    enviarDocNuvem("pedidos", pa.id, pa);
  }, []);
  const removerPedidoSync = useCallback(id => {
    setPedidos(ps => ps.filter(p => p.id !== id));
    removerDocNuvem("pedidos", id);
  }, []);
  const [historico, setHistorico] = useState({});
  const [mensagens, setMensagens] = useState([]);

  // ── SYNC MENSAGENS: agora a mensagem chega no aparelho do destinatário ──
  const enviarMensagemSync = useCallback(m => {
    setMensagens(ms => [m, ...ms]);
    enviarDocNuvem("mensagens", m.id, m);
  }, []);
  const marcarLidaSync = useCallback(id => {
    setMensagens(ms => ms.map(m => {
      if (m.id !== id) return m;
      const novo = { ...m, lida: true };
      enviarDocNuvem("mensagens", id, novo);
      return novo;
    }));
  }, []);
  useEffect(() => {
    if (!usuario?.firebaseUid) return;
    return observarColecaoNuvem("mensagens", nuvem => {
      setMensagens(loc => {
        const porId = new Map(loc.map(m => [String(m.id), m]));
        nuvem.forEach(n => porId.set(String(n.id), n));
        return [...porId.values()].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      });
    });
  }, [usuario?.firebaseUid]);

  // ── AVISOS (notificações): sininho no app + push no celular (api/notificar) ──
  const [avisos, setAvisos] = useState([]);
  const [ultimaLeituraAvisos, setUltimaLeituraAvisos] = useState(0);
  const [avisoNaTela, setAvisoNaTela] = useState(null); // faixa no topo quando o push não está ligado
  const enviarAviso = useCallback(async parcial => {
    const u = usuarioRef.current;
    if (!u) return { ok: false, erro: "Sem login." };
    const agora = Date.now();
    const aviso = { id: String(agora), criadoEm: agora, de: uidDe(u), deNome: u.nome || "", tipo: "manual", ...parcial };
    setAvisos(as => [aviso, ...as.filter(a => a.id !== aviso.id)]);
    try { return await publicarAviso(aviso); }
    catch (e) { console.error("enviarAviso:", e); return { ok: false, erro: "Não foi possível enviar agora." }; }
  }, []);
  enviarAvisoRef.current = enviarAviso;
  useEffect(() => {
    if (!usuario?.firebaseUid || !empresaIdState) return;
    const pararA = observarAvisosNuvem(nuvem => setAvisos(loc => {
      const porId = new Map(loc.map(a => [String(a.id), a]));
      nuvem.forEach(n => porId.set(String(n.id), n));
      return [...porId.values()];
    }));
    const pararL = observarLeituraAvisos(usuario.firebaseUid, t => setUltimaLeituraAvisos(v => Math.max(v, t)));
    renovarNotificacoes(usuario);
    return () => { pararA(); pararL(); };
  }, [usuario?.firebaseUid, empresaIdState]);
  const avisosVisiveis = useMemo(() => {
    if (!usuario) return [];
    const eu = uidDe(usuario);
    return avisos.filter(a => a.de === eu || avisoEhPara(a, usuario)).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  }, [avisos, usuario]);
  const avisosNaoLidos = useMemo(() => {
    const eu = uidDe(usuario);
    return avisosVisiveis.filter(a => a.de !== eu && (a.criadoEm || 0) > ultimaLeituraAvisos).length;
  }, [avisosVisiveis, ultimaLeituraAvisos, usuario]);
  const marcarAvisosLidosAgora = useCallback(() => {
    const agora = Date.now();
    setUltimaLeituraAvisos(agora);
    marcarAvisosLidos(usuarioRef.current?.firebaseUid, agora);
  }, []);
  // Aviso novo com o app aberto e sem push ligado: mostra uma faixa no topo por alguns segundos
  const inicioSessaoRef = useRef(Date.now());
  const avisosJaMostradosRef = useRef(new Set());
  useEffect(() => {
    const eu = uidDe(usuario);
    const novo = avisosVisiveis.find(a => a.de !== eu && (a.criadoEm || 0) > inicioSessaoRef.current && !avisosJaMostradosRef.current.has(a.id));
    avisosVisiveis.forEach(a => avisosJaMostradosRef.current.add(a.id));
    if (!novo || situacaoNotificacoes() === "ligada") return;
    setAvisoNaTela(novo);
    const t = setTimeout(() => setAvisoNaTela(x => (x === novo ? null : x)), 8000);
    return () => clearTimeout(t);
  }, [avisosVisiveis]);
  const [diario, setDiario]       = useState([]);
  const [ativos, setAtivos]       = useState([]);
  const [abastecimentos, setAbast]= useState([]);
  const [ferias, setFerias]       = useState([]);
  const [rdosEmitidos, setRdos]   = useState([]);

  // ── SYNC RDOs: gestor recebe o RDO emitido na obra (fotos vão pela galeria, não no doc) ──
  const rdoParaNuvem = (r) => {
    const { fotos, ...resto } = r; // fotos base64 estouram o limite de 1MB/doc do Firestore
    return { ...resto, qtdFotosNaGaleria: fotos?.length || 0 };
  };
  const emitirRDOSync = useCallback(r => {
    setRdos(rs => [r, ...rs]);
    enviarDocNuvem("rdos", r.id, rdoParaNuvem(r));
  }, []);
  const updateRDOSync = useCallback(r => {
    setRdos(rs => rs.map(x => x.id === r.id ? r : x));
    enviarDocNuvem("rdos", r.id, rdoParaNuvem(r));
  }, []);
  const removeRDOSync = useCallback(id => {
    setRdos(rs => rs.filter(x => x.id !== id));
    removerDocNuvem("rdos", id);
  }, []);
  useEffect(() => {
    if (!usuario?.firebaseUid) return;
    return observarColecaoNuvem("rdos", nuvem => {
      setRdos(loc => {
        const ids = new Set(loc.map(r => String(r.id)));
        const novos = nuvem.filter(n => !ids.has(String(n.id))); // não sobrescreve cópia local (que tem as fotos)
        return novos.length ? [...novos, ...loc].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)) : loc;
      });
    });
  }, [usuario?.firebaseUid]);
  const [empresa, setEmpresa]     = useState({});
  const [produtividade, setProd]  = useState([]);
  const [recebimentos, setReceb]  = useState([]);
  const [movimentacoes, setMov]   = useState([]);
  const [ferramentas, setFerr]    = useState([]);
  const [links, setLinks]         = useState([]);
  const [adiantamentos, setAdiant]= useState([]);
  const [manutencoes, setManut]   = useState([]);
  const [folhasSalvas, setFolhasSalvas] = useState([]);
  const [cronogramas, setCronog]  = useState({});
  const [movEquip, setMovEquip]   = useState([]);
  const [despesasAvulsas, setDespesasAvulsas] = useState([]);
  const [trabSelecionado, setTrabSelecionado] = useState(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [obraAnexos, setObraAnexos] = useState(null);
  const [movEquipSel, setMovEquipSel] = useState(null);
  const [movPessSel, setMovPessSel] = useState(null);
  const [fotosObras, setFotosObras] = useState([]); // galeria por obra

  // Salva foto: local imediato (offline-first) + nuvem em segundo plano
  const salvarFotoObraSync = useCallback(f => {
    setFotosObras(fs => [f, ...fs]);
    // Depois do upload, troca o base64 pela URL da nuvem (o localStorage para de guardar a foto inteira)
    enviarFotoNuvem(f).then(url => {
      if (typeof url !== "string" || !url) return;
      setFotosObras(fs => fs.map(x => String(x.id) === String(f.id) ? { ...x, foto: url, fotoUrl: url } : x));
    }).catch(e => console.error("salvarFotoObraSync:", e));
  }, []);

  // Recebe fotos dos outros aparelhos em tempo real (gestor vê fotos do encarregado)
  useEffect(() => {
    if (!usuario?.firebaseUid) return;
    const parar = observarFotosNuvem(nuvem => {
      setFotosObras(loc => {
        const ids = new Set(loc.map(x => String(x.id)));
        const novas = nuvem.filter(n => !ids.has(String(n.id)));
        return novas.length ? [...novas, ...loc] : loc;
      });
    });
    return parar;
  }, [usuario?.firebaseUid]);

  // Recebe pedidos de todos os aparelhos (nuvem vence em caso de mesmo id — ex: aprovação do gestor)
  useEffect(() => {
    if (!usuario?.firebaseUid) return;
    return observarColecaoNuvem("pedidos", nuvem => {
      setPedidos(loc => {
        const porId = new Map(loc.map(p => [String(p.id), p]));
        nuvem.forEach(n => porId.set(String(n.id), n));
        return [...porId.values()].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      });
    });
  }, [usuario?.firebaseUid]);

  // Recebe presenças de todos os aparelhos (gestor enxerga o ponto lançado na obra)
  useEffect(() => {
    if (!usuario?.firebaseUid) return;
    return observarColecaoNuvem("presencas", docs => {
      setHistorico(local => {
        const novo = { ...local };
        docs.forEach(d => {
          if (!d.data || d.trabId === undefined || d.trabId === null) return;
          novo[d.data] = { ...(novo[d.data] || {}), [d.trabId]: d.status };
        });
        return novo;
      });
    });
  }, [usuario?.firebaseUid]);
  const [fornecedores, setFornecedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const empresaCarregadaRef = useRef(null); // empresa cujos dados estão em memória (prefixo do localStorage)

  // Gestor: sem obra fixa cai na primeira obra. Equipe: só a obra vinculada (sem obra → aviso, nunca a obra de outro)
  const usuarioEhGestor = usuario?.perfil === "gestor";
  const temObraId = usuario?.obraId !== undefined && usuario?.obraId !== null && usuario?.obraId !== "";
  const obraVinculada = temObraId ? obras.find(o => String(o.id) === String(usuario.obraId)) || null : null;
  const obraAtual = (usuarioEhGestor || !usuario) ? (obraVinculada || obras[0]) : obraVinculada;
  const presencasHoje = historico[hojeStr()] || {};

  // Confere na nuvem se o acesso ainda vale (gestor pode ter removido) e atualiza obra/nome/cargo
  const verificarAcessoNuvem = async (u) => {
    if (!u?.firebaseUid) return;
    const p = await carregarPerfilNuvem(u.firebaseUid);
    if (!p.ok) return; // sem internet ou regras: mantém a sessão (offline-first)
    if (!p.perfil || p.perfil.ativo === false) {
      try { await logoutFirebase(); } catch {}
      setUsuarios(us => us.filter(x => String(x.id) !== String(u.id)));
      store.set("usuarioLogado", null);
      localStorage.removeItem("_kmzero_sessao");
      setUsuario(null);
      setTelaRaw("login");
      setTimeout(() => alert("⛔ Seu acesso foi desativado pelo gestor da empresa."), 300);
      return;
    }
    if (u.perfil !== "gestor") {
      const atualizado = aplicarPerfilNuvem(u, p.perfil);
      if (jsonEstavel(atualizado) !== jsonEstavel(u)) {
        setUsuarios(us => us.map(x => String(x.id) === String(u.id) ? { ...x, ...atualizado } : x));
        setUsuario(atualizado);
        store.set("usuarioLogado", atualizado);
      }
    }
  };

  useEffect(() => {
    (async () => {
      const cachedEmpresaId = localStorage.getItem("_kmzero_empresaId");
      empresaCarregadaRef.current = cachedEmpresaId || null;
      if (cachedEmpresaId) {
        setEmpresaId(cachedEmpresaId);
        setEmpresaIdState(cachedEmpresaId);
      }
      const obras_   = await store.get("obras");
      const trab_    = await store.get("trabalhadores");
      const equips_  = await store.get("equips");
      const pedidos_ = await store.get("pedidos");
      const hist_    = await store.get("historico");
      const users_   = await store.get("usuarios");
      const msgs_    = await store.get("mensagens");
      const diario_  = await store.get("diario");
      const ativos_  = await store.get("ativos");
      const abast_   = await store.get("abastecimentos");
      const ferias_  = await store.get("ferias");
      const rdos_    = await store.get("rdos");
      const emp_     = await store.get("empresa");
      const prod_    = await store.get("produtividade");
      const receb_   = await store.get("recebimentos");
      const mov_     = await store.get("movimentacoes");
      const ferr_    = await store.get("ferramentas");
      const links_   = await store.get("links");
      const adiant_  = await store.get("adiantamentos");
      const manut_   = await store.get("manutencoes");
      const folhas_  = await store.get("folhasSalvas");
      const cron_    = await store.get("cronogramas");
      const movE_    = await store.get("movEquip");
      const despAv_  = await store.get("despesasAvulsas");
      const fotos_   = await store.get("fotosObras");
      const forn_    = await store.get("fornecedores");
      const clientes_ = await store.get("clientes");
      const userLogado = await store.get("usuarioLogado");
      // Normaliza obraId/trabId gravados como texto por versões antigas (consertava TODOS os filtros)
      const normIds = (arr) => Array.isArray(arr) ? arr.map(x => {
        if (!x || typeof x !== "object") return x;
        const y = { ...x };
        ["obraId", "trabId"].forEach(k => {
          if (typeof y[k] === "string" && y[k] !== "" && !isNaN(Number(y[k]))) y[k] = Number(y[k]);
        });
        return y;
      }) : arr;
      if (obras_)   setObras(obras_);
      if (trab_)    setTrab(normIds(trab_));
      if (equips_)  setEquips(normIds(equips_));
      if (pedidos_) setPedidos(normIds(pedidos_));
      if (hist_)    setHistorico(hist_);
      if (users_)   setUsuarios(users_);
      if (msgs_)    setMensagens(msgs_);
      if (diario_)  setDiario(diario_);
      if (ativos_) setAtivos(normIds(ativos_));
      if (abast_) setAbast(normIds(abast_));
      if (ferias_)  setFerias(ferias_);
      if (rdos_)    setRdos(rdos_);
      if (emp_)     setEmpresa(emp_);
      if (prod_)    setProd(prod_);
      if (receb_) setReceb(normIds(receb_));
      if (mov_)     setMov(mov_);
      if (ferr_) setFerr(normIds(ferr_));
      if (links_)   setLinks(links_);
      if (adiant_) setAdiant(normIds(adiant_));
      if (manut_) setManut(normIds(manut_));
      if (folhas_)  setFolhasSalvas(folhas_);
      if (cron_)    setCronog(cron_);
      if (movE_) setMovEquip(normIds(movE_));
      if (despAv_)  setDespesasAvulsas(normIds(despAv_));
      if (fotos_) setFotosObras(normIds(fotos_));
      if (forn_)    setFornecedores(forn_);
      if (clientes_) setClientes(normIds(clientes_));
      if (userLogado) {
        if (userLogado.empresaId) {
          setEmpresaId(userLogado.empresaId);
          setEmpresaIdState(userLogado.empresaId);
        }
        setUsuario(userLogado);
        setTela(userLogado.perfil === "gestor" ? "gestor" : "home");
        localStorage.setItem("_kmzero_sessao", "1"); // a vitrine (/) manda direto para /app/
        verificarAcessoNuvem(userLogado); // em segundo plano
      } else {
        // Sem sessão local: pode ser a volta do login por redirecionamento (Google),
        // ou a sessão Google gravada no aparelho ainda vale (ex.: app fechado no meio do 1º acesso).
        const viaRedirect = await resultadoRedirecionamento();
        if (viaRedirect && viaRedirect.erro) setErroEntrada(viaRedirect.erro);
        const sessao = (viaRedirect && viaRedirect.uid) ? viaRedirect : await aguardarSessao();
        if (sessao) await concluirLoginGoogle(sessao);
      }

      // ⭐ AUTO-POPULA 30 DIAS apenas se ativado manualmente em Sistema > Gerar 30 dias
      // (Desativado por padrão para produção - usuário deve gerar manualmente se quiser teste)
      // if (!hist_ || Object.keys(hist_).length === 0) { ... }

      setCarregando(false);
    })();
  }, []);

  useEffect(() => { if (!carregando) store.set("obras", obras); }, [obras, carregando]);
  useEffect(() => { if (!carregando) store.set("trabalhadores", trabalhadores); }, [trabalhadores, carregando]);
  useEffect(() => { if (!carregando) store.set("equips", equips); }, [equips, carregando]);
  useEffect(() => { if (!carregando) store.set("pedidos", pedidos); }, [pedidos, carregando]);
  useEffect(() => { if (!carregando) store.set("historico", historico); }, [historico, carregando]);
  useEffect(() => { if (!carregando) store.set("usuarios", usuarios); }, [usuarios, carregando]);
  useEffect(() => { if (!carregando) store.set("mensagens", mensagens); }, [mensagens, carregando]);
  useEffect(() => { if (!carregando) store.set("diario", diario); }, [diario, carregando]);
  useEffect(() => { if (!carregando) store.set("ativos", ativos); }, [ativos, carregando]);
  useEffect(() => { if (!carregando) store.set("abastecimentos", abastecimentos); }, [abastecimentos, carregando]);
  useEffect(() => { if (!carregando) store.set("ferias", ferias); }, [ferias, carregando]);
  useEffect(() => { if (!carregando) store.set("rdos", rdosEmitidos); }, [rdosEmitidos, carregando]);
  useEffect(() => { if (!carregando) store.set("empresa", empresa); }, [empresa, carregando]);
  useEffect(() => { if (!carregando) store.set("produtividade", produtividade); }, [produtividade, carregando]);
  useEffect(() => { if (!carregando) store.set("recebimentos", recebimentos); }, [recebimentos, carregando]);
  useEffect(() => { if (!carregando) store.set("movimentacoes", movimentacoes); }, [movimentacoes, carregando]);
  useEffect(() => { if (!carregando) store.set("ferramentas", ferramentas); }, [ferramentas, carregando]);
  useEffect(() => { if (!carregando) store.set("links", links); }, [links, carregando]);
  useEffect(() => { if (!carregando) store.set("adiantamentos", adiantamentos); }, [adiantamentos, carregando]);
  useEffect(() => { if (!carregando) store.set("manutencoes", manutencoes); }, [manutencoes, carregando]);
  useEffect(() => { if (!carregando) store.set("folhasSalvas", folhasSalvas); }, [folhasSalvas, carregando]);
  useEffect(() => { if (!carregando) store.set("cronogramas", cronogramas); }, [cronogramas, carregando]);
  useEffect(() => { if (!carregando) store.set("movEquip", movEquip); }, [movEquip, carregando]);
  useEffect(() => { if (!carregando) store.set("despesasAvulsas", despesasAvulsas); }, [despesasAvulsas, carregando]);
  useEffect(() => { if (!carregando) store.set("fotosObras", fotosObras); }, [fotosObras, carregando]);
  useEffect(() => { if (!carregando) store.set("fornecedores", fornecedores); }, [fornecedores, carregando]);
  useEffect(() => { if (!carregando) store.set("clientes", clientes); }, [clientes, carregando]);

  // ── SYNC MULTIAPARELHO ─────────────────────────────────────────────────────
  // Cadastros e lançamentos espelhados em empresas/{empresaId}/{colecao}.
  // O gestor cadastra a obra no escritório e o encarregado vê no celular; o que
  // o encarregado lança na obra aparece pro gestor. (pedidos, mensagens, RDOs,
  // presenças e fotos já tinham sync próprio acima — continuam iguais.)
  const syncAtivo = !carregando && !!usuario?.firebaseUid && !!empresaIdState;

  useSyncColecao("obras",           obras,           setObras,           syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("trabalhadores",   trabalhadores,   setTrab,            syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("equips",          equips,          setEquips,          syncAtivo, { ordenar: porIdAsc });
  // Equipe com acesso ao app = perfis da nuvem (usuarios/) + convites pendentes (só o gestor vê).
  // Substitui a lista local: quem entra é quem tem conta Google com perfil na empresa.
  useEffect(() => {
    if (!syncAtivo) return;
    let perfis = null, convites = [];
    const publicar = () => { if (perfis) setUsuarios([...perfis, ...convites]); };
    const paradas = [observarEquipeNuvem(ps => { perfis = ps; publicar(); })];
    if (usuario?.perfil === "gestor") paradas.push(observarConvitesNuvem(cs => { convites = cs; publicar(); }));
    return () => paradas.forEach(p => { try { p && p(); } catch {} });
  }, [syncAtivo, usuario?.perfil, empresaIdState]);
  useSyncColecao("fornecedores",    fornecedores,    setFornecedores,    syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("clientes",        clientes,        setClientes,        syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("ativos",          ativos,          setAtivos,          syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("ferramentas",     ferramentas,     setFerr,            syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("links",           links,           setLinks,           syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("ferias",          ferias,          setFerias,          syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("manutencoes",     manutencoes,     setManut,           syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("diario",          diario,          setDiario,          syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("abastecimentos",  abastecimentos,  setAbast,           syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("adiantamentos",   adiantamentos,   setAdiant,          syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("movimentacoes",   movimentacoes,   setMov,             syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("movEquip",        movEquip,        setMovEquip,        syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("despesasAvulsas", despesasAvulsas, setDespesasAvulsas, syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("recebimentos",    recebimentos,    setReceb,           syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("produtividade",   produtividade,   setProd,            syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("folhasSalvas",    folhasSalvas,    setFolhasSalvas,    syncAtivo, { ordenar: porIdDesc });

  // Empresa (objeto único → 1 doc "empresa" na coleção config). Vazia não sobe, pra não apagar a de outro aparelho.
  const empresaArr = useMemo(() => Object.keys(empresa || {}).length ? [{ id: "empresa", ...empresa }] : [], [empresa]);
  const setEmpresaArr = useCallback(fn => setEmpresa(e => {
    const arr = Object.keys(e || {}).length ? [{ id: "empresa", ...e }] : [];
    const novo = typeof fn === "function" ? fn(arr) : fn;
    if (novo === arr) return e;
    const docEmp = (novo || []).find(x => String(x.id) === "empresa");
    if (!docEmp) return e;
    const { id, ...resto } = docEmp;
    return resto;
  }), []);
  useSyncColecao("config", empresaArr, setEmpresaArr, syncAtivo);
  // Empresa sem razão social na tela Empresa: completa com o cadastro de "Criar minha empresa"
  // (só preenche o que estiver vazio; o que o gestor editou em Sistema → Empresa prevalece).
  useEffect(() => {
    if (!syncAtivo || (empresa && empresa.razaoSocial)) return;
    let ativo = true;
    carregarCadastroEmpresa().then(cad => {
      if (!ativo || !cad) return;
      setEmpresa(e => {
        const atual = e || {};
        const faltando = Object.fromEntries(Object.entries(cad).filter(([k, v]) => v && !atual[k]));
        return Object.keys(faltando).length ? { ...atual, ...faltando } : atual;
      });
    });
    return () => { ativo = false; };
  }, [syncAtivo, empresaIdState, empresa?.razaoSocial]);

  // Cronogramas (objeto por obra → 1 doc por obra)
  const cronogramasArr = useMemo(() => Object.entries(cronogramas || {}).map(([obraId, etapas]) => ({ id: obraId, obraId, etapas: etapas || [] })), [cronogramas]);
  const setCronogramasArr = useCallback(fn => setCronog(c => {
    const arr = Object.entries(c || {}).map(([obraId, etapas]) => ({ id: obraId, obraId, etapas: etapas || [] }));
    const novo = typeof fn === "function" ? fn(arr) : fn;
    if (novo === arr) return c;
    return Object.fromEntries((novo || []).map(x => [String(x.id), x.etapas || []]));
  }), []);
  useSyncColecao("cronogramas", cronogramasArr, setCronogramasArr, syncAtivo);

  // Gestor corrige a presença de qualquer dia (acerta a folha) — local + nuvem
  const editarPresencaDia = (dataISO, trabId, status) => {
    setHistorico(h => {
      const dia = { ...(h[dataISO] || {}) };
      if (status === null) delete dia[trabId]; else dia[trabId] = status;
      return { ...h, [dataISO]: dia };
    });
    if (status === null) removerDocNuvem("presencas", `${dataISO}_${trabId}`);
    else enviarDocNuvem("presencas", `${dataISO}_${trabId}`, { data: dataISO, trabId, status, criadoEm: Date.now(), editadoPorGestor: true });
  };

  const salvarPresencas = (novas) => {
    const dia = hojeStr();
    setHistorico(h => ({ ...h, [dia]: { ...(h[dia] || {}), ...novas } }));
    // Nuvem: 1 documento por dia+trabalhador (gestor vê de qualquer cidade)
    Object.entries(novas).forEach(([trabId, status]) => {
      const tid = isNaN(Number(trabId)) ? trabId : Number(trabId);
      enviarDocNuvem("presencas", `${dia}_${trabId}`, { data: dia, trabId: tid, status, criadoEm: Date.now() });
    });
  };
  const verTrabalhador = (t) => { setTrabSelecionado(t); setTela("trab_detalhe"); };
  const editarTrabalhador = (t) => {
    setTrab(ts => ts.map(x => x.id === t.id ? t : x));
    setTrabSelecionado(t);
  };
  // Folha arquivada: marca os vales descontados (descontadoEm + folhaId) para não descontar de novo em outra folha
  const marcarValesDescontados = (ids, info) => {
    const set = new Set((ids || []).map(String));
    if (!set.size) return;
    setAdiant(ads => ads.map(a => set.has(String(a.id)) ? { ...a, ...info, descontado: true } : a));
  };
  // Restaurar backup = MESCLAR: registros do arquivo entram/atualizam (mesmo id vence), nada é apagado.
  // Com a nuvem ativa, apagar aqui apagaria na empresa inteira — por isso não substitui listas.
  const mesclarPorId = (atual, novos) => {
    if (!Array.isArray(novos)) return atual;
    const m = new Map((Array.isArray(atual) ? atual : []).map(x => [String(x?.id), x]));
    novos.forEach(x => { if (x && x.id !== undefined && x.id !== null) m.set(String(x.id), x); });
    return [...m.values()];
  };
  const restaurarBackup = (dados) => {
    if (dados.obras) setObras(a => mesclarPorId(a, dados.obras));
    if (dados.trabalhadores) setTrab(a => mesclarPorId(a, dados.trabalhadores));
    if (dados.equips) setEquips(a => mesclarPorId(a, dados.equips));
    if (dados.pedidos) setPedidos(a => mesclarPorId(a, dados.pedidos));
    if (dados.historico) {
      // Mescla por dia+trabalhador (não substitui o dia inteiro) e envia cada presença à nuvem,
      // para o ponto importado aparecer em todos os aparelhos e na folha.
      setHistorico(h => {
        const novo = { ...h };
        Object.entries(dados.historico).forEach(([dia, m]) => { novo[dia] = { ...(novo[dia] || {}), ...(m || {}) }; });
        return novo;
      });
      if (usuario?.firebaseUid) {
        Object.entries(dados.historico).forEach(([dia, m]) => Object.entries(m || {}).forEach(([trabId, status]) => {
          if (!status) return;
          const tid = isNaN(Number(trabId)) ? trabId : Number(trabId);
          enviarDocNuvem("presencas", `${dia}_${trabId}`, { data: dia, trabId: tid, status, criadoEm: Date.now(), importado: true });
        }));
      }
    }
    if (dados.usuarios) setUsuarios(a => mesclarPorId(a, dados.usuarios));
    if (dados.mensagens) setMensagens(a => mesclarPorId(a, dados.mensagens));
    if (dados.diario) setDiario(a => mesclarPorId(a, dados.diario));
    if (dados.ativos) setAtivos(a => mesclarPorId(a, dados.ativos));
    if (dados.abastecimentos) setAbast(a => mesclarPorId(a, dados.abastecimentos));
    if (dados.ferias) setFerias(a => mesclarPorId(a, dados.ferias));
    if (dados.rdosEmitidos) setRdos(a => mesclarPorId(a, dados.rdosEmitidos));
    if (dados.empresa) setEmpresa(e => ({ ...e, ...dados.empresa }));
    if (dados.produtividade) setProd(a => mesclarPorId(a, dados.produtividade));
    if (dados.recebimentos) setReceb(a => mesclarPorId(a, dados.recebimentos));
    if (dados.movimentacoes) setMov(a => mesclarPorId(a, dados.movimentacoes));
    if (dados.ferramentas) setFerr(a => mesclarPorId(a, dados.ferramentas));
    if (dados.links) setLinks(a => mesclarPorId(a, dados.links));
    if (dados.adiantamentos) setAdiant(a => mesclarPorId(a, dados.adiantamentos));
    if (dados.manutencoes) setManut(a => mesclarPorId(a, dados.manutencoes));
    if (dados.folhasSalvas) setFolhasSalvas(a => mesclarPorId(a, dados.folhasSalvas));
    if (dados.cronogramas) setCronog(c => ({ ...c, ...dados.cronogramas }));
    if (dados.movEquip) setMovEquip(a => mesclarPorId(a, dados.movEquip));
    if (dados.despesasAvulsas) setDespesasAvulsas(a => mesclarPorId(a, dados.despesasAvulsas));
    if (dados.fotosObras) setFotosObras(a => mesclarPorId(a, dados.fotosObras));
    if (dados.fornecedores) setFornecedores(a => mesclarPorId(a, dados.fornecedores));
    if (dados.clientes) setClientes(a => mesclarPorId(a, dados.clientes));
  };

  const upsertUsuarioLista = (lista, u) => {
    const arr = Array.isArray(lista) ? lista : [];
    const idx = arr.findIndex(x => String(x.id) === String(u.id) || (u.firebaseUid && x.firebaseUid === u.firebaseUid && x.perfil === u.perfil));
    if (idx === -1) return [...arr, u];
    return arr.map((x, i) => i === idx ? { ...x, ...u } : x);
  };

  // Depois de "Entrar com Google": perfil → entra; convite → cria o perfil e entra; nada → primeiro acesso
  const concluirLoginGoogle = async (userGoogle) => {
    const r = await resolverEntradaGoogle(userGoogle);
    if (r.tipo === "perfil") { await login(r.usuario); return { ok: true }; }
    if (r.tipo === "sem_convite") { setUsuarioGoogle(userGoogle); setTelaRaw("primeiro_acesso"); return { ok: true, semConvite: true }; }
    if (r.desativado) { try { await logoutFirebase(); } catch {} }
    return { ok: false, erro: r.erro };
  };

  const login = async (u) => {
    const eidNovo = u.empresaId || null;
    if (eidNovo !== (empresaCarregadaRef.current || null)) {
      // Os dados em memória são de outra empresa (ou de antes de existir empresa).
      // Grava o login no prefixo certo e recarrega, para nunca misturar dados entre empresas.
      if (eidNovo) localStorage.setItem("_kmzero_empresaId", eidNovo);
      else localStorage.removeItem("_kmzero_empresaId");
      setEmpresaId(eidNovo);
      const lista = await store.get("usuarios");
      await store.set("usuarios", upsertUsuarioLista(lista, u));
      await store.set("usuarioLogado", u);
      localStorage.setItem("_kmzero_sessao", "1");
      window.location.reload();
      return;
    }
    if (u.empresaId) {
      setEmpresaId(u.empresaId);
      setEmpresaIdState(u.empresaId);
      localStorage.setItem("_kmzero_empresaId", u.empresaId);
    }
    setUsuario(u);
    localStorage.setItem("_kmzero_sessao", "1"); // a página inicial (vitrine) manda direto para o app
    // Guarda/atualiza o perfil na lista deste aparelho (pra próxima vez entrar por PIN / "Continuar como")
    setUsuarios(us => upsertUsuarioLista(us, u));
    store.set("usuarioLogado", u);
    if (u.perfil === "gestor") setTela("gestor");
    else setTela("home");
  };

  // Helper: pra onde voltar baseado no perfil
  const telaInicial = () => {
    if (!usuario) return "login";
    if (usuario.perfil === "gestor") return "gestor";
    return "home";
  };
  const sairDaConta = async () => {
    try { await Promise.race([desligarNotificacoes(), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
    try { await logoutFirebase(); } catch (e) {}
    setUsuario(null);
    setEmpresaIdState(null);
    store.set("usuarioLogado", null);
    localStorage.removeItem("_kmzero_sessao");
    setEmpresaId(null);
    // Recarrega para limpar TODO o estado em memória (evita levar dados desta empresa
    // para a nuvem de outra empresa se o próximo login for de outra conta)
    window.location.reload();
  };
  // "Sair" chamado pelos botões da home/painel (confirmado=false) e pelo modal de
  // Minha Conta (confirmado=true, a pessoa já confirmou lá).
  const logout = (confirmado = false) => {
    // Regra escolhida pelo gestor (opção A): sem internet NÃO deixa sair, porque só se
    // entra de novo com o Google e a pessoa ficaria trancada fora do app no canteiro.
    if (navigator.onLine === false) {
      alert("📵 Sem internet você não conseguiria entrar de novo.\n\nSaia quando tiver sinal.");
      return;
    }
    if (confirmado) return sairDaConta(); // veio do modal de Minha Conta: já confirmou lá
    confirmar("Sair da conta?\n\nPara entrar de novo você vai precisar de internet e da mesma conta Google.", () => sairDaConta());
  };
  const trabObra = trabalhadores.filter(t => t.obraId === obraAtual?.id);

  const todoEstado = { obras, trabalhadores, equips, pedidos, historico, usuarios, mensagens, diario, ativos, abastecimentos, ferias, rdosEmitidos, empresa, produtividade, recebimentos, movimentacoes, ferramentas, links, adiantamentos, manutencoes, folhasSalvas, cronogramas, movEquip, despesasAvulsas, fotosObras, fornecedores, clientes };

  // Aprovar movimentação: se for "definitivo" muda obra do trabalhador
  const salvarManutencao = (m) => {
    setManut(ms => {
      const existe = ms.find(x => x.id === m.id);
      if (existe) return ms.map(x => x.id === m.id ? m : x);
      return [...ms, m];
    });
  };

  const aprovarMov = (m) => {
    setMov(ms => ms.map(x => x.id === m.id ? { ...x, status: "Aprovado" } : x));
    if (m.tipo === "definitivo") {
      setTrab(ts => ts.map(t => t.id === m.trabId ? { ...t, obraId: m.obraDestino } : t));
    }
    // Para "hoje" registramos transferência temporária no histórico (apenas marca)
  };

  // Movimentação de Equipamentos
  const movEquipSolicitar = (m) => {
    setMovEquip(arr => [m, ...arr]);
    // Se já vem aprovado (gestor), aplica mudança imediata
    if (m.status === "Aprovado") {
      if (m.tipoItem === "equipamento") {
        setEquips(es => es.map(e => e.id === m.itemId ? { ...e, obraId: m.obraDestinoId } : e));
      } else if (m.tipoItem === "ferramenta") {
        setFerr(fs => fs.map(f => f.id === m.itemId ? { ...f, obraId: m.obraDestinoId } : f));
      }
    }
  };

  const movEquipAprovar = (id) => {
    const m = movEquip.find(x => x.id === id);
    if (!m) return;
    setMovEquip(arr => arr.map(x => x.id === id ? { ...x, status: "Aprovado" } : x));
    // Move o item pra obra destino
    if (m.tipoItem === "equipamento") {
      setEquips(es => es.map(e => e.id === m.itemId ? { ...e, obraId: m.obraDestinoId } : e));
    } else if (m.tipoItem === "ferramenta") {
      setFerr(fs => fs.map(f => f.id === m.itemId ? { ...f, obraId: m.obraDestinoId } : f));
    }
  };

  const movEquipNegar = (id) => {
    setMovEquip(arr => arr.map(x => x.id === id ? { ...x, status: "Negado" } : x));
  };

  const movEquipDevolver = (id, transferencia = false) => {
    const m = movEquip.find(x => x.id === id);
    if (!m) return;
    setMovEquip(arr => arr.map(x => x.id === id ? { ...x, status: transferencia ? "Concluído" : "Devolvido", dataDevolucao: new Date().toLocaleDateString("pt-BR") } : x));
    // Se for empréstimo (não transferência), volta o item pra obra origem
    if (!transferencia) {
      if (m.tipoItem === "equipamento") {
        setEquips(es => es.map(e => e.id === m.itemId ? { ...e, obraId: m.obraOrigemId } : e));
      } else if (m.tipoItem === "ferramenta") {
        setFerr(fs => fs.map(f => f.id === m.itemId ? { ...f, obraId: m.obraOrigemId } : f));
      }
    }
  };

  // Modo escritório: gestor logado em tela larga (>= 1024 px) vê menu lateral à esquerda
  // e a tela à direita. No celular (ou nas telas de entrada) nada muda.
  const escritorio = modoEscritorio && !!usuario && usuario.perfil === "gestor" && !["login", "registro", "primeiro_acesso"].includes(tela);
  // Só recalcula quando os dados mudam (gerarAlertas percorre várias coleções)
  const badgesMenu = useMemo(() => escritorio ? {
    pedidos: (pedidos || []).filter(p => p.status === "Aguardando").length,
    aprovar_mov: (movimentacoes || []).filter(m => m.status === "Aguardando").length,
    mensagens: (mensagens || []).filter(m => m.para === usuario.id && !m.lida).length,
    avisos: avisosNaoLidos,
    alertas: gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos }).length,
  } : {}, [escritorio, avisosNaoLidos, pedidos, movimentacoes, mensagens, usuario, obras, trabalhadores, equips, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos]);
  // Pessoa logada para os cabeçalhos (foto do Google + nome). Gestor toca e abre "Minha conta".
  const usuarioCtx = useMemo(() => ({ usuario, onAbrirConta: usuario?.perfil === "gestor" ? () => setTela("minha_conta") : null }), [usuario]);

  // Toque na notificação: com o app aberto, o service worker avisa (push-sw.js);
  // com o app fechado, ele abre /app/?aviso=ID — nos dois casos vai para a tela Avisos.
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const aoReceber = e => { if (e.data && e.data.tipo === "kmzero-abrir-aviso") setTela("avisos"); };
    sw.addEventListener("message", aoReceber);
    return () => sw.removeEventListener("message", aoReceber);
  }, []);
  useEffect(() => {
    if (carregando || !usuario) return;
    const qs = new URLSearchParams(window.location.search);
    if (!qs.has("aviso")) return;
    qs.delete("aviso");
    window.history.replaceState(null, "", window.location.pathname + (qs.toString() ? `?${qs}` : ""));
    setTela("avisos");
  }, [carregando, usuario?.firebaseUid]);

  if (carregando) return (
    <div style={{ flex: 1, background: `linear-gradient(175deg,${NAVY},#071030)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: -2 }}>KM<span style={{ color: GOLD }}>ZERO</span></div>
      <div style={{ color: "rgba(255,255,255,0.5)", marginTop: 16, fontSize: 13 }}>Carregando...</div>
    </div>
  );

  // 🔒 SEGURANÇA: telas restritas ao gestor (encarregado não tem acesso)
  const TELAS_GESTOR = new Set([
    "gestor", "obras", "cronograma", "cronograma_pro", "clientes", "equipe", "trab_detalhe", "fichas",
    "ativos", "frota", "manutencoes", "equipamentos_gestao", "ferramentas_gestao",
    "custos", "folha", "folha_mensal", "historico", "adiantamentos", "movimentacoes",
    "dashboard", "diagnostico", "consolidado", "mapa", "calendario", "alertas",
    "fornecedores", "clientes", "empresa", "minha_conta", "ajuda", "acessos", "backup", "gerar_simulacao", "zerar_tudo",
    "aso_aniversarios", "ferias", "contatos_emergencia", "links", "produtividade_gestor",
    "pedidos", "pedido_detalhe", "despesas_avulsas", "mov_pess_detalhe",
    "recebimentos_gestor", "comissionamento"
  ]);

  // Se for encarregado e tentar acessar tela do gestor, bloqueia
  if (usuario && usuario.perfil === "encarregado" && TELAS_GESTOR.has(tela)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <KMHeader title="Acesso restrito" sub="Apenas gestores" onBack={() => setTela("home")} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Acesso Restrito</div>
            <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5, marginBottom: 20 }}>
              Esta área é apenas para o gestor.<br/>
              Se precisar, fale com o gestor da empresa.
            </div>
            <button onClick={() => setTela("home")} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              ← Voltar ao Início
            </button>
          </div>
        </div>
        <KMFooter />
      </div>
    );
  }

  // 🏗️ Telas de campo precisam de obra: equipe sem obra vinculada vê aviso em vez de tela branca
  const TELAS_COM_OBRA = new Set(["fluxo", "material", "fotos_solo", "equip_solo", "diario"]);
  const render = () => {
    if (usuario && !usuarioEhGestor && !obraAtual && TELAS_COM_OBRA.has(tela)) {
      return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <KMHeader title="Sem obra vinculada" sub="Fale com o gestor" onBack={() => setTela("home")} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🏗️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Sem obra vinculada</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5, marginBottom: 20 }}>
                Peça ao gestor para vincular você a uma obra em Sistema → Acessos do App.
              </div>
              <button onClick={() => window.location.reload()} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginRight: 8 }}>🔄 Atualizar</button>
              <button onClick={() => setTela("home")} style={{ background: "#eee", color: NAVY, border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>← Voltar</button>
            </div>
          </div>
          <KMFooter />
        </div>
      );
    }
    switch (tela) {
      case "login":      return <TelaEntrar onGoogle={concluirLoginGoogle} erroInicial={erroEntrada} />;
      case "primeiro_acesso": return <TelaPrimeiroAcesso usuarioGoogle={usuarioGoogle} onCriarEmpresa={() => setTelaRaw("registro")} onVerificar={() => usuarioGoogle ? concluirLoginGoogle(usuarioGoogle) : Promise.resolve({ ok: false, erro: "Entre com o Google de novo." })} onSair={async () => { try { await logoutFirebase(); } catch {} setUsuarioGoogle(null); setTelaRaw("login"); }} />;
      case "registro":   return <TelaRegistro usuarioGoogle={usuarioGoogle} onBack={() => setTelaRaw("primeiro_acesso")} onRegistrado={login} />;
      case "home":       return <TelaHome obra={obraAtual} usuario={usuario} mensagens={mensagens} trabalhadores={trabObra} presencasHoje={presencasHoje} avisosNaoLidos={avisosNaoLidos} onNav={setTela} onLogout={logout} />;
      case "fluxo":      return <FluxoEncarregado obra={obraAtual} trabalhadores={trabObra} equips={equips} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} diario={diario} usuario={usuario} empresa={empresa} historico={historico} rdosEmitidos={rdosEmitidos} fotosObras={fotosObras} onBack={() => setTela("home")} onSavePresencas={salvarPresencas} onAutoEmitirRDO={emitirRDOSync} onSalvarFotoObra={salvarFotoObraSync} />;
      case "material":   return <TelaMaterial obra={obraAtual} usuario={usuario} onBack={() => setTela("home")} onAddPedido={criarPedidoSync} />;
      case "fotos_solo": return <TelaFotos obra={obraAtual} usuario={usuario} totalFotosObra={fotosObras.filter(f => f.obraId === obraAtual?.id).length} onBack={() => setTela("home")} onSalvar={salvarFotoObraSync} />;
      case "galeria":    return <TelaGaleria obras={obras} fotos={fotosObras} usuario={usuario} onBack={voltar} onRemover={id => setFotosObras(fs => fs.filter(f => f.id !== id))} />;
      case "fornecedores": return <TelaFornecedores fornecedores={fornecedores} onBack={voltar} onAdd={f => setFornecedores(fs => [...fs, f])} onEditar={f => setFornecedores(fs => fs.map(x => x.id === f.id ? f : x))} onRemover={id => setFornecedores(fs => fs.filter(x => x.id !== id))} />;
      case "equip_solo": return <TelaEquip obra={obraAtual} equips={equips} onBack={() => setTela("home")} onSaveEquips={updated => setEquips(es => es.map(e => { const u = updated.find(u => u.id === e.id); return u || e; }))} />;
      case "diario":     return <TelaDiario obra={obraAtual} usuario={usuario} diario={diario} fotosObras={fotosObras} onBack={voltar} onAdd={d => setDiario(ds => [d, ...ds])} onRemove={id => setDiario(ds => ds.filter(d => d.id !== id))} onSalvarFotoObra={salvarFotoObraSync} />;
      case "gestor":     return <TelaPainelGestor obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} equips={equips} historico={historico} mensagens={mensagens} movimentacoes={movimentacoes} manutencoes={manutencoes} cronogramas={cronogramas} movEquip={movEquip} ativos={ativos} abastecimentos={abastecimentos} empresa={empresa} usuario={usuario} rdosEmitidos={rdosEmitidos} fotosObras={fotosObras} avisosNaoLidos={avisosNaoLidos} onNav={setTela} onLogout={logout} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} />;
      case "obras":      return <TelaObras usuarios={usuarios} obras={obras} clientes={clientes} trabalhadores={trabalhadores} ativos={ativos} equips={equips} ferramentas={ferramentas} pedidos={pedidos} abastecimentos={abastecimentos} manutencoes={manutencoes} cronogramas={cronogramas} historico={historico} recebimentos={recebimentos} rdosEmitidos={rdosEmitidos} onBack={voltar} onAdd={o => setObras(os => [...os, o])} onEditar={o => setObras(os => os.map(x => x.id === o.id ? o : x))} onRemover={id => setObras(os => os.filter(o => o.id !== id))} onNav={setTela} onNavAnexos={(obra) => { setObraAnexos(obra); setTela("anexos_obra"); }} />;
      case "cronograma": return <TelaCronograma obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "cronograma_pro": return <TelaCronogramaPro obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "mov_equip":  return <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} onVerDetalhe={m => { setMovEquipSel(m); setTela("mov_equip_detalhe"); }} />;
      case "mov_equip_detalhe": return movEquipSel ? <TelaMovEquipDetalhe mov={movEquip.find(x => x.id === movEquipSel.id) || movEquipSel} obras={obras} equips={equips} ferramentas={ferramentas} usuario={usuario} onBack={voltar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} /> : <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} />;
      case "equipe":     return <TelaEquipe obras={obras} trabalhadores={trabalhadores} usuarios={usuarios} onBack={voltar} onAdd={(t) => {
        setTrab(ts => [...ts, t]);
        // Acesso ao app é separado: Sistema → Acessos do App (Gmail da pessoa)
      }} onRemove={(id) => {
        // Remove trabalhador
        const trab = trabalhadores.find(t => t.id === id);
        setTrab(ts => ts.filter(t => t.id !== id));
        // Verifica se tem usuário com mesmo nome (login no sistema)
        if (trab) {
          const usuarioVinculado = usuarios.find(u => u.nome.toLowerCase().trim() === trab.nome.toLowerCase().trim() && u.perfil !== "gestor");
          if (usuarioVinculado) {
            setTimeout(() => {
              confirmar(`Também desativar o ACESSO AO APP de "${trab.nome}"?\n\n(Ela não conseguirá mais entrar com o Google)`, () => {
                if (usuarioVinculado.convite || !usuarioVinculado.firebaseUid) return;
                definirAcessoAtivo(usuarioVinculado.firebaseUid, false);
              });
            }, 300);
          }
        }
      }} onVerDetalhe={verTrabalhador} />;
      case "ficha":      return <TelaFicha obras={obras} onBack={voltar} onAdd={t => setTrab(ts => [...ts, t])} />;
      case "relatorio":  return <TelaRelatorio obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} presencasHoje={presencasHoje} onBack={voltar} />;
      case "consolidado":return <TelaRelatorioConsolidado obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} historico={historico} onBack={voltar} />;
      case "dashboard":  return <TelaDashboard obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} historico={historico} onBack={voltar} />;
      case "alertas":    return <TelaAlertas obras={obras} trabalhadores={trabalhadores} equips={equips} pedidos={pedidos} historico={historico} manutencoes={manutencoes} cronogramas={cronogramas} movEquip={movEquip} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onNav={setTela} />;
      case "pedidos":    return <TelaPedidos obras={obras} pedidos={pedidos} empresa={empresa} usuario={usuario} fornecedores={fornecedores} onBack={voltar} onVerDetalhe={p => { setPedidoSelecionado(p); setTela("pedido_detalhe"); }} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} onRemover={removerPedidoSync} onCriar={criarPedidoSync} />;
      case "pedido_detalhe": return pedidoSelecionado ? <TelaPedidoDetalhe pedido={pedidos.find(x => x.id === pedidoSelecionado.id) || pedidoSelecionado} obras={obras} empresa={empresa} onBack={voltar} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} onRemover={removerPedidoSync} onEditar={editarPedidoSync} /> : <TelaPedidos obras={obras} pedidos={pedidos} empresa={empresa} onBack={voltar} onVerDetalhe={p => { setPedidoSelecionado(p); setTela("pedido_detalhe"); }} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} onRemover={removerPedidoSync} />;
      case "mapa":       return <TelaMapa obras={obras} trabalhadores={trabalhadores} onBack={voltar} onEditar={() => setTela("obras")} />;
      case "clientes":  return <TelaClientes clientes={clientes} onBack={voltar} onAdd={c => setClientes(cs => [...cs, c])} onEditar={c => setClientes(cs => cs.map(x => x.id === c.id ? c : x))} onRemover={id => setClientes(cs => cs.filter(x => x.id !== id))} />;
      case "trab_detalhe": return <TelaTrabalhadorDetalhe trabalhador={trabSelecionado} obras={obras} historico={historico} rdosEmitidos={rdosEmitidos} empresa={empresa} usuario={usuario} onBack={voltar} onEditar={editarTrabalhador} onEditarPresenca={editarPresencaDia} />;
      case "avisos":     return <TelaAvisos usuario={usuario} usuarios={usuarios} obras={obras} avisos={avisosVisiveis} ultimaLeitura={ultimaLeituraAvisos} onEnviar={enviarAviso} onMarcarLidos={marcarAvisosLidosAgora} onNav={setTela} onBack={voltar} />;
      case "mensagens":  return <TelaMensagens usuario={usuario} usuarios={usuarios} mensagens={mensagens} onBack={voltar} onEnviar={enviarMensagemSync} onMarcarLida={marcarLidaSync} />;
      case "calendario": return <TelaCalendario obras={obras} trabalhadores={trabalhadores} historico={historico} onBack={voltar} />;
      case "folha":      return <TelaFolhaQuinzenal obras={obras} trabalhadores={trabalhadores} historico={historico} adiantamentos={adiantamentos} abastecimentos={abastecimentos} ativos={ativos} empresa={empresa} onBack={voltar} onSalvarFolha={f => setFolhasSalvas(fs => [f, ...fs])} onMarcarPago={(t, novaData) => editarTrabalhador({ ...t, ultimoPagamento: novaData })} onMarcarValesDescontados={marcarValesDescontados} />;
      case "equip_gestao":return <TelaEquipamentosGestao obras={obras} equips={equips} onBack={voltar} onAdd={eq => setEquips(es => [...es, eq])} onEditar={eq => setEquips(es => es.map(x => x.id === eq.id ? eq : x))} onRemover={id => setEquips(es => es.filter(e => e.id !== id))} />;
      case "ativos":     return <TelaAtivos obras={obras} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onAdd={a => setAtivos(as => [...as, a])} onEditar={a => setAtivos(as => as.map(x => x.id === a.id ? a : x))} onRemover={id => setAtivos(as => as.filter(a => a.id !== id))} onAbastecer={a => setAbast(abs => [a, ...abs])} />;
      case "frota":      return <TelaFrota obras={obras} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onNav={setTela} />;
      case "pagamentos": return <TelaPagamentos obras={obras} onBack={voltar} onEditarObra={o => setObras(os => os.map(x => x.id === o.id ? o : x))} />;
      case "custos":     return <TelaCustos obras={obras} trabalhadores={trabalhadores} historico={historico} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} despesasAvulsas={despesasAvulsas} onBack={voltar} />;
      case "despesas":   return <TelaDespesasAvulsas obras={obras} despesas={despesasAvulsas} onBack={voltar} onAdd={d => setDespesasAvulsas(arr => [d, ...arr])} onEditar={d => setDespesasAvulsas(arr => arr.map(x => x.id === d.id ? d : x))} onRemover={id => setDespesasAvulsas(arr => arr.filter(x => x.id !== id))} />;
      case "ferias":     return <TelaFerias obras={obras} trabalhadores={trabalhadores} ferias={ferias} onBack={voltar} onAdd={f => setFerias(fs => [...fs, f])} onRemove={id => setFerias(fs => fs.filter(f => f.id !== id))} />;
      case "rdo":        return <TelaRDO obras={obras} trabalhadores={trabalhadores} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} historico={historico} diario={diario} usuario={usuario} empresa={empresa} rdosEmitidos={rdosEmitidos} recebimentos={recebimentos} fotosObras={fotosObras} despesasAvulsas={despesasAvulsas} movimentacoes={movimentacoes} movEquip={movEquip} produtividade={produtividade} cronogramas={cronogramas} onBack={voltar} onEmitirRDO={emitirRDOSync} onUpdateRDO={updateRDOSync} onRemoveRDO={removeRDOSync} />;
      case "empresa":    return <TelaConfigEmpresa empresa={empresa} onSave={setEmpresa} onBack={voltar} />;
      case "minha_conta": return <TelaMinhaConta usuario={usuario} empresa={empresa} onBack={voltar} onLogout={logout} />;
      case "ajuda":      return <TelaAjuda empresa={empresa} onBack={voltar} />;
      case "acessos":    return <TelaAcessosApp usuario={usuario} usuarios={usuarios} obras={obras} empresa={empresa} onBack={voltar} />;
      case "produtividade": return <TelaProdutividade obras={obras} usuario={usuario} produtividade={produtividade} onBack={voltar} onAdd={p => setProd(ps => [p, ...ps])} onRemove={id => setProd(ps => ps.filter(p => p.id !== id))} />;
      case "recebimento":   return <TelaRecebimento obras={obras} pedidos={pedidos} usuario={usuario} recebimentos={recebimentos} onBack={voltar} onAdd={r => setReceb(rs => [r, ...rs])} />;
      case "folha_quinzenal": return <TelaFolhaQuinzenal obras={obras} trabalhadores={trabalhadores} historico={historico} adiantamentos={adiantamentos} abastecimentos={abastecimentos} ativos={ativos} empresa={empresa} onBack={voltar} onSalvarFolha={f => setFolhasSalvas(fs => [f, ...fs])} onMarcarPago={(t, novaData) => editarTrabalhador({ ...t, ultimoPagamento: novaData })} onMarcarValesDescontados={marcarValesDescontados} />;
      case "hist_folha":      return <TelaHistFolha obras={obras} trabalhadores={trabalhadores} folhasSalvas={folhasSalvas} onBack={voltar} onRemover={id => { setFolhasSalvas(fs => fs.filter(f => f.id !== id)); setAdiant(ads => ads.map(a => String(a.folhaId) === String(id) ? { ...a, descontadoEm: null, folhaId: null, folhaPeriodo: null, descontado: false } : a)); }} />;
      case "manutencao":      return <TelaManutencao obras={obras} ativos={ativos} ferramentas={ferramentas} equips={equips} manutencoes={manutencoes} onBack={voltar} onAdd={salvarManutencao} onRemover={id => setManut(ms => ms.filter(m => m.id !== id))} />;
      case "solicitar_mov": return <TelaSolicitarMov obras={obras} trabalhadores={trabalhadores} usuario={usuario} onBack={() => setTela("home")} onSolicitar={m => setMov(ms => [m, ...ms])} />;
      case "aprovar_mov":   return <TelaAprovarMov obras={obras} trabalhadores={trabalhadores} movimentacoes={movimentacoes} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => m.id === id ? { ...m, status: "Negado" } : m))} onVerDetalhe={m => { setMovPessSel(m); setTela("mov_pess_detalhe"); }} />;
      case "mov_pess_detalhe": return movPessSel ? <TelaMovPessoalDetalhe mov={movimentacoes.find(x => x.id === movPessSel.id) || movPessSel} obras={obras} trabalhadores={trabalhadores} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => m.id === id ? { ...m, status: "Negado" } : m))} /> : <TelaAprovarMov obras={obras} trabalhadores={trabalhadores} movimentacoes={movimentacoes} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => m.id === id ? { ...m, status: "Negado" } : m))} />;
      case "ferramentas":   return <TelaFerramentas obras={obras} ferramentas={ferramentas} onBack={voltar} onAdd={f => setFerr(fs => [...fs, f])} onEditar={f => setFerr(fs => fs.map(x => x.id === f.id ? f : x))} onRemover={id => setFerr(fs => fs.filter(f => f.id !== id))} />;
      case "rh":            return <TelaRH obras={obras} trabalhadores={trabalhadores} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "exames":        return <TelaExames obras={obras} trabalhadores={trabalhadores} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "links":         return <TelaLinks links={links} onBack={voltar} onAdd={l => setLinks(ls => [...ls, l])} onRemover={id => setLinks(ls => ls.filter(l => l.id !== id))} />;
      case "diagnostico":   return <TelaDiagnostico onNav={setTela} onBack={voltar} />;
      case "contatos":      return <TelaContatos obras={obras} trabalhadores={trabalhadores} usuarios={usuarios} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "adiantamentos": return <TelaAdiantamentos obras={obras} trabalhadores={trabalhadores} adiantamentos={adiantamentos} onBack={voltar} onAdd={a => setAdiant(ads => [a, ...ads])} onRemove={id => setAdiant(ads => ads.filter(a => a.id !== id))} />;
      case "backup":     return <TelaBackup todoEstado={todoEstado} onRestaurar={restaurarBackup} onBack={voltar} />;
      case "anexos_obra": return obraAnexos ? <TelaAnexosObra obra={obraAnexos} usuario={usuario} onBack={voltar} /> : <TelaObras usuarios={usuarios} obras={obras} trabalhadores={trabalhadores} ativos={ativos} equips={equips} ferramentas={ferramentas} pedidos={pedidos} abastecimentos={abastecimentos} manutencoes={manutencoes} cronogramas={cronogramas} historico={historico} recebimentos={recebimentos} rdosEmitidos={rdosEmitidos} onBack={voltar} onAdd={o => setObras(os => [...os, o])} onEditar={o => setObras(os => os.map(x => x.id === o.id ? o : x))} onRemover={id => setObras(os => os.filter(o => o.id !== id))} onNav={setTela} />;

      case "zerar_tudo": return <TelaZerarTudo
        onBack={voltar}
        onZerar={() => {
          setHistorico({});
          setRdos([]);
          setPedidos([]);
          setFotosObras([]);
          setDespesasAvulsas([]);
          setMov([]);
          setMovEquip([]);
          setDiario([]);
          setAdiant([]);
          setReceb([]);
          setAbast([]);
          setProd([]);
          setFolhasSalvas([]);
          setMensagens([]);
          setManut([]);
          alert("✅ Tudo zerado!\n\nO app está pronto pra começar do zero com dados reais.");
          voltar();
        }}
        onResetTotal={() => {
          try {
            const prefix = empresaIdState ? empresaIdState + "_" : "kmzero_";
            const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
            keys.forEach(k => localStorage.removeItem(k));

            // Avisa e recarrega — o useEffect inicial vai carregar os defaults limpos
            alert("💣 RESET TOTAL CONCLUÍDO!\n\nVou recarregar a página agora.");
            window.location.reload();
          } catch (e) {
            console.error("Erro no reset:", e);
            alert("❌ Erro: " + (e && e.message ? e.message : e));
          }
        }}
      />;

      case "gerar_simulacao": return <TelaGerarSimulacao onGerar={() => {
        confirmar("⚠️ ATENÇÃO!\n\nIsto vai SUBSTITUIR todos os RDOs, pedidos, fotos, despesas, presenças, etc. por dados FICTÍCIOS.\n\n☁️ Com a nuvem ativa, isso vai para a NUVEM e para TODOS os aparelhos da empresa.\n\nUse apenas numa empresa de teste.\n\nDeseja continuar?", () => {
          const sim = gerarDadosMes30Dias();
          // Lista de exemplo (fictícia) só entra aqui, e só se a empresa ainda não tiver os seus
          if (!trabalhadores.length) setTrab(sim.trabalhadores);
          if (!obras.length) setObras(sim.obras);
          setHistorico(sim.historico);
          setFotosObras(sim.fotosObras);
          setRdos(sim.rdosEmitidos);
          setPedidos(sim.pedidos);
          setMov(sim.movimentacoes);
          setMovEquip(sim.movEquip);
          setDiario(sim.diario);
          setDespesasAvulsas(sim.despesasAvulsas);
          setAdiant(sim.adiantamentos);
          setReceb(sim.recebimentos);
          setAbast(sim.abastecimentos);
          setProd(sim.produtividade);
          alert("✅ 30 dias gerados!\n\nAgora você pode ver o app com tudo preenchido.");
          voltar();
        });
      }} onBack={voltar} />;
      default:           return <TelaEntrar onGoogle={concluirLoginGoogle} erroInicial={erroEntrada} />;
    }
  };

  return (
    <UsuarioContext.Provider value={usuarioCtx}>
    <div style={{ fontFamily: "'Segoe UI',sans-serif", backgroundColor: "#0a1535", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      {/* SPLASH SCREEN */}
      {splashAtivo && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "linear-gradient(135deg, #0a1535 0%, #0F2151 50%, #1e3a8a 100%)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          animation: splashSaindo ? "kmSplashOut 0.4s ease-in forwards" : "kmSplashFade 0.4s ease-out",
        }}>
          <style>{`
            @keyframes kmSplashFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes kmSplashOut { from { opacity: 1; } to { opacity: 0; } }
            @keyframes kmSplashProgress { from { width: 0%; } to { width: 100%; } }
            @keyframes kmSplashPulse {
              0%, 100% { transform: scale(1); text-shadow: 0 0 20px rgba(245,166,35,0.4); }
              50% { transform: scale(1.04); text-shadow: 0 0 50px rgba(245,166,35,0.8); }
            }
            @keyframes kmSplashLine {
              0% { width: 0; opacity: 0; }
              50% { opacity: 1; }
              100% { width: 80px; opacity: 1; }
            }
            @keyframes kmSplashTagline {
              0% { opacity: 0; transform: translateY(10px); }
              60% { opacity: 0; }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes kmSplashOrb {
              0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.4; }
              50% { transform: scale(1.2) translate(20px, -20px); opacity: 0.7; }
            }
            @keyframes kmSplashRise {
              0% { opacity: 0; transform: translateY(16px) scale(0.96); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes kmSplashSpin { to { transform: rotate(360deg); } }
          `}</style>

          {/* Orbs decorativos */}
          <div style={{
            position: "absolute", top: "-100px", right: "-100px",
            width: 350, height: 350, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,166,35,0.35), transparent 70%)",
            filter: "blur(40px)",
            animation: "kmSplashOrb 4s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", bottom: "-100px", left: "-100px",
            width: 300, height: 300, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.3), transparent 70%)",
            filter: "blur(40px)",
            animation: "kmSplashOrb 5s ease-in-out infinite reverse",
          }} />

          {/* Halo dourado girando atrás do logo */}
          <div style={{
            position: "absolute", width: 280, height: 280, borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent 0%, rgba(245,166,35,0.28) 18%, transparent 36%)",
            filter: "blur(3px)", zIndex: 0,
            animation: "kmSplashSpin 6s linear infinite",
          }} />

          {/* Logo central */}
          <div style={{ textAlign: "center", zIndex: 1, animation: "kmSplashRise 0.85s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{
              fontSize: 12, color: "rgba(255,255,255,0.5)",
              letterSpacing: 5, fontWeight: 600, marginBottom: 14,
              textTransform: "uppercase",
            }}>
              🏗️ Gestão de Obras
            </div>
            <div style={{ animation: "kmSplashPulse 2.5s ease-in-out infinite" }}>
              <span style={{ fontWeight: 900, fontSize: 64, color: "#fff", letterSpacing: -2 }}>KM</span>
              <span style={{ fontWeight: 900, fontSize: 64, color: "#F5A623", letterSpacing: -2 }}>ZERO</span>
            </div>
            <div style={{
              height: 3, background: "#F5A623", margin: "14px auto", borderRadius: 2,
              animation: "kmSplashLine 1s ease-out forwards",
              boxShadow: "0 0 12px rgba(245,166,35,0.6)",
            }} />
            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.65)", fontStyle: "italic",
              animation: "kmSplashTagline 1.8s ease-out forwards",
              opacity: 0,
            }}>
              Gestao Inteligente de Obras
            </div>
          </div>

          {/* Footer da splash — barra de progresso */}
          <div style={{
            position: "absolute", bottom: 40, left: 0, right: 0,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 160, height: 3, borderRadius: 3,
              background: "rgba(255,255,255,0.12)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: "linear-gradient(90deg, #F5A623, #ffd27a)",
                boxShadow: "0 0 10px rgba(245,166,35,0.7)",
                animation: "kmSplashProgress 4.4s cubic-bezier(0.4,0,0.2,1) forwards",
              }} />
            </div>
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.35)",
              letterSpacing: 3, fontWeight: 600,
            }}>
              CARREGANDO...
            </div>
          </div>
        </div>
      )}
      <style>{`
        /* Responsividade adaptável */
        @media (min-width: 768px) {
          .km-app-wrapper {
            max-width: 480px !important;
          }
        }
        @media (min-width: 1024px) {
          .km-app-wrapper {
            max-width: 520px !important;
          }
        }
        /* Modo escritório (gestor em tela larga): menu lateral + conteúdo na largura toda */
        .km-app-wrapper.km-escritorio {
          max-width: none !important;
          box-shadow: none !important;
        }
        /* Ajustes para telas pequenas */
        @media (max-width: 380px) {
          .km-app-wrapper {
            max-width: 100% !important;
            box-shadow: none !important;
          }
        }
        /* Rotação: celular em paisagem (tela baixa e larga) ocupa a largura toda, sem faixas escuras nem corte */
        @media (orientation: landscape) and (max-height: 600px) {
          .km-app-wrapper {
            max-width: 100% !important;
            min-height: 100vh !important;
            box-shadow: none !important;
          }
        }
        /* Touch targets mínimos pro mobile */
        button { min-height: 32px; touch-action: manipulation; }
        input, select, textarea { min-height: 36px; touch-action: manipulation; font-size: 16px !important; /* evita zoom no iOS */ }
        @media (min-width: 768px) {
          input, select, textarea { font-size: 14px !important; }
        }
        /* Transição suave entre telas */
        @keyframes kmTelaEntra {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .km-tela-transicao {
          animation: kmTelaEntra 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .km-tela-transicao { animation: none; }
        }
      `}</style>
      {avisoNaTela && tela !== "avisos" && (
        <button onClick={() => { setAvisoNaTela(null); setTela("avisos"); }} style={{
          position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          width: "min(92vw, 420px)", background: NAVY, color: "#fff", border: `2px solid ${GOLD}`, borderRadius: 14,
          padding: "10px 14px", textAlign: "left", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", cursor: "pointer",
        }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{avisoNaTela.titulo}</div>
          {avisoNaTela.texto && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{avisoNaTela.texto}</div>}
        </button>
      )}
      {escritorio ? (
        <div className="km-app-wrapper km-escritorio" style={{ width: "100%", maxWidth: "none", minHeight: "100vh", display: "flex", flexDirection: "row", alignItems: "stretch", backgroundColor: LIGHT, position: "relative", boxShadow: "none" }}>
          <MenuLateral tela={tela} onNav={setTela} usuario={usuario} empresa={empresa} badges={badgesMenu} onLogout={logout} />
          <div style={{ flex: 1, minWidth: 0, padding: "0 24px 24px", display: "flex", flexDirection: "column" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
              <div key={tela} className="km-tela-transicao" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                {render()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="km-app-wrapper" style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#fff", position: "relative", boxShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
          <div key={tela} className="km-tela-transicao" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {render()}
          </div>
        </div>
      )}
    </div>
    </UsuarioContext.Provider>
  );
}

