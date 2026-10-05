import { LINKS_PADRAO } from "./screens/equipe.jsx";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { logoutFirebase, resultadoRedirecionamento, aguardarSessao, confirmarDonoNoServidor } from "./firebase.js";

/* ── Blocos extraídos (refatoração: separação por camada) ── */
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css, T, DEFAULT_FONT, ESCURO } from "./theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm } from "./utils.js";
import { setEmpresaId, getEmpresaId, setModoDemo, cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, carregarPerfilNuvem, carregarCadastroEmpresa, aplicarPerfilNuvem, resolverEntradaGoogle, observarEquipeNuvem, observarConvitesNuvem, definirAcessoAtivo, jsonEstavel, store, lerAcessos, carregarDonoEmpresa, restaurarDonoNuvem, conviteDeOutraEmpresa, trocarParaConvite, guardarRecusaConvite, mesclarRdosDaNuvem, versaoRdo } from "./lib/store.js";
import { FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "./lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "./lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, gerarDadosDemo, gerarAvisosDemo, DEMO_ID, DEMO_USUARIO, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, EMPRESA_TEMPLATE, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "./data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura, UsuarioContext, EscritorioContext } from "./components/ui.jsx";
import { MenuLateral } from "./components/MenuLateral.jsx";
import { TODAS_TELAS_MENU, PRESETS_ACESSOS, normalizarAcessos, telaPermitida, telaInicialPermitida } from "./components/menuGrupos.js";
import { Icone } from "./components/Icones.jsx";
import { useModoEscritorio } from "./lib/useLargura.js";
import { CHAVE_TEMA, aplicarTema } from "./lib/useTema.js";
import { LARGURA_POR_TELA, tipoDaTela } from "./lib/layoutEscritorio.js";
import { useSyncColecao, porIdAsc, porIdDesc } from "./lib/cloudSync.js";
import { setPerfilDados, observarMeuPerfil, suspenderPersistencia } from './lib/store.js';
import { politicaColecao, filtrarCachePermitido, administraPessoas, perfilCampo } from './lib/permissoesDados.js';
import { registrarAbaProtegida, prepararSaida, baixarBackupSaida, executarSaida, donoCacheLocal, marcarDonoCacheLocal, lerLimpezaPendente, concluirLimpezaPendente, higienizarCachePermissoes, prepararRecuperacaoDono, concluirRecuperacaoDono } from './lib/saidaSegura.js';
import { normId, mesmoId, normalizarColecao } from "./lib/ids.js";
import { normalizarFotoLocalPrivada } from './lib/fotoCaminho.js';

/* ── Telas separadas por domínio ── */
import { TelaEntrar, TelaPrimeiroAcesso, TelaMinhaConta, TelaAcessosApp, TelaConviteOutraEmpresa } from "./screens/auth.jsx";
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
import { TelaSeguranca } from './screens/seguranca.jsx';
import { observarAvisosNuvem, observarLeituraAvisos, marcarAvisosLidos, publicarAviso, renovarNotificacoes, desligarNotificacoes, situacaoNotificacoes } from "./lib/avisos.js";
import { avisoEhPara, uidDe } from "./lib/avisosRegras.js";
import { TelaConfigEmpresa, TelaEscritorio, TelaAjuda, TelaBackup, TelaGerarSimulacao, TelaDiagnostico, TelaZerarTudo } from "./screens/sistema.jsx";

/* ── MODO DEMONSTRAÇÃO (/app/?demo=1, apelido /app/demo) ──────────────────────
   Demo pública sem login, como GESTOR da "Construtora Exemplo". Três defesas para
   nada vazar para a nuvem nem para a empresa real deste navegador:
   1) store.js: setModoDemo(true) faz cloudRefs() devolver null → nenhuma função de
      nuvem (store.js, avisos.js, cloudSync.js) chega ao Firestore/Storage;
   2) DEMO_USUARIO sem firebaseUid → syncAtivo e os observadores diretos ficam desligados;
   3) o boot pula aguardarSessao/resultadoRedirecionamento/verificarAcessoNuvem e nunca
      grava _kmzero_empresaId nem _kmzero_sessao: a conta Google real não é tocada.
   Os dados vivem em localStorage com prefixo demo_ (empresaId "demo") e no IndexedDB
   demo_files; "Sair" apaga tudo isso e volta para a vitrine.
   Parâmetros (só na demo): &tema=claro|escuro · &tela=<nav do menu> · &acessos=financeiro|
   administrativo|obras|tudo (pacotes da tela Usuários e acessos) ou lista de áreas com vírgula
   (ex.: &acessos=obras,campo — "obras," é só a área Obras). Ex.: /app/?demo=1&acessos=financeiro
   Administrador: sem &acessos= o visitante é o ADMINISTRADOR (o dono, quem criou a empresa: acesso
   total, cartão travado em Usuários e acessos, pode criar o RDO de um dia que o encarregado não
   fechou). Com um &acessos= válido ele passa a ser um usuário do escritório que NÃO é o dono
   (como o Ricardo, Financeiro): o dono da demo vira outro (DEMO_DONO_OUTRO), mesmo com &acessos=tudo. */
const CHAVE_SEMENTE_DEMO = "demo__semente";
const detectarDemo = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("demo") === "1" || /^\/app\/demo\/?$/.test(window.location.pathname);
  } catch { return false; }
};
// Tema da demo: ?tema=claro|escuro grava a preferência (só na demo) antes do app montar — capturas e links da vitrine
const aplicarTemaDaDemo = () => {
  try {
    const t = new URLSearchParams(window.location.search).get("tema");
    if (t === "claro" || t === "escuro") { localStorage.setItem(CHAVE_TEMA, t); aplicarTema(t); }
  } catch {}
};
// Tela inicial da demo: ?tela=<nav do menu> abre direto nela (links da vitrine e capturas); senão, a
// tela inicial do visitante (o Painel, ou a primeira área liberada por &acessos=). Tela fora das
// áreas liberadas: a guarda de navegação devolve para a inicial, com o aviso — a mesma regra do login real.
const telaInicialDemo = (u) => {
  try {
    const t = new URLSearchParams(window.location.search).get("tela");
    return t && TODAS_TELAS_MENU.has(t) ? t : telaInicialPermitida(u);
  } catch { return telaInicialPermitida(u); }
};
// Áreas do visitante da demo (&acessos=, ver o comentário do modo demonstração): lista de áreas,
// null para "tudo", ou undefined quando não veio nada válido (visitante com acesso total, como sempre)
const acessosDaDemo = () => {
  try {
    const v = (new URLSearchParams(window.location.search).get("acessos") || "").trim().toLowerCase();
    if (!v) return undefined;
    if (!v.includes(",")) { const p = PRESETS_ACESSOS.find(x => x.id === v); return p ? p.acessos : undefined; }
    const lista = normalizarAcessos(v.split(","));
    return lista.length ? lista : undefined;
  } catch { return undefined; }
};
// Dono (administrador) da demo: o próprio visitante, a não ser que &acessos= simule alguém do
// escritório; aí o dono é outra pessoa, que não está na lista (ver o comentário do modo demonstração)
const DEMO_DONO_OUTRO = "demo-administrador";
const donoDaDemo = () => acessosDaDemo() === undefined ? DEMO_USUARIO.id : DEMO_DONO_OUTRO;
// Usuário com as áreas que vieram da nuvem (null = tudo); devolve o MESMO objeto se nada mudou
const comAcessos = (u, acessos) => {
  const novo = normalizarAcessos(acessos);
  return JSON.stringify(novo) === JSON.stringify(normalizarAcessos(u.acessos)) ? u : { ...u, acessos: novo };
};
// Limpeza oportunista: em todo login real, apaga o que a demo deixou (chaves demo_* e o banco demo_files)
const limparRestosDemo = () => {
  try { Object.keys(localStorage).filter(k => k.startsWith("demo_")).forEach(k => localStorage.removeItem(k)); } catch {}
  try { if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase("demo_files"); } catch {}
};
// Faixa fixa no topo: ouro, 32 px, acima de tudo (os wrappers compensam com paddingTop 32)
function FaixaDemo({ onSair }) {
  return (
    <div className="km-faixa-demo" role="status" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 32, zIndex: 10000, background: GOLD, color: NAVY, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 12px", boxSizing: "border-box", fontFamily: DEFAULT_FONT }}>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Modo demonstração<span className="km-faixa-demo-longo"> — dados de exemplo</span></span>
      <button type="button" onClick={onSair} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "3px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 0, height: 24, lineHeight: "18px", fontFamily: "inherit", flexShrink: 0 }}>Sair</button>
      <a href="/?site#contato" style={{ color: NAVY, fontSize: 12, fontWeight: 700, textDecoration: "underline", whiteSpace: "nowrap", flexShrink: 0 }}>Quero na minha obra</a>
    </div>
  );
}

/* Setter do que CHEGA DA NUVEM pelo useSyncColecao: registro novo ou trocado pela nuvem entra com
   os códigos canônicos (normalizarColecao, ids.js). O sync (jsonEstavel) vê que o registro local
   ficou diferente do da nuvem e sobe o documento normalizado uma vez; a volta já vem igual e para.
   Contra laço: cada registro é normalizado no máximo UMA vez por sessão. Se a nuvem devolver o
   texto de novo (gravação recusada, ou um aparelho com versão antiga regravou), fica como veio —
   mesmoId compara igual — e não sobe de novo. `jaFeitos` é um retrato tirado antes do updater,
   para ele dar o mesmo resultado se o React o chamar duas vezes (StrictMode). */
function useSetterDaNuvem(nome, set) {
  const normalizadosRef = useRef(new Set());
  return useCallback(fn => {
    const jaFeitos = new Set(normalizadosRef.current);
    set(prev => {
      const novo = typeof fn === "function" ? fn(prev) : fn;
      if (novo === prev || !Array.isArray(novo)) return novo;
      const antes = new Set(Array.isArray(prev) ? prev : []); // mesmos objetos = não vieram agora da nuvem
      let mudou = false;
      const saida = novo.map(item => {
        if (!item || typeof item !== "object" || antes.has(item)) return item;
        const chave = String(item.id);
        if (jaFeitos.has(chave)) return item;
        const norm = normalizarColecao(nome, [item])[0];
        if (norm === item) return item;
        normalizadosRef.current.add(chave);
        mudou = true;
        return norm;
      });
      return mudou ? saida : novo;
    });
  }, [nome, set]);
}

/* RDO emitido: substitui no lugar o registro de mesmo código (o fechamento do encarregado
   atualiza o RDO do dia reaproveitando o id) e tira cópias repetidas desse código; se não
   existe, entra na frente. Um RDO por id, nunca dois. */
const upsertRdo = (lista, r) => {
  const arr = Array.isArray(lista) ? lista : [];
  const i = arr.findIndex(x => x && mesmoId(x.id, r.id));
  if (i === -1) return [r, ...arr];
  return arr.filter((x, j) => j === i || !(x && mesmoId(x.id, r.id))).map(x => (x && mesmoId(x.id, r.id) ? r : x));
};

