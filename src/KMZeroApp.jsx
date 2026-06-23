import { LINKS_PADRAO } from "./screens/equipe.jsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { loginFirebase, logoutFirebase, observarAutenticacao, recuperarSenha, atualizarSenha, usuarioAtual, criarContaFirebase } from "./firebase.js";

/* ── Blocos extraídos (refatoração: separação por camada) ── */
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css } from "./theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm } from "./utils.js";
import { setEmpresaId, getEmpresaId, cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, buscarEmpresaIdDoUsuario, registrarEmpresa, registrarUsuarioEmpresa, store } from "./lib/store.js";
import { FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "./lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "./lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, EMPRESA_TEMPLATE, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "./data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura } from "./components/ui.jsx";

/* ── Telas separadas por domínio ── */
import { TelaPerfilPIN, TelaPIN, TelaLogin, TelaMinhaConta, TelaAcessosApp } from "./screens/auth.jsx";
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
  const [obras, setObras]         = useState([]);
  const [trabalhadores, setTrab]  = useState([]);
  const [equips, setEquips]       = useState([]);
  const [pedidos, setPedidos]     = useState([]);

  // ── SYNC PEDIDOS (Fase 2): lançador cria na obra, gestor vê de qualquer cidade ──
  const criarPedidoSync = useCallback(p => {
    setPedidos(ps => [p, ...ps]);
    enviarDocNuvem("pedidos", p.id, p);
  }, []);
  const mudarStatusPedidoSync = useCallback((id, status, extras = {}) => {
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
    enviarFotoNuvem(f);
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

  const obraAtual = usuario?.obraId ? obras.find(o => o.id === usuario.obraId) || obras[0] : obras[0];
  const presencasHoje = historico[hojeStr()] || {};

  useEffect(() => {
    (async () => {
      const cachedEmpresaId = localStorage.getItem("_kmzero_empresaId");
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
  const restaurarBackup = (dados) => {
    if (dados.obras) setObras(dados.obras);
    if (dados.trabalhadores) setTrab(dados.trabalhadores);
    if (dados.equips) setEquips(dados.equips);
    if (dados.pedidos) setPedidos(dados.pedidos);
    if (dados.historico) setHistorico(dados.historico);
    if (dados.usuarios) setUsuarios(dados.usuarios);
    if (dados.mensagens) setMensagens(dados.mensagens);
    if (dados.diario) setDiario(dados.diario);
    if (dados.ativos) setAtivos(dados.ativos);
    if (dados.abastecimentos) setAbast(dados.abastecimentos);
    if (dados.ferias) setFerias(dados.ferias);
    if (dados.rdosEmitidos) setRdos(dados.rdosEmitidos);
    if (dados.empresa) setEmpresa(dados.empresa);
    if (dados.produtividade) setProd(dados.produtividade);
    if (dados.recebimentos) setReceb(dados.recebimentos);
    if (dados.movimentacoes) setMov(dados.movimentacoes);
    if (dados.ferramentas) setFerr(dados.ferramentas);
    if (dados.links) setLinks(dados.links);
    if (dados.adiantamentos) setAdiant(dados.adiantamentos);
    if (dados.manutencoes) setManut(dados.manutencoes);
    if (dados.folhasSalvas) setFolhasSalvas(dados.folhasSalvas);
    if (dados.cronogramas) setCronog(dados.cronogramas);
    if (dados.movEquip) setMovEquip(dados.movEquip);
    if (dados.despesasAvulsas) setDespesasAvulsas(dados.despesasAvulsas);
    if (dados.fotosObras) setFotosObras(dados.fotosObras);
    if (dados.fornecedores) setFornecedores(dados.fornecedores);
    if (dados.clientes) setClientes(dados.clientes);
  };

  const login = (u) => {
    if (u.empresaId) {
      setEmpresaId(u.empresaId);
      setEmpresaIdState(u.empresaId);
      localStorage.setItem("_kmzero_empresaId", u.empresaId);
    }
    setUsuario(u);
    store.set("usuarioLogado", u);
    if (u.perfil === "gestor") setTela("gestor");
    else setTela("home");
  };

  // Atualizar usuário (PIN, biometria, etc) — persiste em usuarios + atualiza logado
  const atualizarUsuario = (uAtualizado) => {
    setUsuarios(us => us.map(x => x.id === uAtualizado.id ? uAtualizado : x));
    if (usuario?.id === uAtualizado.id) {
      setUsuario(uAtualizado);
      store.set("usuarioLogado", uAtualizado);
    }
  };

  // Helper: pra onde voltar baseado no perfil
  const telaInicial = () => {
    if (!usuario) return "login";
    if (usuario.perfil === "gestor") return "gestor";
    return "home";
  };
  const logout = async () => {
    try { await logoutFirebase(); } catch (e) {}
    setUsuario(null);
    setEmpresaIdState(null);
    setEmpresaId(null);
    store.set("usuarioLogado", null);
    setTela("login");
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
              Se precisar, fale com o Kleber.
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

  const render = () => {
    switch (tela) {
      case "login":      return <TelaLogin usuarios={usuarios} obras={obras} onLogin={login} onAtualizarUsuario={atualizarUsuario} onRegistro={() => setTela("registro")} />;
      case "registro":   return <TelaRegistro onBack={() => setTela("login")} onRegistrado={login} />;
      case "home":       return <TelaHome obra={obraAtual} usuario={usuario} mensagens={mensagens} trabalhadores={trabObra} presencasHoje={presencasHoje} onNav={setTela} onLogout={logout} />;
      case "fluxo":      return <FluxoEncarregado obra={obraAtual} trabalhadores={trabObra} equips={equips} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} diario={diario} usuario={usuario} empresa={empresa} historico={historico} rdosEmitidos={rdosEmitidos} fotosObras={fotosObras} onBack={() => setTela("home")} onSavePresencas={salvarPresencas} onAutoEmitirRDO={emitirRDOSync} onSalvarFotoObra={salvarFotoObraSync} />;
      case "material":   return <TelaMaterial obra={obraAtual} usuario={usuario} onBack={() => setTela("home")} onAddPedido={criarPedidoSync} />;
      case "fotos_solo": return <TelaFotos obra={obraAtual} usuario={usuario} totalFotosObra={fotosObras.filter(f => f.obraId === obraAtual?.id).length} onBack={() => setTela("home")} onSalvar={f => setFotosObras(fs => [f, ...fs])} />;
      case "galeria":    return <TelaGaleria obras={obras} fotos={fotosObras} usuario={usuario} onBack={voltar} onRemover={id => setFotosObras(fs => fs.filter(f => f.id !== id))} />;
      case "fornecedores": return <TelaFornecedores fornecedores={fornecedores} onBack={voltar} onAdd={f => setFornecedores(fs => [...fs, f])} onEditar={f => setFornecedores(fs => fs.map(x => x.id === f.id ? f : x))} onRemover={id => setFornecedores(fs => fs.filter(x => x.id !== id))} />;
      case "equip_solo": return <TelaEquip obra={obraAtual} equips={equips} onBack={() => setTela("home")} onSaveEquips={updated => setEquips(es => es.map(e => { const u = updated.find(u => u.id === e.id); return u || e; }))} />;
      case "diario":     return <TelaDiario obra={obraAtual} usuario={usuario} diario={diario} fotosObras={fotosObras} onBack={voltar} onAdd={d => setDiario(ds => [d, ...ds])} onRemove={id => setDiario(ds => ds.filter(d => d.id !== id))} onSalvarFotoObra={salvarFotoObraSync} />;
      case "gestor":     return <TelaPainelGestor obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} equips={equips} historico={historico} mensagens={mensagens} movimentacoes={movimentacoes} manutencoes={manutencoes} cronogramas={cronogramas} movEquip={movEquip} ativos={ativos} abastecimentos={abastecimentos} empresa={empresa} usuario={usuario} onNav={setTela} onLogout={logout} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} />;
      case "obras":      return <TelaObras usuarios={usuarios} obras={obras} clientes={clientes} trabalhadores={trabalhadores} ativos={ativos} equips={equips} ferramentas={ferramentas} pedidos={pedidos} abastecimentos={abastecimentos} manutencoes={manutencoes} cronogramas={cronogramas} historico={historico} recebimentos={recebimentos} rdosEmitidos={rdosEmitidos} onBack={voltar} onAdd={o => setObras(os => [...os, o])} onEditar={o => setObras(os => os.map(x => x.id === o.id ? o : x))} onRemover={id => setObras(os => os.filter(o => o.id !== id))} onNav={setTela} onNavAnexos={(obra) => { setObraAnexos(obra); setTela("anexos_obra"); }} />;
      case "cronograma": return <TelaCronograma obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "cronograma_pro": return <TelaCronogramaPro obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "mov_equip":  return <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} onVerDetalhe={m => { setMovEquipSel(m); setTela("mov_equip_detalhe"); }} />;
      case "mov_equip_detalhe": return movEquipSel ? <TelaMovEquipDetalhe mov={movEquip.find(x => x.id === movEquipSel.id) || movEquipSel} obras={obras} equips={equips} ferramentas={ferramentas} usuario={usuario} onBack={voltar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} /> : <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} />;
      case "equipe":     return <TelaEquipe obras={obras} trabalhadores={trabalhadores} usuarios={usuarios} onBack={voltar} onAdd={(t, login) => {
        setTrab(ts => [...ts, t]);
        // Se o gestor pediu pra criar login, gera usuário também
        if (login && login.email) {
          const novoUsuario = {
            id: Date.now() + 1,
            nome: t.nome,
            email: login.email.toLowerCase().trim(),
            senha: login.senha || "123",
            pin: "",
            biometriaAtiva: false,
            perfil: "encarregado",
            obraId: t.obraId,
            tel: t.tel || "",
          };
          setUsuarios(us => [...us, novoUsuario]);
          setTimeout(() => alert(`✅ Login criado!\n\n📧 Email: ${novoUsuario.email}\n🔑 Senha: ${novoUsuario.senha}\n\nAnote e passe pra ${t.nome}. No primeiro acesso ela cria o PIN.`), 200);
        }
      }} onRemove={(id) => {
        // Remove trabalhador
        const trab = trabalhadores.find(t => t.id === id);
        setTrab(ts => ts.filter(t => t.id !== id));
        // Verifica se tem usuário com mesmo nome (login no sistema)
        if (trab) {
          const usuarioVinculado = usuarios.find(u => u.nome.toLowerCase().trim() === trab.nome.toLowerCase().trim() && u.perfil !== "gestor");
          if (usuarioVinculado) {
            setTimeout(() => {
              confirmar(`Também remover o LOGIN de "${trab.nome}" do sistema?\n\n(Ele não aparecerá mais na tela de login)`, () => {
                setUsuarios(us => us.filter(u => u.id !== usuarioVinculado.id));
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
      case "mensagens":  return <TelaMensagens usuario={usuario} usuarios={usuarios} mensagens={mensagens} onBack={voltar} onEnviar={enviarMensagemSync} onMarcarLida={marcarLidaSync} />;
      case "calendario": return <TelaCalendario obras={obras} trabalhadores={trabalhadores} historico={historico} onBack={voltar} />;
      case "folha":      return <TelaFolhaQuinzenal obras={obras} trabalhadores={trabalhadores} historico={historico} adiantamentos={adiantamentos} abastecimentos={abastecimentos} ativos={ativos} empresa={empresa} onBack={voltar} onSalvarFolha={f => setFolhasSalvas(fs => [f, ...fs])} onMarcarPago={(t, novaData) => editarTrabalhador({ ...t, ultimoPagamento: novaData })} />;
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
      case "acessos":    return <TelaAcessosApp usuarios={usuarios} obras={obras} onBack={voltar} onAdd={u => setUsuarios(us => [...us, u])} onEditar={u => setUsuarios(us => us.map(x => x.id === u.id ? u : x))} onRemover={id => setUsuarios(us => us.filter(u => u.id !== id))} />;
      case "perfil_pin": return <TelaPerfilPIN usuario={usuario} onAtualizar={atualizarUsuario} onBack={voltar} />;
      case "produtividade": return <TelaProdutividade obras={obras} usuario={usuario} produtividade={produtividade} onBack={voltar} onAdd={p => setProd(ps => [p, ...ps])} onRemove={id => setProd(ps => ps.filter(p => p.id !== id))} />;
      case "recebimento":   return <TelaRecebimento obras={obras} pedidos={pedidos} usuario={usuario} recebimentos={recebimentos} onBack={voltar} onAdd={r => setReceb(rs => [r, ...rs])} />;
      case "folha_quinzenal": return <TelaFolhaQuinzenal obras={obras} trabalhadores={trabalhadores} historico={historico} adiantamentos={adiantamentos} abastecimentos={abastecimentos} ativos={ativos} empresa={empresa} onBack={voltar} onSalvarFolha={f => setFolhasSalvas(fs => [f, ...fs])} onMarcarPago={(t, novaData) => editarTrabalhador({ ...t, ultimoPagamento: novaData })} />;
      case "hist_folha":      return <TelaHistFolha obras={obras} trabalhadores={trabalhadores} folhasSalvas={folhasSalvas} onBack={voltar} onRemover={id => setFolhasSalvas(fs => fs.filter(f => f.id !== id))} />;
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
        confirmar("⚠️ ATENÇÃO!\n\nIsto vai SUBSTITUIR todos os RDOs, pedidos, fotos, despesas, presenças, etc.\n\nUse apenas pra testar o app.\n\nDeseja continuar?", () => {
          const sim = gerarDadosMes30Dias();
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
      default:           return <TelaLogin usuarios={usuarios} obras={obras} onLogin={login} onAtualizarUsuario={atualizarUsuario} onRegistro={() => setTela("registro")} />;
    }
  };

  return (
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
      <div className="km-app-wrapper" style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#fff", position: "relative", boxShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
        <div key={tela} className="km-tela-transicao" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {render()}
        </div>
      </div>
    </div>
  );
}

