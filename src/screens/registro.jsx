import { useState } from "react";
import { setEmpresaId, registrarEmpresa } from "../lib/store.js";
import { Icone } from "../components/Icones.jsx";
import { MolduraEntrada, AvisoEntrada } from "./auth.jsx";

/* Máscara de CNPJ: 00.000.000/0000-00 (só a apresentação; o valor gravado é o texto mascarado,
   como o gestor vê depois em Sistema → Empresa). */
export const mascaraCNPJ = v => String(v || "").replace(/\D/g, "").slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2")
  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2")
  .replace(/(\d{4})(\d)/, "$1-$2");

/* Cadastro da empresa. A pessoa já entrou com o Google (usuarioGoogle):
   aqui só faltam os dados essenciais (nome, empresa, telefone); o resto é
   opcional e pode ser completado depois em Sistema → Empresa. */
export function TelaRegistro({ usuarioGoogle, onBack, onRegistrado }) {
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [maisDados, setMaisDados] = useState(false);
  const [nomeGestor, setNomeGestor] = useState(usuarioGoogle?.nome || "");
  const [emp, setEmp] = useState({
    razaoSocial: "", cnpj: "", telefone: "", email: usuarioGoogle?.email || "", endereco: "",
  });
  const setE = (k, v) => setEmp(f => ({ ...f, [k]: v }));
  const email = usuarioGoogle?.email || "—";

  const validar = () => {
    if (!usuarioGoogle?.uid) return "Entre com o Google antes de criar a empresa.";
    if (!nomeGestor.trim()) return "Informe o seu nome.";
    if (!emp.razaoSocial.trim()) return "Informe o nome da empresa.";
    if (!emp.telefone.trim()) return "Informe um telefone de contato.";
    return null;
  };

  const registrar = async () => {
    if (carregando) return;
    setAviso(null);
    const e = validar();
    if (e) return setAviso({ codigo: "validacao", mensagem: e });
    setCarregando(true);
    const empresaId = await registrarEmpresa(
      {
        razaoSocial: emp.razaoSocial.trim(),
        nomeFantasia: "",
        cnpj: emp.cnpj.trim(),
        responsavel: nomeGestor.trim(), // o responsável é o próprio gestor que está criando
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
      console.warn("[KMZERO] registrarEmpresa falhou: confira a conexão e se as regras do Firebase estão publicadas (npm run firebase:deploy-regras).");
      setAviso({ codigo: "registro", mensagem: "Não foi possível criar a empresa na nuvem. Verifique a internet e tente de novo; se continuar, fale com o suporte.", suporte: true });
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

  return (
    <MolduraEntrada>
      <h1 className="km-entrada-titulo">Criar minha empresa</h1>
      <p className="km-entrada-sub">
        Você vai entrar sempre com <b>{email}</b>. Preencha só o essencial; o resto pode ser depois em Sistema → Empresa.
      </p>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(247,251,252,0.55)", marginBottom: 10 }}>Dados essenciais</div>

      <label className="km-entrada-label" htmlFor="km-reg-nome">Seu nome (como aparece no app)</label>
      <input id="km-reg-nome" className="km-entrada-input" value={nomeGestor} onChange={e => setNomeGestor(e.target.value)} placeholder="Seu nome" autoComplete="name" disabled={carregando} />

      <label className="km-entrada-label" htmlFor="km-reg-empresa">Empresa (razão social ou nome fantasia)</label>
      <input id="km-reg-empresa" className="km-entrada-input" value={emp.razaoSocial} onChange={e => setE("razaoSocial", e.target.value)} placeholder="Ex: Construtora ABC" autoComplete="organization" disabled={carregando} />

      <label className="km-entrada-label" htmlFor="km-reg-tel">Telefone</label>
      <input id="km-reg-tel" className="km-entrada-input" value={emp.telefone} onChange={e => setE("telefone", e.target.value)} placeholder="(00) 00000-0000" type="tel" autoComplete="tel" disabled={carregando} />

      <button type="button" className="km-entrada-secao" onClick={() => setMaisDados(v => !v)} aria-expanded={maisDados} aria-controls="km-reg-mais">
        <span>Mais dados (opcional)</span>
        <span aria-hidden="true" style={{ transform: maisDados ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}><Icone nome="chevron-down" tamanho={16} /></span>
      </button>
      <div id="km-reg-mais" className="km-entrada-secao-corpo" data-aberta={maisDados ? "1" : "0"}>
        <div>
          <label className="km-entrada-label" htmlFor="km-reg-cnpj">CNPJ</label>
          <input id="km-reg-cnpj" className="km-entrada-input" value={emp.cnpj} onChange={e => setE("cnpj", mascaraCNPJ(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" disabled={carregando} tabIndex={maisDados ? 0 : -1} />

          <label className="km-entrada-label" htmlFor="km-reg-email">E-mail da empresa</label>
          <input id="km-reg-email" className="km-entrada-input" value={emp.email} onChange={e => setE("email", e.target.value)} placeholder="contato@empresa.com" type="email" autoComplete="email" disabled={carregando} tabIndex={maisDados ? 0 : -1} />

          <label className="km-entrada-label" htmlFor="km-reg-end">Endereço</label>
          <input id="km-reg-end" className="km-entrada-input" value={emp.endereco} onChange={e => setE("endereco", e.target.value)} placeholder="Rua, número, cidade - UF" autoComplete="street-address" disabled={carregando} tabIndex={maisDados ? 0 : -1} />
        </div>
      </div>

      <AvisoEntrada aviso={aviso} />

      <button type="button" className="km-entrada-btn km-entrada-btn-ouro" onClick={registrar} disabled={carregando} aria-busy={carregando || undefined} style={{ marginTop: 14 }}>
        {carregando ? "Criando sua empresa…" : "Criar minha empresa"}
      </button>
      <button type="button" className="km-entrada-btn km-entrada-btn-texto" onClick={onBack} disabled={carregando}>
        Voltar
      </button>
    </MolduraEntrada>
  );
}