export default function App() {
  const [tela, setTelaRaw]        = useState("login");
  // Demonstração pública (/app/?demo=1): decidido uma vez, na abertura
  const [modoDemo] = useState(detectarDemo);
  const [historicoTelas, setHistoricoTelas] = useState([]); // pilha de navegação
  const [usuario, setUsuario]     = useState(null);
  const [saidaSegura, setSaidaSegura] = useState(null);
  const [cacheBloqueado, setCacheBloqueado] = useState(null);
  const [backupSaidaConfirmado, setBackupSaidaConfirmado] = useState(false);
  if (usuario) setPerfilDados(usuario);
  const assinaturaPermissoes = JSON.stringify([usuario?.firebaseUid,usuario?.perfil,usuario?.obraId,usuario?.acessos,usuario?.ativo]);
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
      // Sem histórico: vai pra tela raiz da pessoa (Painel, a primeira área liberada, home ou login)
      setTelaRaw(telaInicialPermitida(usuario));
      return [];
    });
  };

  const [empresaIdState, setEmpresaIdState] = useState(null);
  const [usuarios, setUsuarios]   = useState([]);
  const [usuarioGoogle, setUsuarioGoogle] = useState(null); // conta Google sem empresa (primeiro acesso)
  const [erroEntrada, setErroEntrada] = useState("");        // aviso para a tela de entrada: { codigo, mensagem, email } (redirect, acesso desativado)
  const [escolhaConvite, setEscolhaConvite] = useState(null); // { usuario, convite, userGoogle }: escritório com convite de OUTRA empresa (tela convite_empresa)
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
      para: { tipo: "area", area: "suprimentos" }, navegarPara: "pedidos",
    });
  }, []);
  const mudarStatusPedidoSync = useCallback((id, status, extras = {}) => {
    // Aviso: quem pediu fica sabendo que o gestor aprovou/negou/entregou
    const antes = pedidosRef.current.find(x => mesmoId(x.id, id));
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
      if (!mesmoId(p.id, id)) return p;
      const novo = { ...p, status, ...extras };
      enviarDocNuvem("pedidos", id, novo);
      return novo;
    }));
  }, []);
  const editarPedidoSync = useCallback(pa => {
    setPedidos(ps => ps.map(p => mesmoId(p.id, pa.id) ? pa : p));
    enviarDocNuvem("pedidos", pa.id, pa);
  }, []);
  const removerPedidoSync = useCallback(id => {
    setPedidos(ps => ps.filter(p => !mesmoId(p.id, id)));
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
      if (!mesmoId(m.id, id)) return m;
      const novo = { ...m, lida: true };
      enviarDocNuvem("mensagens", id, novo);
      return novo;
    }));
  }, []);
  useEffect(() => {
    if (saidaSegura || modoDemo || !usuario?.firebaseUid) return;
    return observarColecaoNuvem("mensagens", nuvem => {
      setMensagens(loc => {
        const porId = new Map(loc.map(m => [String(m.id), m]));
        nuvem.forEach(n => porId.set(String(n.id), n));
        return [...porId.values()].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      });
    });
  }, [assinaturaPermissoes, !!saidaSegura]);

  // ── AVISOS (notificações): sininho no app + push no celular (api/notificar) ──
  const [avisos, setAvisos] = useState([]);
  const [ultimaLeituraAvisos, setUltimaLeituraAvisos] = useState(0);
  const [avisoNaTela, setAvisoNaTela] = useState(null); // faixa no topo quando o push não está ligado
  const [avisoAcesso, setAvisoAcesso] = useState(null); // "Sua conta não tem acesso a esta área" (guarda das áreas)
  const [donoUid, setDonoUid] = useState(null); // uid de quem criou a empresa (empresas/{id}.gestorUid); null = ainda não sabe
  const donoUidRef = useRef(null); donoUidRef.current = donoUid;
  // Dono na demo: o visitante, ou outra pessoa quando &acessos= simula alguém do escritório (donoDaDemo)
  const [donoDemo] = useState(() => (modoDemo ? donoDaDemo() : null));
  // ADMINISTRADOR = a conta que criou a empresa (o dono): acesso total, protegido. Só ele cria o RDO
  // de um dia que o encarregado não fechou; o escritório edita RDOs e gera o consolidado.
  // Na demo o visitante não tem firebaseUid: compara pelo id dele.
  const ehAdministrador = modoDemo ? mesmoId(donoDemo, usuario?.id) : mesmoId(donoUid, usuario?.firebaseUid);
  const enviarAviso = useCallback(async parcial => {
    const u = usuarioRef.current;
    if (!u) return { ok: false, erro: "Sem login." };
    const agora = Date.now();
    const aviso = { id: String(agora), criadoEm: agora, de: uidDe(u), deNome: u.nome || "", tipo: "manual", ...parcial };
    setAvisos(as => [aviso, ...as.filter(a => !mesmoId(a.id, aviso.id))]);
    if (modoDemo) return { ok: true }; // demo: fica só em memória (sem nuvem, sem push)
    try { return await publicarAviso(aviso); }
    catch (e) { console.error("enviarAviso:", e); return { ok: false, erro: "Não foi possível enviar agora." }; }
  }, []);
  enviarAvisoRef.current = enviarAviso;
  useEffect(() => {
    if (saidaSegura || modoDemo || !usuario?.firebaseUid || !empresaIdState) return;
    const pararA = observarAvisosNuvem(nuvem => setAvisos(loc => {
      const porId = new Map(loc.map(a => [String(a.id), a]));
      nuvem.forEach(n => porId.set(String(n.id), n));
      return [...porId.values()];
    }));
    const pararL = observarLeituraAvisos(usuario.firebaseUid, t => setUltimaLeituraAvisos(v => Math.max(v, t)));
    renovarNotificacoes(usuario);
    return () => { pararA(); pararL(); };
  }, [assinaturaPermissoes, empresaIdState, !!saidaSegura]);
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
  // Emitir = upsert (upsertRdo): o RDO do dia que o encarregado fecha de novo substitui o mesmo id
  const emitirRDOSync = useCallback(r => {
    setRdos(rs => upsertRdo(rs, r));
    enviarDocNuvem("rdos", r.id, rdoParaNuvem(r));
  }, []);
  // Editar carimba atualizadoEm: é a versão que os outros aparelhos comparam para trocar a cópia deles
  // (sempre acima da versão editada, mesmo com o relógio deste aparelho atrasado)
  const updateRDOSync = useCallback(r => {
    const novo = { ...r, atualizadoEm: Math.max(Date.now(), versaoRdo(r) + 1) };
    setRdos(rs => rs.map(x => mesmoId(x.id, novo.id) ? novo : x));
    enviarDocNuvem("rdos", novo.id, rdoParaNuvem(novo));
  }, []);
  const removeRDOSync = useCallback(id => {
    setRdos(rs => rs.filter(x => !mesmoId(x.id, id)));
    removerDocNuvem("rdos", id);
  }, []);
  // RDO de outro aparelho: id novo entra; id que este aparelho já tem é TROCADO quando a versão da nuvem
  // é mais nova (o encarregado fechou o dia de novo, o escritório editou, o fechamento caiu no RDO que o
  // administrador criou). As fotos ficam as deste aparelho (store.js mesclarRdosDaNuvem).
  useEffect(() => {
    if (saidaSegura || modoDemo || !usuario?.firebaseUid) return;
    return observarColecaoNuvem("rdos", nuvem => setRdos(loc => mesclarRdosDaNuvem(loc, nuvem)));
  }, [assinaturaPermissoes, !!saidaSegura]);
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
    enviarFotoNuvem(f).then(resultado => {
      if (!resultado?.fotoPath) return;
      setFotosObras(fs => fs.map(x => mesmoId(x.id, f.id) ? { ...x, ...resultado, fotoUrl: undefined } : x));
    }).catch(e => console.error("salvarFotoObraSync:", e));
  }, []);

  // Recebe fotos dos outros aparelhos em tempo real (gestor vê fotos do encarregado)
  useEffect(() => {
    if (saidaSegura || modoDemo || !usuario?.firebaseUid) return;
    const parar = observarFotosNuvem(nuvem => {
      setFotosObras(loc => {
        const porId = new Map(loc.filter(x => !x.fotoPath && !x.fotoUrl).map(x => [String(x.id),x]));
        const anteriores = new Map(loc.map(x => [String(x.id),x]));
        normalizarColecao('fotosObras',nuvem).forEach(x => {
          const anterior = anteriores.get(String(x.id));
          const imagemLocal = mesmoId(anterior?.obraId,x.obraId) && typeof anterior?.foto === 'string' && anterior.foto.startsWith('data:image/');
          if (x.fotoIndisponivel && imagemLocal && !anterior.fotoPath && !anterior.fotoUrl) {
            porId.set(String(x.id),anterior); // Mantém o envio ainda não confirmado sem adotar um caminho remoto.
            return;
          }
          const bytesConhecidos = x.fotoIndisponivel && !!x.fotoPath && anterior?.fotoPath === x.fotoPath
            && imagemLocal;
          porId.set(String(x.id),bytesConhecidos ? {...x,foto:anterior.foto} : x);
        });
        return [...porId.values()].sort((a,b) => Number(b.id)-Number(a.id));
      });
    });
    return parar;
  }, [assinaturaPermissoes, !!saidaSegura]);

  // Recebe pedidos de todos os aparelhos (nuvem vence em caso de mesmo id — ex: aprovação do gestor)
  useEffect(() => {
    if (saidaSegura || modoDemo || !usuario?.firebaseUid) return;
    return observarColecaoNuvem("pedidos", nuvem => {
      setPedidos(loc => {
        const porId = new Map(loc.map(p => [String(p.id), p]));
        normalizarColecao("pedidos", nuvem).forEach(n => porId.set(String(n.id), n)); // pedidos só sobem por ação (sem laço)
        return [...porId.values()].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
      });
    });
  }, [assinaturaPermissoes, !!saidaSegura]);

  // Recebe presenças de todos os aparelhos (gestor enxerga o ponto lançado na obra)
  useEffect(() => {
    if (saidaSegura || modoDemo || !usuario?.firebaseUid) return;
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
  }, [assinaturaPermissoes, !!saidaSegura]);
  const [fornecedores, setFornecedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const empresaCarregadaRef = useRef(null); // empresa cujos dados estão em memória (prefixo do localStorage)

  // Gestor: sem obra fixa cai na primeira obra. Equipe: só a obra vinculada (sem obra → aviso, nunca a obra de outro)
  const usuarioEhGestor = usuario?.perfil === "gestor";
  const temObraId = usuario?.obraId !== undefined && usuario?.obraId !== null && usuario?.obraId !== "";
  const obraVinculada = temObraId ? obras.find(o => mesmoId(o.id, usuario.obraId)) || null : null;
  const obraAtual = (usuarioEhGestor || !usuario) ? (obraVinculada || obras[0]) : obraVinculada;
  const presencasHoje = historico[hojeStr()] || {};

  const assinaturaEscopo = u => JSON.stringify([u?.perfil,u?.obraId,u?.acessos]);
  const revogarSessaoLocal = async u => {
    // Os dados locais podem conter edições únicas. Bloqueia leitura e novas
    // gravações antes do signOut; a recuperação do cache é um fluxo separado.
    suspenderPersistencia(true);
    setPerfilDados(null);
    setUsuario(null);
    localStorage.removeItem('_kmzero_sessao');
    setErroEntrada({codigo:'acesso-desativado',email:u?.email || ''});
    setTelaRaw('login');
    await logoutFirebase();
  };
  const aplicarPerfilVerificado = (u, p) => {
    const novo = {...aplicarPerfilNuvem(u,p),ativo:true};
    if (assinaturaEscopo(novo) !== assinaturaEscopo(u)) {
      // Não aplicar uma área nova sobre os arrays da permissão anterior. O boot
      // confere o cache antes de hidratar, preservando qualquer edição única.
      store.set('usuarioLogado',novo);
      suspenderPersistencia(true);
      window.location.reload();
      return;
    }
    if (jsonEstavel(novo) !== jsonEstavel(u)) {
      setUsuario(novo);
      store.set('usuarioLogado',novo);
    }
  };
  const conferirCacheAntesDeAbrir = async u => {
    const higiene = higienizarCachePermissoes(u);
    if (higiene.ok) return true;
    suspenderPersistencia(true);
    setPerfilDados(null);
    setUsuario(null);
    const dono = await carregarDonoEmpresa();
    setCacheBloqueado({empresaId:u.empresaId,perfil:u,dono:dono === u.firebaseUid,seguranca:false});
    setCarregando(false);
    return false;
  };

  // Confere na nuvem se o acesso ainda vale; qualquer mudança de escopo usa o
  // mesmo caminho de recarga empregado pelo listener ao vivo.
  const verificarAcessoNuvem = async (u) => {
    if (!u?.firebaseUid) return;
    const p = await carregarPerfilNuvem(u.firebaseUid);
    if (!p.ok) return; // sem internet ou regras: mantém a sessão (offline-first)
    if (!p.perfil || p.perfil.ativo === false || p.perfil.empresaId !== u.empresaId) return revogarSessaoLocal(u);
    if (u.perfil !== "gestor") {
      aplicarPerfilVerificado(u,p.perfil);
    } else {
      // Escritório. O dono da empresa nunca fica trancado para fora: se o perfil dele aparecer
      // limitado (áreas) ou rebaixado, volta sozinho para acesso total (as regras só deixam o
      // próprio dono fazer isso). Para os outros, restaurarDonoNuvem só confere e devolve null.
      let perfilNuvem = p.perfil;
      if (perfilNuvem.perfil !== "gestor" || lerAcessos(perfilNuvem) !== null) {
        perfilNuvem = (await restaurarDonoNuvem(u.firebaseUid, perfilNuvem)) || perfilNuvem;
      }
      aplicarPerfilDoEscritorio(u, perfilNuvem);
    }
  };
  // Sessão aberta de quem está no escritório diante do perfil da nuvem (usuarios/{uid}) — a nuvem manda:
  //  - continua "gestor": só as áreas (acessos) podem ter mudado em Usuários e acessos;
  //  - deixou de ser "gestor" (rebaixado para a equipe de campo): vira encarregado JÁ nesta sessão
  //    e vai para o Início do app de campo. Nunca vira "Tudo" (na dúvida, menos acesso).
  const aplicarPerfilDoEscritorio = (u, perfilNuvem) => {
    aplicarPerfilVerificado(u,perfilNuvem);
  };

  // Semente da demonstração: grava cada coleção com o MESMO nome de chave que o boot
  // abaixo lê com store.get (o prefixo demo_ vem de setEmpresaId(DEMO_ID)).
  const semearDemo = async () => {
    const d = gerarDadosDemo({ links: LINKS_PADRAO });
    const chaves = {
      obras: d.obras, trabalhadores: d.trabalhadores, equips: d.equips, pedidos: d.pedidos,
      historico: d.historico, usuarios: d.usuarios, mensagens: d.mensagens, diario: d.diario,
      ativos: d.ativos, abastecimentos: d.abastecimentos, ferias: d.ferias, rdos: d.rdosEmitidos,
      empresa: d.empresa, produtividade: d.produtividade, recebimentos: d.recebimentos,
      movimentacoes: d.movimentacoes, ferramentas: d.ferramentas, links: d.links,
      adiantamentos: d.adiantamentos, manutencoes: d.manutencoes, folhasSalvas: d.folhasSalvas,
      cronogramas: d.cronogramas, movEquip: d.movEquip, despesasAvulsas: d.despesasAvulsas,
      fotosObras: d.fotosObras, fornecedores: d.fornecedores, clientes: d.clientes,
    };
    for (const [k, v] of Object.entries(chaves)) await store.set(k, v);
  };

  useEffect(() => {
    (async () => {
      let perfilBoot = null;
      if (!modoDemo) {
        await registrarAbaProtegida();
        if (lerLimpezaPendente()) {
          await aguardarSessao();
          const limpeza = await concluirLimpezaPendente();
          if (!limpeza.ok) { setErroEntrada({mensagem:limpeza.erro}); setCarregando(false); return; }
          window.location.reload(); return;
        }
      }
      if (modoDemo) {
        // Demo: empresa "demo" (prefixo demo_ / demo_files), nuvem desligada, nada de _kmzero_*
        setModoDemo(true);
        aplicarTemaDaDemo();
        setEmpresaId(DEMO_ID);
        setEmpresaIdState(DEMO_ID);
        empresaCarregadaRef.current = DEMO_ID;
        let semeada = false;
        try { semeada = localStorage.getItem(CHAVE_SEMENTE_DEMO) === "1"; } catch {}
        if (!semeada) {
          await semearDemo();
          try { localStorage.setItem(CHAVE_SEMENTE_DEMO, "1"); } catch {}
        }
      } else {
        const cachedEmpresaId = localStorage.getItem("_kmzero_empresaId");
        empresaCarregadaRef.current = cachedEmpresaId || null;
        if (cachedEmpresaId) {
          setEmpresaId(cachedEmpresaId);
          setEmpresaIdState(cachedEmpresaId);
          const sessao = await aguardarSessao();
          const anterior = await store.get('usuarioLogado');
          const dono = donoCacheLocal(cachedEmpresaId) || anterior?.firebaseUid;
          if (sessao && dono && sessao.uid !== dono) {
            setErroEntrada({mensagem:'Este navegador guarda trabalho de outra conta. Entre com a conta anterior e use Sair e limpar para preservar uma cópia antes de trocar.'});
            setCarregando(false); return;
          }
          if (sessao && anterior?.firebaseUid === sessao.uid) {
            const resultado = await carregarPerfilNuvem(sessao.uid);
            if (resultado.ok && resultado.perfil?.ativo !== false && resultado.perfil?.empresaId === cachedEmpresaId) {
              perfilBoot = {...anterior,...aplicarPerfilNuvem(anterior,resultado.perfil),ativo:true};
              setPerfilDados(perfilBoot);
              if (!(await conferirCacheAntesDeAbrir(perfilBoot))) return;
              marcarDonoCacheLocal(cachedEmpresaId,sessao.uid);
            }
          }
        }
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
      const userLogado = perfilBoot;
      // Códigos gravados como texto (select, versões antigas, nuvem) entram canônicos: normalizarColecao
      // (ids.js) em cada coleção, com os campos de CAMPOS_ID_COLECAO. Os efeitos store.set logo abaixo
      // regravam o localStorage já normalizado. Coleção sem campos de código volta igual.
      const n = normalizarColecao;
      if (obras_)   setObras(n("obras", obras_));
      if (trab_)    setTrab(n("trabalhadores", trab_));
      if (equips_)  setEquips(n("equips", equips_));
      if (pedidos_) setPedidos(n("pedidos", pedidos_));
      if (hist_)    setHistorico(hist_);
      if (users_)   setUsuarios(n("usuarios", users_));
      if (msgs_)    setMensagens(msgs_);
      if (diario_)  setDiario(n("diario", diario_));
      if (ativos_)  setAtivos(n("ativos", ativos_));
      if (abast_)   setAbast(n("abastecimentos", abast_));
      if (ferias_)  setFerias(n("ferias", ferias_));
      if (rdos_)    setRdos(n("rdos", rdos_));
      if (emp_)     setEmpresa(emp_);
      if (prod_)    setProd(n("produtividade", prod_));
      if (receb_)   setReceb(n("recebimentos", receb_));
      if (mov_)     setMov(n("movimentacoes", mov_));
      if (ferr_)    setFerr(n("ferramentas", ferr_));
      if (links_)   setLinks(links_);
      if (adiant_)  setAdiant(n("adiantamentos", adiant_));
      if (manut_)   setManut(n("manutencoes", manut_));
      if (folhas_)  setFolhasSalvas(n("folhasSalvas", folhas_));
      if (cron_)    setCronog(cron_);
      if (movE_)    setMovEquip(n("movEquip", movE_));
      if (despAv_)  setDespesasAvulsas(n("despesasAvulsas", despAv_));
      if (fotos_)   setFotosObras(n("fotosObras", fotos_));
      if (forn_)    setFornecedores(n("fornecedores", forn_));
      if (clientes_) setClientes(n("clientes", clientes_));
      if (modoDemo) {
        // Visitante gestor, sem conta Google: nunca chama aguardarSessao/resultadoRedirecionamento/
        // verificarAcessoNuvem (restaurariam a conta real do navegador) e nunca grava _kmzero_sessao.
        // &acessos= aplica um pacote de áreas ao visitante (testar os perfis do escritório)
        const acessosDemo = acessosDaDemo();
        const visitante = acessosDemo === undefined ? DEMO_USUARIO : { ...DEMO_USUARIO, acessos: acessosDemo };
        setUsuario(visitante);
        setAvisos(gerarAvisosDemo()); // avisos só existem na nuvem; na demo ficam em memória
        setTelaRaw(telaInicialDemo(visitante));
      } else if (userLogado) {
        limparRestosDemo(); // login real: o que a demo deixou neste navegador sai
        if (userLogado.empresaId) {
          setEmpresaId(userLogado.empresaId);
          setEmpresaIdState(userLogado.empresaId);
        }
        setUsuario(userLogado);
        setTela(telaInicialPermitida(userLogado));
        localStorage.setItem("_kmzero_sessao", "1"); // a vitrine (/) manda direto para /app/
        // em segundo plano; depois, se for escritório com convite de OUTRA empresa, pergunta (como no login)
        verificarAcessoNuvem(userLogado).then(() => oferecerConviteOutraEmpresa(userLogado)).catch(e => console.warn("entrada:", e));
      } else {
        // Sem sessão local: pode ser a volta do login por redirecionamento (Google),
        // ou a sessão Google gravada no aparelho ainda vale (ex.: app fechado no meio do 1º acesso).
        const viaRedirect = await resultadoRedirecionamento();
        if (viaRedirect && viaRedirect.erro) setErroEntrada({ codigo: viaRedirect.codigo || "", mensagem: viaRedirect.erro });
        const sessao = (viaRedirect && viaRedirect.uid) ? viaRedirect : await aguardarSessao();
        if (sessao) {
          const fim = await concluirLoginGoogle(sessao);
          if (fim && !fim.ok && (fim.erro || fim.codigo)) setErroEntrada({ codigo: fim.codigo || "", mensagem: fim.erro || "", email: fim.email || "" });
        } else if (viaRedirect && viaRedirect.semUsuario) {
          // Saiu para o Google e voltou sem conta (Safari com o app instalado, por exemplo)
          setErroEntrada({ codigo: "redirect-sem-usuario" });
        }
      }

      // ⭐ AUTO-POPULA 30 DIAS apenas se ativado manualmente em Sistema > Gerar 30 dias
      // (Desativado por padrão para produção - usuário deve gerar manualmente se quiser teste)
      // if (!hist_ || Object.keys(hist_).length === 0) { ... }

      setCarregando(false);
    })().catch(e => {
      suspenderPersistencia(true);
      setErroEntrada({mensagem:e?.message || 'Não foi possível conferir a sessão. Recarregue para tentar novamente.'});
      setCarregando(false);
    });
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
  const syncAtivo = !cacheBloqueado && !saidaSegura && !modoDemo && !carregando && !!usuario?.firebaseUid && !!empresaIdState;
  useEffect(() => {
    if (!syncAtivo) return;
    return observarMeuPerfil(p => {
      const atual = usuarioRef.current;
      if (!atual) return;
      if (!p || p.ativo === false || p.empresaId !== atual.empresaId) {
        revogarSessaoLocal(atual);
        return;
      }
      aplicarPerfilVerificado(atual,p);
    });
  },[syncAtivo,usuario?.firebaseUid,empresaIdState]);

  // O que chega da nuvem entra com os códigos canônicos (useSetterDaNuvem: sobe normalizado uma vez, sem laço)
  const setObrasNuvem    = useSetterDaNuvem("obras", setObras);
  const setTrabNuvem     = useSetterDaNuvem("trabalhadores", setTrab);
  const setEquipsNuvem   = useSetterDaNuvem("equips", setEquips);
  const setFornNuvem     = useSetterDaNuvem("fornecedores", setFornecedores);
  const setClientesNuvem = useSetterDaNuvem("clientes", setClientes);
  const setAtivosNuvem   = useSetterDaNuvem("ativos", setAtivos);
  const setFerrNuvem     = useSetterDaNuvem("ferramentas", setFerr);
  const setFeriasNuvem   = useSetterDaNuvem("ferias", setFerias);
  const setManutNuvem    = useSetterDaNuvem("manutencoes", setManut);
  const setDiarioNuvem   = useSetterDaNuvem("diario", setDiario);
  const setAbastNuvem    = useSetterDaNuvem("abastecimentos", setAbast);
  const setAdiantNuvem   = useSetterDaNuvem("adiantamentos", setAdiant);
  const setMovNuvem      = useSetterDaNuvem("movimentacoes", setMov);
  const setMovEquipNuvem = useSetterDaNuvem("movEquip", setMovEquip);
  const setDespAvNuvem   = useSetterDaNuvem("despesasAvulsas", setDespesasAvulsas);
  const setRecebNuvem    = useSetterDaNuvem("recebimentos", setReceb);
  const setProdNuvem     = useSetterDaNuvem("produtividade", setProd);
  const setFolhasNuvem   = useSetterDaNuvem("folhasSalvas", setFolhasSalvas);

  useSyncColecao("obras",           obras,           setObrasNuvem,      syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("trabalhadores",   trabalhadores,   setTrabNuvem,       syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("equips",          equips,          setEquipsNuvem,     syncAtivo, { ordenar: porIdAsc });
  // Dono da empresa (empresas/{id}.gestorUid): o cartão dele fica travado em Usuários e acessos
  // e a sessão dele nunca fica limitada (ver verificarAcessoNuvem)
  useEffect(() => {
    if (!syncAtivo || usuario?.perfil !== "gestor") return;
    let vivo = true;
    carregarDonoEmpresa().then(uid => {
      if (!vivo) return;
      setDonoUid(uid);
      const u = usuarioRef.current;
      if (uid && mesmoId(u?.firebaseUid, uid) && u.acessos != null) verificarAcessoNuvem(u); // dono limitado: se restaura
    });
    return () => { vivo = false; };
  }, [syncAtivo, assinaturaPermissoes, empresaIdState]);
  // O perfil da própria pessoa mudou na nuvem (alguém ajustou em Usuários e acessos): vale na
  // hora, sem sair e entrar — áreas novas, ou rebaixado para a equipe de campo (vira encarregado
  // já nesta sessão, nunca "Tudo"). O dono, se aparecer limitado, confere e se restaura.
  const aplicarAcessosDaNuvem = (perfis) => {
    const u = usuarioRef.current;
    if (!u?.firebaseUid || u.perfil !== "gestor") return;
    const eu = (perfis || []).find(p => mesmoId(p.firebaseUid, u.firebaseUid));
    if (!eu || !("acessos" in eu)) return;
    const limitado = eu.perfil !== "gestor" || eu.acessos !== null;
    if (limitado && mesmoId(donoUidRef.current, u.firebaseUid)) { verificarAcessoNuvem(u); return; }
    aplicarPerfilDoEscritorio(u, eu);
  };
  // Equipe com acesso ao app = perfis da nuvem (usuarios/) + convites pendentes (só o gestor vê).
  // Substitui a lista local: quem entra é quem tem conta Google com perfil na empresa.
  // O convite continua na nuvem depois do 1º login: convite de e-mail que já tem perfil NÃO entra
  // na lista (a pessoa já aparece pelo perfil; editar o convite não mudaria o acesso dela, e o
  // cartão "Convite pendente" seria falso). Isso também tira da lista o convite da própria pessoa.
  // O convite escondido não é uma porta dos fundos: ele acompanha o perfil (tipo, áreas e ativo,
  // em alinharConviteAoPerfil), as regras exigem que o perfil refeito por ele tenha o e-mail da
  // própria conta e quem foi desativado não apaga o próprio perfil para refazê-lo.
  useEffect(() => {
    if (!syncAtivo) return;
    let perfis = null, convites = [];
    const publicar = () => {
      if (!perfis) return;
      const comPerfil = new Set(perfis.map(p => (p.email || "").toLowerCase()).filter(Boolean));
      setUsuarios(normalizarColecao("usuarios", [...perfis, ...convites.filter(c => !comPerfil.has((c.email || "").toLowerCase()))])); // obraId canônico (usuários só sobem por ação)
    };
    const paradas = [observarEquipeNuvem(ps => { perfis = ps; publicar(); })];
    if (usuario?.perfil === "gestor") paradas.push(observarConvitesNuvem(cs => { convites = cs; publicar(); }));
    return () => paradas.forEach(p => { try { p && p(); } catch {} });
  }, [syncAtivo, assinaturaPermissoes, empresaIdState]);
  useSyncColecao("fornecedores",    fornecedores,    setFornNuvem,       syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("clientes",        clientes,        setClientesNuvem,   syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("ativos",          ativos,          setAtivosNuvem,     syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("ferramentas",     ferramentas,     setFerrNuvem,       syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("links",           links,           setLinks,           syncAtivo, { ordenar: porIdAsc }); // sem campos de código
  useSyncColecao("ferias",          ferias,          setFeriasNuvem,     syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("manutencoes",     manutencoes,     setManutNuvem,      syncAtivo, { ordenar: porIdAsc });
  useSyncColecao("diario",          diario,          setDiarioNuvem,     syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("abastecimentos",  abastecimentos,  setAbastNuvem,      syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("adiantamentos",   adiantamentos,   setAdiantNuvem,     syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("movimentacoes",   movimentacoes,   setMovNuvem,        syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("movEquip",        movEquip,        setMovEquipNuvem,   syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("despesasAvulsas", despesasAvulsas, setDespAvNuvem,     syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("recebimentos",    recebimentos,    setRecebNuvem,      syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("produtividade",   produtividade,   setProdNuvem,       syncAtivo, { ordenar: porIdDesc });
  useSyncColecao("folhasSalvas",    folhasSalvas,    setFolhasNuvem,     syncAtivo, { ordenar: porIdDesc });

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
    else enviarDocNuvem("presencas", `${dataISO}_${trabId}`, { data: dataISO, trabId: normId(trabId), obraId: trabalhadores.find(t => mesmoId(t.id,trabId))?.obraId ?? null, status, criadoEm: Date.now(), editadoPorGestor: true });
  };

  const salvarPresencas = (novas) => {
    const dia = hojeStr();
    setHistorico(h => ({ ...h, [dia]: { ...(h[dia] || {}), ...novas } }));
    // Nuvem: 1 documento por dia+trabalhador (gestor vê de qualquer cidade)
    Object.entries(novas).forEach(([trabId, status]) => {
      const tid = normId(trabId);
      enviarDocNuvem("presencas", `${dia}_${trabId}`, { data: dia, trabId: tid, obraId: trabalhadores.find(t => mesmoId(t.id,trabId))?.obraId ?? null, status, criadoEm: Date.now() });
    });
  };
  const verTrabalhador = (t) => { setTrabSelecionado(t); setTela("trab_detalhe"); };
  const editarTrabalhador = (t) => {
    setTrab(ts => ts.map(x => mesmoId(x.id, t.id) ? t : x));
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
  const mesclarPorId = (atual, novos0, nome) => {
    if (!Array.isArray(novos0)) return atual;
    const novos = normalizarColecao(nome, novos0); // códigos do arquivo entram canônicos
    const m = new Map((Array.isArray(atual) ? atual : []).map(x => [String(x?.id), x]));
    novos.forEach(x => { if (x && x.id !== undefined && x.id !== null) m.set(String(x.id), x); });
    return [...m.values()];
  };
  const restaurarBackup = (dados) => {
    if (dados.obras) setObras(a => mesclarPorId(a, dados.obras, "obras"));
    if (dados.trabalhadores) setTrab(a => mesclarPorId(a, dados.trabalhadores, "trabalhadores"));
    if (dados.equips) setEquips(a => mesclarPorId(a, dados.equips, "equips"));
    if (dados.pedidos) setPedidos(a => mesclarPorId(a, dados.pedidos, "pedidos"));
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
          const tid = normId(trabId);
          enviarDocNuvem("presencas", `${dia}_${trabId}`, { data: dia, trabId: tid, obraId: (dados.trabalhadores || trabalhadores).find(t => mesmoId(t.id,trabId))?.obraId ?? null, status, criadoEm: Date.now(), importado: true });
        }));
      }
    }
    if (dados.usuarios) setUsuarios(a => mesclarPorId(a, dados.usuarios, "usuarios"));
    if (dados.mensagens) setMensagens(a => mesclarPorId(a, dados.mensagens, "mensagens"));
    if (dados.diario) setDiario(a => mesclarPorId(a, dados.diario, "diario"));
    if (dados.ativos) setAtivos(a => mesclarPorId(a, dados.ativos, "ativos"));
    if (dados.abastecimentos) setAbast(a => mesclarPorId(a, dados.abastecimentos, "abastecimentos"));
    if (dados.ferias) setFerias(a => mesclarPorId(a, dados.ferias, "ferias"));
    if (dados.rdosEmitidos) setRdos(a => mesclarPorId(a, dados.rdosEmitidos, "rdosEmitidos"));
    if (dados.empresa) setEmpresa(e => ({ ...e, ...dados.empresa }));
    if (dados.produtividade) setProd(a => mesclarPorId(a, dados.produtividade, "produtividade"));
    if (dados.recebimentos) setReceb(a => mesclarPorId(a, dados.recebimentos, "recebimentos"));
    if (dados.movimentacoes) setMov(a => mesclarPorId(a, dados.movimentacoes, "movimentacoes"));
    if (dados.ferramentas) setFerr(a => mesclarPorId(a, dados.ferramentas, "ferramentas"));
    if (dados.links) setLinks(a => mesclarPorId(a, dados.links, "links"));
    if (dados.adiantamentos) setAdiant(a => mesclarPorId(a, dados.adiantamentos, "adiantamentos"));
    if (dados.manutencoes) setManut(a => mesclarPorId(a, dados.manutencoes, "manutencoes"));
    if (dados.folhasSalvas) setFolhasSalvas(a => mesclarPorId(a, dados.folhasSalvas, "folhasSalvas"));
    if (dados.cronogramas) setCronog(c => ({ ...c, ...dados.cronogramas }));
    if (dados.movEquip) setMovEquip(a => mesclarPorId(a, dados.movEquip, "movEquip"));
    if (dados.despesasAvulsas) setDespesasAvulsas(a => mesclarPorId(a, dados.despesasAvulsas, "despesasAvulsas"));
    if (dados.fotosObras) setFotosObras(a => mesclarPorId(a, dados.fotosObras.map(f => normalizarFotoLocalPrivada(f,getEmpresaId())), "fotosObras"));
    if (dados.fornecedores) setFornecedores(a => mesclarPorId(a, dados.fornecedores, "fornecedores"));
    if (dados.clientes) setClientes(a => mesclarPorId(a, dados.clientes, "clientes"));
  };

  const upsertUsuarioLista = (lista, u) => {
    const arr = Array.isArray(lista) ? lista : [];
    const idx = arr.findIndex(x => mesmoId(x.id, u.id) || (mesmoId(x.firebaseUid, u.firebaseUid) && x.perfil === u.perfil));
    if (idx === -1) return [...arr, u];
    return arr.map((x, i) => i === idx ? { ...x, ...u } : x);
  };

  // Depois de "Entrar com Google": perfil → entra; convite → cria o perfil e entra; nada → primeiro acesso
  const concluirLoginGoogle = async (userGoogle) => {
    const r = await resolverEntradaGoogle(userGoogle);
    if (r.tipo === "perfil") { await login(r.usuario); return { ok: true }; } // r.usuario já traz acessos (store.js)
    if (r.tipo === "sem_convite") { setUsuarioGoogle(userGoogle); setTelaRaw("primeiro_acesso"); return { ok: true, semConvite: true }; }
    // Escritório com convite de OUTRA empresa (criou a própria antes de ser convidado): a pessoa escolhe
    if (r.tipo === "convite_outra_empresa") { abrirEscolhaConvite({ usuario: r.usuario, convite: r.convite, userGoogle }); return { ok: true, escolha: true }; }
    if (r.desativado) { try { await logoutFirebase(); } catch {} }
    // O e-mail EXATO da conta Google vai junto em todo erro (a tela de entrada mostra para a pessoa conferir)
    return { ok: false, erro: r.erro, codigo: r.codigo || "", email: r.email || userGoogle?.email || "" };
  };

  // Convite de outra empresa para quem já tem a própria (login e sessão aberta neste aparelho)
  const abrirEscolhaConvite = (escolha) => {
    setEscolhaConvite(escolha);
    setHistoricoTelas([]);
    setTelaRaw("convite_empresa");
  };
  // Sessão já aberta (não passa por resolverEntradaGoogle): faz a mesma pergunta, em segundo plano
  const oferecerConviteOutraEmpresa = async (u) => {
    if (!u?.firebaseUid || u.perfil !== "gestor" || !u.empresaId) return;
    const convite = await conviteDeOutraEmpresa(u.email, u, u.firebaseUid); // só dono de empresa vazia (store.js)
    if (!convite || !mesmoId(usuarioRef.current?.firebaseUid, u.firebaseUid)) return; // saiu ou trocou de conta no meio
    abrirEscolhaConvite({ usuario: u, convite, userGoogle: { uid: u.firebaseUid, email: u.email, nome: u.nome, foto: u.foto } });
  };
  const entrarNoConvite = async () => {
    const e = escolhaConvite;
    if (!e) return { ok: false, erro: "Entre com o Google de novo." };
    const r = await trocarParaConvite(e.userGoogle, e.convite);
    if (!r.ok) return { ok: false, erro: r.erro, codigo: r.codigo || "", email: e.usuario?.email || "" };
    await login(r.usuario); // empresa nova: grava a sessão e recarrega já nela
    return { ok: true };
  };
  const continuarNaMinhaEmpresa = async () => {
    const e = escolhaConvite;
    if (!e) { setTelaRaw("login"); return; }
    guardarRecusaConvite(e.usuario?.email, e.convite); // não pergunta de novo por este convite neste aparelho
    setEscolhaConvite(null);
    // Sessão já aberta: volta para onde estava (o usuário em memória já foi conferido na nuvem)
    const atual = usuarioRef.current;
    if (atual && mesmoId(atual.firebaseUid, e.usuario?.firebaseUid)) { setTelaRaw(telaInicialPermitida(atual)); return; }
    await login(e.usuario);
  };

  const login = async (u) => {
    limparRestosDemo(); // login real: apaga demo_* e demo_files deixados pela demonstração
    const eidNovo = u.empresaId || null;
    if (eidNovo) {
      const anterior = donoCacheLocal(eidNovo);
      if (anterior && anterior !== u.firebaseUid) {
        setErroEntrada({mensagem:'Os dados deste aparelho pertencem a outra conta. Saia pela conta anterior e conclua a limpeza antes de trocar.'});
        setTelaRaw('login'); return;
      }
      // A empresa atual precisa corresponder à que está sendo conferida.
      setEmpresaId(eidNovo);
      if (!(await conferirCacheAntesDeAbrir(u))) return;
      marcarDonoCacheLocal(eidNovo,u.firebaseUid);
    }
    suspenderPersistencia(false);
    setCacheBloqueado(null);
    setPerfilDados(u);
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
    setErroEntrada(""); // aviso antigo da entrada (ex.: acesso desativado) não volta no próximo login
    localStorage.setItem("_kmzero_sessao", "1"); // a página inicial (vitrine) manda direto para o app
    // Guarda/atualiza o perfil na lista deste aparelho (pra próxima vez entrar por PIN / "Continuar como")
    setUsuarios(us => upsertUsuarioLista(us, u));
    store.set("usuarioLogado", u);
    setTela(telaInicialPermitida(u)); // Painel, a primeira área liberada (escritório) ou home (campo)
  };

  // Helper: pra onde voltar baseado no perfil (e nas áreas liberadas do escritório)
  const telaInicial = () => telaInicialPermitida(usuario);
  const sairDaConta = async () => {
    suspenderPersistencia(true);
    setBackupSaidaConfirmado(false);
    setSaidaSegura({ocupado:true});
    try {
      const plano = await prepararSaida({empresaId:getEmpresaId(),uid:usuarioRef.current.firebaseUid,perfil:usuarioRef.current});
      setSaidaSegura({plano,ocupado:false});
    } catch (e) { setSaidaSegura({ocupado:false,erro:e.message}); }
  };
  const concluirSaidaSegura = async () => {
    const plano = saidaSegura?.plano;
    if (!plano) return;
    setSaidaSegura(s => ({...s,ocupado:true,erro:null}));
    try { await Promise.race([desligarNotificacoes(),new Promise(r => setTimeout(r,3000))]); } catch {}
    const resultado = await executarSaida({plano,backupConfirmado:backupSaidaConfirmado});
    if (resultado.ok) { setPerfilDados(null); window.location.reload(); return; }
    setSaidaSegura(s => ({...s,ocupado:false,erro:resultado.erro,recarregar:resultado.recarregar}));
  };
  // Sair da demonstração: apaga tudo que é demo_* (localStorage), o banco demo_files e a
  // marca da semente, e volta para a vitrine. Sem isso, qualquer "Sair" recarregaria
  // /app/?demo=1 e entraria na demo de novo.
  const sairDemo = async () => {
    try { await store.clear(); } catch {}
    try { if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase("demo_files"); } catch {}
    try { localStorage.removeItem(CHAVE_SEMENTE_DEMO); } catch {}
    window.location.replace("/");
  };
  // "Sair" chamado pelos botões da home/painel (confirmado=false) e pelo modal de
  // Minha Conta (confirmado=true, a pessoa já confirmou lá).
  const logout = (confirmado = false) => {
    if (modoDemo) return sairDemo();
    // Regra escolhida pelo gestor (opção A): sem internet NÃO deixa sair, porque só se
    // entra de novo com o Google e a pessoa ficaria trancada fora do app no canteiro.
    if (navigator.onLine === false) {
      alert("📵 Sem internet você não conseguiria entrar de novo.\n\nSaia quando tiver sinal.");
      return;
    }
    if (confirmado) return sairDaConta(); // veio do modal de Minha Conta: já confirmou lá
    confirmar("Sair da conta?\n\nPara entrar de novo você vai precisar de internet e da mesma conta Google.", () => sairDaConta());
  };
  const trabObra = trabalhadores.filter(t => mesmoId(t.obraId, obraAtual?.id));

  const todoEstado = { obras, trabalhadores, equips, pedidos, historico, usuarios, mensagens, diario, ativos, abastecimentos, ferias, rdosEmitidos, empresa, produtividade, recebimentos, movimentacoes, ferramentas, links, adiantamentos, manutencoes, folhasSalvas, cronogramas, movEquip, despesasAvulsas, fotosObras, fornecedores, clientes };

  // Aprovar movimentação: se for "definitivo" muda obra do trabalhador
  const salvarManutencao = (m) => {
    setManut(ms => {
      const existe = ms.find(x => mesmoId(x.id, m.id));
      if (existe) return ms.map(x => mesmoId(x.id, m.id) ? m : x);
      return [...ms, m];
    });
  };

  const aprovarMov = (m) => {
    setMov(ms => ms.map(x => mesmoId(x.id, m.id) ? { ...x, status: "Aprovado" } : x));
    if (m.tipo === "definitivo") {
      setTrab(ts => ts.map(t => mesmoId(t.id, m.trabId) ? { ...t, obraId: m.obraDestino } : t));
    }
    // Para "hoje" registramos transferência temporária no histórico (apenas marca)
  };

  // Movimentação de Equipamentos
  const movEquipSolicitar = (m) => {
    setMovEquip(arr => [m, ...arr]);
    // Se já vem aprovado (gestor), aplica mudança imediata
    if (m.status === "Aprovado") {
      if (m.tipoItem === "equipamento") {
        setEquips(es => es.map(e => mesmoId(e.id, m.itemId) ? { ...e, obraId: m.obraDestinoId } : e));
      } else if (m.tipoItem === "ferramenta") {
        setFerr(fs => fs.map(f => mesmoId(f.id, m.itemId) ? { ...f, obraId: m.obraDestinoId } : f));
      }
    }
  };

  const movEquipAprovar = (id) => {
    const m = movEquip.find(x => mesmoId(x.id, id));
    if (!m) return;
    setMovEquip(arr => arr.map(x => mesmoId(x.id, id) ? { ...x, status: "Aprovado" } : x));
    // Move o item pra obra destino
    if (m.tipoItem === "equipamento") {
      setEquips(es => es.map(e => mesmoId(e.id, m.itemId) ? { ...e, obraId: m.obraDestinoId } : e));
    } else if (m.tipoItem === "ferramenta") {
      setFerr(fs => fs.map(f => mesmoId(f.id, m.itemId) ? { ...f, obraId: m.obraDestinoId } : f));
    }
  };

  const movEquipNegar = (id) => {
    setMovEquip(arr => arr.map(x => mesmoId(x.id, id) ? { ...x, status: "Negado" } : x));
  };

  const movEquipDevolver = (id, transferencia = false) => {
    const m = movEquip.find(x => mesmoId(x.id, id));
    if (!m) return;
    setMovEquip(arr => arr.map(x => mesmoId(x.id, id) ? { ...x, status: transferencia ? "Concluído" : "Devolvido", dataDevolucao: new Date().toLocaleDateString("pt-BR") } : x));
    // Se for empréstimo (não transferência), volta o item pra obra origem
    if (!transferencia) {
      if (m.tipoItem === "equipamento") {
        setEquips(es => es.map(e => mesmoId(e.id, m.itemId) ? { ...e, obraId: m.obraOrigemId } : e));
      } else if (m.tipoItem === "ferramenta") {
        setFerr(fs => fs.map(f => mesmoId(f.id, m.itemId) ? { ...f, obraId: m.obraOrigemId } : f));
      }
    }
  };

  // Modo escritório: gestor logado em tela larga (>= 1024 px) vê menu lateral à esquerda
  // e a tela à direita. No celular (ou nas telas de entrada) nada muda.
  const escritorio = modoEscritorio && !!usuario && usuario.perfil === "gestor" && !["login", "registro", "primeiro_acesso", "convite_empresa"].includes(tela);
  // Só recalcula quando os dados mudam (gerarAlertas percorre várias coleções)
  const badgesMenu = useMemo(() => escritorio ? {
    pedidos: (pedidos || []).filter(p => p.status === "Aguardando").length,
    aprovar_mov: (movimentacoes || []).filter(m => m.status === "Aguardando").length,
    mov_equip: (movEquip || []).filter(m => m.status === "Aguardando").length,
    mensagens: (mensagens || []).filter(m => mesmoId(m.para, usuario.id) && !m.lida).length,
    avisos: avisosNaoLidos,
    alertas: gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos }).length,
  } : {}, [escritorio, avisosNaoLidos, pedidos, movimentacoes, mensagens, usuario, obras, trabalhadores, equips, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos]);
  // Pessoa logada para os cabeçalhos (foto do Google + nome). Gestor toca e abre "Minha conta".
  const usuarioCtx = useMemo(() => ({ usuario, onAbrirConta: usuario?.perfil === "gestor" ? () => setTela("minha_conta") : null }), [usuario]);
  // Moldura do escritório (KMHeader vira barra de página, KMFooter some, Btn fica de largura
  // automática): usa o MESMO flag `escritorio` de cima, nunca só a largura — encarregado no PC
  // e as telas de entrada continuam com a moldura do celular.
  const escritorioCtx = useMemo(() => escritorio ? { tela } : null, [escritorio, tela]);
  // Telas de entrada (sem sessão): no PC ocupam a largura toda (painel dividido em auth.jsx),
  // sem a coluna de 420 px do celular. Depende só da largura porque aqui não há gestor nem contexto.
  const telaEntrada = ["login", "primeiro_acesso", "registro", "convite_empresa"].includes(tela);

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

  // Splash único: o .loading-splash de app/index.html (fora do #root) cobre a tela até os
  // dados locais carregarem. Aqui só o fade-out — mínimo 600 ms desde a abertura da página,
  // para não piscar quando o cache é rápido. Nada de segundo splash em React.
  useEffect(() => {
    if (carregando) return;
    const splash = document.querySelector(".loading-splash");
    if (!splash) return;
    const decorrido = typeof performance !== "undefined" && performance.now ? performance.now() : 600;
    const minimo = modoDemo ? 0 : 600; // demo: sem espera mínima, a tela entra assim que a semente carrega
    const t = setTimeout(() => {
      splash.classList.add("saindo");
      setTimeout(() => splash.remove(), 400);
    }, Math.max(0, minimo - decorrido));
    return () => clearTimeout(t);
  }, [carregando]);

  // 🔒 ÁREAS DE ACESSO (usuario.acessos; regras em menuGrupos.js): gestor com áreas limitadas que
  // cair numa tela fora delas (atalho, ?tela= da demo, voltar, notificação) vai para a tela inicial
  // dele e vê um aviso curto. O menu, a busca e o Painel já escondem o que não é dele.
  const telaBloqueada = !carregando && usuario?.perfil === "gestor" && !telaPermitida(usuario, tela);
  useEffect(() => {
    if (!telaBloqueada) return;
    setHistoricoTelas([]);
    setTelaRaw(telaInicialPermitida(usuario));
    setAvisoAcesso(Date.now());
  }, [telaBloqueada, usuario, tela]);
  useEffect(() => {
    if (!avisoAcesso) return;
    const t = setTimeout(() => setAvisoAcesso(null), 5000);
    return () => clearTimeout(t);
  }, [avisoAcesso]);

  if (carregando) return null; // o splash do index.html ainda está na frente

  // 🔒 SEGURANÇA: telas restritas ao gestor (encarregado não tem acesso).
  // Derivado do menu (menuGrupos.js, inclui as telas do desenvolvedor) + telas de detalhe
  // abertas a partir dele + alias antigo "folha" + Minha conta. Antes a lista tinha 13 nomes
  // que não existiam no switch e por isso não bloqueava nada.
  const TELAS_GESTOR = new Set([
    ...TODAS_TELAS_MENU,
    "folha", "trab_detalhe", "pedido_detalhe", "mov_pess_detalhe", "mov_equip_detalhe", "anexos_obra", "minha_conta",
  ]);

  // Se for encarregado e tentar acessar tela do gestor, bloqueia
  if (usuario && usuario.perfil === "encarregado" && TELAS_GESTOR.has(tela)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <KMHeader title="Acesso restrito" sub="Apenas gestores" onBack={() => setTela("home")} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.titulo, marginBottom: 8 }}>Acesso Restrito</div>
            <div style={{ fontSize: 13, color: T.texto2, lineHeight: 1.5, marginBottom: 20 }}>
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
    if (tela === 'seguranca') return <TelaSeguranca empresaId={empresaIdState} dono={ehAdministrador} demo={modoDemo} onBack={voltar}/>;
    if (telaBloqueada) return null; // a guarda das áreas já está trocando de tela (sem piscar a proibida)
    if (usuario && !usuarioEhGestor && !obraAtual && TELAS_COM_OBRA.has(tela)) {
      return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <KMHeader title="Sem obra vinculada" sub="Fale com o gestor" onBack={() => setTela("home")} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🏗️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.titulo, marginBottom: 8 }}>Sem obra vinculada</div>
              <div style={{ fontSize: 13, color: T.texto2, lineHeight: 1.5, marginBottom: 20 }}>
                Peça ao gestor para vincular você a uma obra em Sistema → Usuários e acessos.
              </div>
              <button onClick={() => window.location.reload()} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginRight: 8 }}>🔄 Atualizar</button>
              <button onClick={() => setTela("home")} style={{ background: T.superficie2, color: T.titulo, border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>← Voltar</button>
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
      case "convite_empresa": return escolhaConvite
        ? <TelaConviteOutraEmpresa usuario={escolhaConvite.usuario} convite={escolhaConvite.convite} onEntrar={entrarNoConvite} onContinuar={continuarNaMinhaEmpresa} />
        : <TelaEntrar onGoogle={concluirLoginGoogle} erroInicial={erroEntrada} />;
      case "home":       return <TelaHome obra={obraAtual} usuario={usuario} mensagens={mensagens} trabalhadores={trabObra} presencasHoje={presencasHoje} avisosNaoLidos={avisosNaoLidos} onNav={setTela} onLogout={logout} />;
      case "fluxo":      return <FluxoEncarregado obra={obraAtual} trabalhadores={trabObra} equips={equips} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} diario={diario} usuario={usuario} empresa={empresa} historico={historico} rdosEmitidos={rdosEmitidos} fotosObras={fotosObras} onBack={() => setTela("home")} onSavePresencas={salvarPresencas} onAutoEmitirRDO={emitirRDOSync} onSalvarFotoObra={salvarFotoObraSync} />;
      case "material":   return <TelaMaterial obra={obraAtual} usuario={usuario} onBack={() => setTela("home")} onAddPedido={criarPedidoSync} />;
      case "fotos_solo": return <TelaFotos obra={obraAtual} usuario={usuario} totalFotosObra={fotosObras.filter(f => mesmoId(f.obraId, obraAtual?.id)).length} onBack={() => setTela("home")} onSalvar={salvarFotoObraSync} />;
      case "galeria":    return <TelaGaleria obras={obras} fotos={fotosObras} usuario={usuario} onBack={voltar} onRemover={id => setFotosObras(fs => fs.filter(f => !mesmoId(f.id, id)))} />;
      case "fornecedores": return <TelaFornecedores fornecedores={fornecedores} onBack={voltar} onAdd={f => setFornecedores(fs => [...fs, f])} onEditar={f => setFornecedores(fs => fs.map(x => mesmoId(x.id, f.id) ? f : x))} onRemover={id => setFornecedores(fs => fs.filter(x => !mesmoId(x.id, id)))} />;
      case "equip_solo": return <TelaEquip obra={obraAtual} equips={equips} onBack={() => setTela("home")} onSaveEquips={updated => setEquips(es => es.map(e => { const u = updated.find(u => mesmoId(u.id, e.id)); return u || e; }))} />;
      case "diario":     return <TelaDiario obra={obraAtual} usuario={usuario} diario={diario} fotosObras={fotosObras} onBack={voltar} onAdd={d => setDiario(ds => [d, ...ds])} onRemove={id => setDiario(ds => ds.filter(d => !mesmoId(d.id, id)))} onSalvarFotoObra={salvarFotoObraSync} />;
      case "gestor":     return <TelaPainelGestor obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} equips={equips} historico={historico} mensagens={mensagens} movimentacoes={movimentacoes} manutencoes={manutencoes} cronogramas={cronogramas} movEquip={movEquip} ativos={ativos} abastecimentos={abastecimentos} empresa={empresa} usuario={usuario} rdosEmitidos={rdosEmitidos} fotosObras={fotosObras} avisosNaoLidos={avisosNaoLidos} onNav={setTela} onLogout={logout} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} />;
      case "obras":      return <TelaObras usuario={usuario} usuarios={usuarios} obras={obras} clientes={clientes} trabalhadores={trabalhadores} ativos={ativos} equips={equips} ferramentas={ferramentas} pedidos={pedidos} abastecimentos={abastecimentos} manutencoes={manutencoes} cronogramas={cronogramas} historico={historico} recebimentos={recebimentos} rdosEmitidos={rdosEmitidos} onBack={voltar} onAdd={o => setObras(os => [...os, o])} onEditar={o => setObras(os => os.map(x => mesmoId(x.id, o.id) ? o : x))} onRemover={id => setObras(os => os.filter(o => !mesmoId(o.id, id)))} onNav={setTela} onNavAnexos={(obra) => { setObraAnexos(obra); setTela("anexos_obra"); }} />;
      case "cronograma": return <TelaCronograma obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "cronograma_pro": return <TelaCronogramaPro obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "mov_equip":  return <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} onVerDetalhe={m => { setMovEquipSel(m); setTela("mov_equip_detalhe"); }} />;
      case "mov_equip_detalhe": return movEquipSel ? <TelaMovEquipDetalhe mov={movEquip.find(x => mesmoId(x.id, movEquipSel.id)) || movEquipSel} obras={obras} equips={equips} ferramentas={ferramentas} usuario={usuario} onBack={voltar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} /> : <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} />;
      case "equipe":     return <TelaEquipe obras={obras} trabalhadores={trabalhadores} usuarios={usuarios} onBack={voltar} onAdd={(t) => {
        setTrab(ts => [...ts, t]);
        // Acesso ao app é separado: Sistema → Usuários e acessos (Gmail da pessoa)
      }} onRemove={(id) => {
        // Remove trabalhador
        const trab = trabalhadores.find(t => mesmoId(t.id, id));
        setTrab(ts => ts.filter(t => !mesmoId(t.id, id)));
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
      case "pedido_detalhe": return pedidoSelecionado ? <TelaPedidoDetalhe pedido={pedidos.find(x => mesmoId(x.id, pedidoSelecionado.id)) || pedidoSelecionado} obras={obras} empresa={empresa} onBack={voltar} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} onRemover={removerPedidoSync} onEditar={editarPedidoSync} /> : <TelaPedidos obras={obras} pedidos={pedidos} empresa={empresa} onBack={voltar} onVerDetalhe={p => { setPedidoSelecionado(p); setTela("pedido_detalhe"); }} onAprovar={(id, extras = {}) => mudarStatusPedidoSync(id, "Aprovado", extras)} onNegar={id => mudarStatusPedidoSync(id, "Negado")} onRemover={removerPedidoSync} />;
      case "mapa":       return <TelaMapa obras={obras} trabalhadores={trabalhadores} onBack={voltar} onEditar={() => setTela("obras")} />;
      case "clientes":  return <TelaClientes clientes={clientes} onBack={voltar} onAdd={c => setClientes(cs => [...cs, c])} onEditar={c => setClientes(cs => cs.map(x => mesmoId(x.id, c.id) ? c : x))} onRemover={id => setClientes(cs => cs.filter(x => !mesmoId(x.id, id)))} />;
      case "trab_detalhe": return <TelaTrabalhadorDetalhe trabalhador={trabSelecionado} obras={obras} historico={historico} rdosEmitidos={rdosEmitidos} empresa={empresa} usuario={usuario} onBack={voltar} onEditar={editarTrabalhador} onEditarPresenca={editarPresencaDia} />;
      case "avisos":     return <TelaAvisos usuario={usuario} usuarios={usuarios} obras={obras} avisos={avisosVisiveis} ultimaLeitura={ultimaLeituraAvisos} onEnviar={enviarAviso} onMarcarLidos={marcarAvisosLidosAgora} onNav={setTela} onBack={voltar} />;
      case "mensagens":  return <TelaMensagens usuario={usuario} usuarios={usuarios} mensagens={mensagens} onBack={voltar} onEnviar={enviarMensagemSync} onMarcarLida={marcarLidaSync} />;
      case "calendario": return <TelaCalendario obras={obras} trabalhadores={trabalhadores} historico={historico} onBack={voltar} />;
      case "equip_gestao":return <TelaEquipamentosGestao obras={obras} equips={equips} onBack={voltar} onAdd={eq => setEquips(es => [...es, eq])} onEditar={eq => setEquips(es => es.map(x => mesmoId(x.id, eq.id) ? eq : x))} onRemover={id => setEquips(es => es.filter(e => !mesmoId(e.id, id)))} />;
      case "ativos":     return <TelaAtivos obras={obras} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onAdd={a => setAtivos(as => [...as, a])} onEditar={a => setAtivos(as => as.map(x => mesmoId(x.id, a.id) ? a : x))} onRemover={id => setAtivos(as => as.filter(a => !mesmoId(a.id, id)))} onAbastecer={a => setAbast(abs => [a, ...abs])} />;
      case "frota":      return <TelaFrota obras={obras} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onNav={setTela} />;
      case "pagamentos": return <TelaPagamentos obras={obras} onBack={voltar} onEditarObra={o => setObras(os => os.map(x => mesmoId(x.id, o.id) ? o : x))} />;
      case "custos":     return <TelaCustos obras={obras} trabalhadores={trabalhadores} historico={historico} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} despesasAvulsas={despesasAvulsas} onBack={voltar} />;
      case "despesas":   return <TelaDespesasAvulsas obras={obras} despesas={despesasAvulsas} onBack={voltar} onAdd={d => setDespesasAvulsas(arr => [d, ...arr])} onEditar={d => setDespesasAvulsas(arr => arr.map(x => mesmoId(x.id, d.id) ? d : x))} onRemover={id => setDespesasAvulsas(arr => arr.filter(x => !mesmoId(x.id, id)))} />;
      case "ferias":     return <TelaFerias obras={obras} trabalhadores={trabalhadores} ferias={ferias} onBack={voltar} onAdd={f => setFerias(fs => [...fs, f])} onRemove={id => setFerias(fs => fs.filter(f => !mesmoId(f.id, id)))} />;
      case "rdo":        return <TelaRDO obras={obras} trabalhadores={trabalhadores} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} historico={historico} diario={diario} usuario={usuario} empresa={empresa} rdosEmitidos={rdosEmitidos} recebimentos={recebimentos} fotosObras={fotosObras} despesasAvulsas={despesasAvulsas} movimentacoes={movimentacoes} movEquip={movEquip} produtividade={produtividade} cronogramas={cronogramas} onBack={voltar} onEmitirRDO={emitirRDOSync} onUpdateRDO={updateRDOSync} onRemoveRDO={removeRDOSync} podeCriarRdoDia={ehAdministrador} />;
      case "empresa":    return <TelaConfigEmpresa empresa={empresa} onSave={setEmpresa} onBack={voltar} />;
      case "minha_conta": return <TelaMinhaConta usuario={usuario} empresa={empresa} demo={modoDemo} onBack={voltar} onLogout={logout} />;
      case "ajuda":      return <TelaAjuda empresa={empresa} onBack={voltar} />;
      case "acessos":    return <TelaAcessosApp usuario={usuario} usuarios={usuarios} obras={obras} empresa={empresa} demo={modoDemo} donoUid={modoDemo ? donoDemo : donoUid} onBack={voltar} />;
      case "produtividade": return <TelaProdutividade obras={obras} usuario={usuario} produtividade={produtividade} onBack={voltar} onAdd={p => setProd(ps => [p, ...ps])} onRemove={id => setProd(ps => ps.filter(p => !mesmoId(p.id, id)))} />;
      case "recebimento":   return <TelaRecebimento obras={obras} pedidos={pedidos} usuario={usuario} recebimentos={recebimentos} onBack={voltar} onAdd={r => setReceb(rs => [r, ...rs])} />;
      case "folha": // alias antigo ("Folha Mensal"): o menu e os tiles apontam para folha_quinzenal
      case "folha_quinzenal": return <TelaFolhaQuinzenal obras={obras} trabalhadores={trabalhadores} historico={historico} adiantamentos={adiantamentos} abastecimentos={abastecimentos} ativos={ativos} empresa={empresa} onBack={voltar} onSalvarFolha={f => setFolhasSalvas(fs => [f, ...fs])} onMarcarPago={(t, novaData) => editarTrabalhador({ ...t, ultimoPagamento: novaData })} onMarcarValesDescontados={marcarValesDescontados} />;
      case "hist_folha":      return <TelaHistFolha obras={obras} trabalhadores={trabalhadores} folhasSalvas={folhasSalvas} onBack={voltar} onRemover={id => { setFolhasSalvas(fs => fs.filter(f => !mesmoId(f.id, id))); setAdiant(ads => ads.map(a => mesmoId(a.folhaId, id) ? { ...a, descontadoEm: null, folhaId: null, folhaPeriodo: null, descontado: false } : a)); }} />;
      case "manutencao":      return <TelaManutencao obras={obras} ativos={ativos} ferramentas={ferramentas} equips={equips} manutencoes={manutencoes} onBack={voltar} onAdd={salvarManutencao} onRemover={id => setManut(ms => ms.filter(m => !mesmoId(m.id, id)))} />;
      case "solicitar_mov": return <TelaSolicitarMov obras={obras} trabalhadores={trabalhadores} usuario={usuario} onBack={() => setTela("home")} onSolicitar={m => setMov(ms => [m, ...ms])} />;
      case "aprovar_mov":   return <TelaAprovarMov obras={obras} trabalhadores={trabalhadores} movimentacoes={movimentacoes} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => mesmoId(m.id, id) ? { ...m, status: "Negado" } : m))} onVerDetalhe={m => { setMovPessSel(m); setTela("mov_pess_detalhe"); }} />;
      case "mov_pess_detalhe": return movPessSel ? <TelaMovPessoalDetalhe mov={movimentacoes.find(x => mesmoId(x.id, movPessSel.id)) || movPessSel} obras={obras} trabalhadores={trabalhadores} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => mesmoId(m.id, id) ? { ...m, status: "Negado" } : m))} /> : <TelaAprovarMov obras={obras} trabalhadores={trabalhadores} movimentacoes={movimentacoes} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => mesmoId(m.id, id) ? { ...m, status: "Negado" } : m))} />;
      case "ferramentas":   return <TelaFerramentas obras={obras} ferramentas={ferramentas} onBack={voltar} onAdd={f => setFerr(fs => [...fs, f])} onEditar={f => setFerr(fs => fs.map(x => mesmoId(x.id, f.id) ? f : x))} onRemover={id => setFerr(fs => fs.filter(f => !mesmoId(f.id, id)))} />;
      case "rh":            return <TelaRH obras={obras} trabalhadores={trabalhadores} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "exames":        return <TelaExames obras={obras} trabalhadores={trabalhadores} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "links":         return <TelaLinks links={links} empresa={empresa} onBack={voltar} onAdd={l => setLinks(ls => [...ls, l])} onRemover={id => setLinks(ls => ls.filter(l => !mesmoId(l.id, id)))} />;
      case "diagnostico":   return <TelaDiagnostico onNav={setTela} onBack={voltar} />;
      case "contatos":      return <TelaContatos obras={obras} trabalhadores={trabalhadores} usuarios={usuarios} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "adiantamentos": return <TelaAdiantamentos obras={obras} trabalhadores={trabalhadores} adiantamentos={adiantamentos} onBack={voltar} onAdd={a => setAdiant(ads => [a, ...ads])} onRemove={id => setAdiant(ads => ads.filter(a => !mesmoId(a.id, id)))} />;
      case "backup":     return <TelaBackup todoEstado={todoEstado} onRestaurar={restaurarBackup} onBack={voltar} />;
      case "anexos_obra": return obraAnexos ? <TelaAnexosObra obra={obraAnexos} usuario={usuario} onBack={voltar} /> : <TelaObras usuario={usuario} usuarios={usuarios} obras={obras} trabalhadores={trabalhadores} ativos={ativos} equips={equips} ferramentas={ferramentas} pedidos={pedidos} abastecimentos={abastecimentos} manutencoes={manutencoes} cronogramas={cronogramas} historico={historico} recebimentos={recebimentos} rdosEmitidos={rdosEmitidos} onBack={voltar} onAdd={o => setObras(os => [...os, o])} onEditar={o => setObras(os => os.map(x => mesmoId(x.id, o.id) ? o : x))} onRemover={id => setObras(os => os.filter(o => !mesmoId(o.id, id)))} onNav={setTela} />;

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

  if (cacheBloqueado) {
    if (cacheBloqueado.seguranca && cacheBloqueado.dono) return <TelaSeguranca empresaId={cacheBloqueado.empresaId} dono demo={false} onBack={() => setCacheBloqueado(s => ({...s,seguranca:false}))}/>;
    const prepararRecuperacao = async () => {
      setCacheBloqueado(s => ({...s,ocupado:true,erro:null}));
      try {
        const plano = await prepararRecuperacaoDono({empresaId:cacheBloqueado.empresaId,uid:cacheBloqueado.perfil.firebaseUid,perfil:cacheBloqueado.perfil});
        setCacheBloqueado(s => ({...s,plano,ocupado:false,baixado:false,confirmado:false}));
      } catch (e) { setCacheBloqueado(s => ({...s,ocupado:false,erro:e.message})); }
    };
    const baixarRecuperacao = async () => {
      setCacheBloqueado(s => ({...s,ocupado:true,erro:null}));
      try {
        if (!(await confirmarDonoNoServidor(cacheBloqueado.empresaId,cacheBloqueado.perfil.firebaseUid))) throw new Error('O servidor não confirmou a conta proprietária.');
        baixarBackupSaida(cacheBloqueado.plano);
        setCacheBloqueado(s => ({...s,ocupado:false,baixado:true}));
      } catch (e) { setCacheBloqueado(s => ({...s,ocupado:false,erro:e.message})); }
    };
    const recuperar = async () => {
      setCacheBloqueado(s => ({...s,ocupado:true,erro:null}));
      const r = await concluirRecuperacaoDono({plano:cacheBloqueado.plano,backupConfirmado:cacheBloqueado.confirmado});
      if (r.ok) { window.location.reload(); return; }
      setCacheBloqueado(s => ({...s,ocupado:false,erro:r.erro}));
    };
    return <main style={{minHeight:'100vh',background:NAVY,color:'#fff',padding:24,display:'grid',placeItems:'center'}}>
      <section style={{maxWidth:620}}>
        <h1>Preservar os dados deste aparelho</h1>
        <p>Há registros de permissões anteriores. Eles foram preservados e o aplicativo interrompeu a abertura para evitar perder alterações ou mostrar dados fora do seu acesso.</p>
        {cacheBloqueado.dono ? <>
          <p>Como proprietário, você pode guardar uma cópia integral antes de ajustar o que este aparelho mostra. A cópia inclui dados empresariais: guarde-a em um local privado.</p>
          <button disabled={cacheBloqueado.ocupado} style={bigBtn} onClick={prepararRecuperacao}>Preparar cópia de recuperação</button>
          {cacheBloqueado.plano && <>
            <button disabled={cacheBloqueado.ocupado} style={{...bigBtn,marginTop:12}} onClick={baixarRecuperacao}>Baixar cópia integral</button>
            <label style={{display:'block',margin:'20px 0'}}><input type="checkbox" disabled={!cacheBloqueado.baixado || cacheBloqueado.ocupado} checked={!!cacheBloqueado.confirmado} onChange={e => setCacheBloqueado(s => ({...s,confirmado:e.target.checked}))}/> Confirmei que o arquivo foi salvo em um local seguro.</label>
            <button disabled={!cacheBloqueado.confirmado || cacheBloqueado.ocupado} style={bigBtn} onClick={recuperar}>Ajustar acesso e abrir o aplicativo</button>
          </>}
          <button disabled={cacheBloqueado.ocupado} style={{...bigBtn,marginTop:16}} onClick={() => setCacheBloqueado(s => ({...s,seguranca:true}))}>Abrir segurança da empresa</button>
        </> : <p>Peça ao proprietário que revise a recuperação dos registros. Este perfil não pode exportar os dados que deixaram de estar autorizados.</p>}
        {cacheBloqueado.ocupado && <p role="status">Conferindo e preservando os dados…</p>}
        {cacheBloqueado.erro && <p role="alert">{cacheBloqueado.erro}</p>}
        <button disabled={cacheBloqueado.ocupado} style={{...bigBtn,marginTop:16}} onClick={() => window.location.reload()}>Conferir novamente</button>
      </section>
    </main>;
  }

  if (saidaSegura) return <main style={{minHeight:'100vh',background:NAVY,color:'#fff',padding:24,display:'grid',placeItems:'center'}}>
    <section aria-labelledby="titulo-saida" style={{maxWidth:520}}>
      <h1 id="titulo-saida">Sair e limpar este aparelho</h1>
      <p>Guarde uma cópia antes de limpar. Ela inclui arquivos que podem existir somente neste aparelho.</p>
      {saidaSegura.plano && <>
        <p>{saidaSegura.plano.totalAnexos} anexo(s) local(is) incluído(s).</p>
        <button disabled={saidaSegura.ocupado} onClick={() => {baixarBackupSaida(saidaSegura.plano);setSaidaSegura(s => ({...s,baixado:true}));}} style={bigBtn}>Baixar cópia dos dados deste aparelho</button>
        <label style={{display:'block',margin:'20px 0'}}><input type="checkbox" disabled={!saidaSegura.baixado || saidaSegura.ocupado} checked={backupSaidaConfirmado} onChange={e => setBackupSaidaConfirmado(e.target.checked)}/> Confirmei que o arquivo foi salvo em um local seguro.</label>
        <button disabled={saidaSegura.ocupado || (saidaSegura.plano.requerBackup && !backupSaidaConfirmado)} onClick={concluirSaidaSegura} style={bigBtn}>Sair e limpar dados locais</button>
      </>}
      {saidaSegura.ocupado && <p role="status">Preparando saída segura…</p>}
      {saidaSegura.erro && <p role="alert">{saidaSegura.erro}</p>}
      <button disabled={saidaSegura.ocupado} style={{...bigBtn,marginTop:16}} onClick={() => { if(saidaSegura.recarregar)window.location.reload();else{suspenderPersistencia(false);setSaidaSegura(null);} }}>{saidaSegura.recarregar ? 'Recarregar para tentar novamente':'Voltar ao aplicativo'}</button>
    </section>
  </main>;
  return (
    <UsuarioContext.Provider value={usuarioCtx}>
    <EscritorioContext.Provider value={escritorioCtx}>
    <div className={modoDemo ? "km-demo" : undefined} style={{ fontFamily: DEFAULT_FONT, backgroundColor: T.fundoExterno, minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <style>{`
        /* Modo demonstração: a faixa fixa de 32 px no topo empurra a barra de página (sticky) */
        .km-demo .km-barra-pagina { top: 32px !important; }
        @media (max-width: 479px) { .km-faixa-demo-longo { display: none; } }
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
        /* Modo escritório (gestor em tela larga): menu lateral + conteúdo na largura toda.
           Telas de entrada no PC (km-entrada): largura toda também, painel dividido em auth.jsx */
        .km-app-wrapper.km-escritorio, .km-app-wrapper.km-entrada {
          max-width: none !important;
          box-shadow: none !important;
        }
        /* Densidade do escritório: campos de 40 px (no celular continuam 46 px de toque) */
        .km-escritorio input, .km-escritorio select, .km-escritorio textarea {
          min-height: 40px !important;
          padding: 8px 12px !important;
          margin-bottom: 10px !important;
        }
        .km-escritorio textarea { min-height: 80px !important; }
        .km-escritorio input[type="checkbox"], .km-escritorio input[type="radio"] { min-height: 0 !important; padding: 0 !important; margin-bottom: 0 !important; }
        /* Linha de chips/botões lado a lado (no celular o inline style da tela empilha) */
        .km-escritorio .km-chips { display: flex !important; flex-direction: row !important; gap: 8px !important; flex-wrap: wrap; align-items: center; }
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
      {modoDemo && <FaixaDemo onSair={sairDemo} />}
      {avisoAcesso && (
        <div key={avisoAcesso} className="km-aviso-acesso" role="status" onClick={() => setAvisoAcesso(null)} style={{
          position: "fixed", top: `calc(env(safe-area-inset-top, 0px) + ${modoDemo ? 44 : 12}px)`, left: "50%", transform: "translateX(-50%)", zIndex: 10001,
          width: "max-content", maxWidth: "min(92vw, 440px)", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12,
          background: NAVY, color: "#fff", border: `2px solid ${GOLD}`, borderRadius: 14, padding: "10px 16px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)", fontFamily: DEFAULT_FONT, cursor: "pointer", textAlign: "left",
        }}>
          <Icone nome="lock" tamanho={18} cor={GOLD} />
          <span>
            <span style={{ display: "block", fontWeight: 800, fontSize: 13 }}>Sua conta não tem acesso a esta área</span>
            <span style={{ display: "block", fontSize: 12, opacity: 0.8, marginTop: 2 }}>Se precisar, peça a quem cuida dos acessos da empresa.</span>
          </span>
        </div>
      )}
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
        <div className="km-app-wrapper km-escritorio" style={{ width: "100%", maxWidth: "none", minHeight: "100vh", display: "flex", flexDirection: "row", alignItems: "stretch", backgroundColor: T.fundo, position: "relative", boxShadow: "none", ...(modoDemo ? { paddingTop: 32, boxSizing: "border-box" } : {}) }}>
          <MenuLateral tela={tela} onNav={setTela} usuario={usuario} empresa={empresa} badges={badgesMenu} onLogout={logout} topo={modoDemo ? 32 : 0} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {/* Coluna de conteúdo: largura por tipo de tela (formulário 720 / lista 1080 / painel 1400),
                fundo transparente (a página é o wrapper T.fundo; os cartões ficam em T.superficie) */}
            <div style={{ maxWidth: LARGURA_POR_TELA[tipoDaTela(tela)], margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column", padding: "24px 32px 40px", boxSizing: "border-box" }}>
              <div key={tela} className="km-tela-transicao" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                {render()}
              </div>
            </div>
          </div>
        </div>
      ) : modoEscritorio && telaEntrada ? (
        // Entrada no PC: sem a coluna de 420 px — a tela (auth.jsx/registro.jsx) desenha o painel dividido
        <div className="km-app-wrapper km-entrada" style={{ width: "100%", maxWidth: "none", minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: ESCURO.fundo, position: "relative", boxShadow: "none" }}>
          <div key={tela} className="km-tela-transicao" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {render()}
          </div>
        </div>
      ) : (
        // Wrapper do celular é a "página" do app de campo (T.fundo), não um cartão; a sombra fica porque o fundo externo é escuro nos dois temas
        <div className="km-app-wrapper" style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: T.fundo, position: "relative", boxShadow: "0 0 60px rgba(0,0,0,0.5)", ...(modoDemo ? { paddingTop: 32, boxSizing: "border-box" } : {}) }}>
          <div key={tela} className="km-tela-transicao" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {render()}
          </div>
        </div>
      )}
    </div>
    </EscritorioContext.Provider>
    </UsuarioContext.Provider>
  );
}
