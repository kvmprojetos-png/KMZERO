import { NAVY, GOLD, RED } from "../theme.js";
import { AvatarUsuario, cargoDoUsuario } from "./ui.jsx";

/* Menu lateral do modo escritório (gestor em tela larga, >= 1024 px).
   No celular este componente não é renderizado — o app de campo segue igual. */

const FONTE = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

// nav = nome exato da tela no switch de KMZeroApp.jsx
const GRUPOS = [
  { titulo: "Visão geral", itens: [
    ["gestor", "Painel"], ["avisos", "Avisos"], ["alertas", "Alertas"], ["dashboard", "Dashboard"], ["mensagens", "Mensagens"],
  ] },
  { titulo: "Obras", itens: [
    ["obras", "Obras"], ["cronograma", "Cronograma"], ["mapa", "Mapa"], ["clientes", "Clientes"],
  ] },
  { titulo: "Equipe", itens: [
    ["equipe", "Equipe"], ["calendario", "Calendário"], ["folha_quinzenal", "Folha de pagamento"],
    ["hist_folha", "Histórico de folhas"], ["adiantamentos", "Adiantamentos"], ["aprovar_mov", "Movimentações"],
    ["contatos", "Contatos"], ["exames", "Exames"], ["ferias", "Férias"],
  ] },
  { titulo: "Campo", itens: [
    ["rdo", "RDO"], ["diario", "Diário de obra"], ["galeria", "Galeria de fotos"], ["produtividade", "Produtividade"],
  ] },
  { titulo: "Suprimentos", itens: [
    ["pedidos", "Pedidos"], ["recebimento", "Recebimentos"], ["fornecedores", "Fornecedores"],
  ] },
  { titulo: "Equipamentos", itens: [
    ["ativos", "Ativos e frota"], ["frota", "Combustível"], ["manutencao", "Manutenções"],
    ["equip_gestao", "Equipamentos"], ["ferramentas", "Ferramentas"], ["mov_equip", "Movimentação de equipamentos"],
  ] },
  { titulo: "Financeiro", itens: [
    ["custos", "Custos por obra"], ["pagamentos", "Pagamentos"], ["despesas", "Despesas avulsas"], ["consolidado", "Consolidado"],
  ] },
  { titulo: "Sistema", itens: [
    ["acessos", "Acessos do app"], ["empresa", "Empresa"], ["backup", "Exportar dados"], ["ajuda", "Ajuda"], ["minha_conta", "Minha conta"],
  ] },
];

export function MenuLateral({ tela, onNav, usuario, empresa, badges = {}, onLogout }) {
  const nomeEmpresa = empresa?.nomeFantasia || empresa?.razaoSocial || "Minha empresa";
  const nomeGestor = usuario?.nome || "Gestor";

  return (
    <nav
      className="km-menu-lateral"
      aria-label="Menu principal"
      style={{
        width: 240, minWidth: 240, height: "100vh", position: "sticky", top: 0,
        background: NAVY, color: "#fff", display: "flex", flexDirection: "column",
        overflowY: "auto", overflowX: "hidden", fontFamily: FONTE, flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .km-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 8px; font-size: 13px; color: #fff; background: transparent; border: none; text-align: left; cursor: pointer; font-family: inherit; min-height: 34px; box-shadow: inset 3px 0 0 transparent; transition: background 0.12s; }
        .km-menu-item:hover { background: rgba(255,255,255,0.08); }
        .km-menu-item.ativo { background: rgba(255,255,255,0.14); box-shadow: inset 3px 0 0 ${GOLD}; font-weight: 700; }
        .km-menu-item:focus-visible { outline: 2px solid ${GOLD}; outline-offset: -2px; }
        .km-menu-sair { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); cursor: pointer; font-family: inherit; }
        .km-menu-sair:hover { background: rgba(239,71,111,0.25); border-color: ${RED}; }
      `}</style>

      {/* Topo: logo + empresa + gestor */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ lineHeight: 1 }}>
          <span style={{ fontWeight: 900, fontSize: 24, color: "#fff", letterSpacing: -1 }}>KM</span>
          <span style={{ fontWeight: 900, fontSize: 24, color: GOLD, letterSpacing: -1 }}>ZERO</span>
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 2.5, marginTop: 2 }}>GESTÃO DE OBRAS</div>
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={nomeEmpresa}>{nomeEmpresa}</div>
        {/* Quem está logado — toca para abrir Minha conta */}
        <button type="button" onClick={() => onNav && onNav("minha_conta")} title={`${nomeGestor}${usuario?.email ? " · " + usuario.email : ""} — Minha conta`}
          style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxSizing: "border-box" }}>
          <AvatarUsuario usuario={usuario} tamanho={36} />
          <span style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeGestor}</span>
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cargoDoUsuario(usuario)}{usuario?.email ? " · " + usuario.email : ""}</span>
          </span>
        </button>
      </div>

      {/* Grupos e itens */}
      <div style={{ padding: "10px 10px 12px", flex: 1 }}>
        {GRUPOS.map(g => (
          <div key={g.titulo} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontWeight: 700, padding: "6px 12px 4px" }}>{g.titulo}</div>
            {g.itens.map(([nav, label]) => {
              const ativo = tela === nav;
              const n = Number(badges[nav]) || 0;
              return (
                <button
                  key={nav}
                  type="button"
                  className={"km-menu-item" + (ativo ? " ativo" : "")}
                  aria-current={ativo ? "page" : undefined}
                  onClick={() => onNav && onNav(nav)}
                >
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                  {n > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: RED, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" }}>
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Rodapé: sair */}
      <div style={{ padding: "12px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, position: "sticky", bottom: 0, background: NAVY }}>
        <button type="button" className="km-menu-sair" onClick={() => onLogout && onLogout()}>Sair</button>
      </div>
    </nav>
  );
}

export default MenuLateral;
