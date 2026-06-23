import { useState } from "react";
import { NAVY, GREEN, RED, LIGHT, labelS, inputS, selS, bigBtn } from "../theme.js";
import { Btn, KMHeader, KMFooter, Modal, confirmar } from "../components/ui.jsx";

export function TelaClientes({ clientes = [], onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nome: "", documento: "", telefone: "", email: "", endereco: "", cidade: "", observacoes: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditandoId(null);
    setForm({ nome: "", documento: "", telefone: "", email: "", endereco: "", cidade: "", observacoes: "" });
    setModal(true);
  };

  const abrirEdit = (cliente) => {
    setEditandoId(cliente.id);
    setForm({ ...cliente });
    setModal(true);
  };

  const salvar = () => {
    if (!form.nome) {
      alert("Preencha o nome do cliente.");
      return;
    }
    const dados = { ...form, id: editandoId || Date.now() };
    if (editandoId) onEditar(dados);
    else onAdd(dados);
    setModal(false);
  };

  const remover = (id) => {
    confirmar("Excluir este cliente? Isso não remove as obras vinculadas.", () => onRemover(id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Clientes" sub={`${clientes.length} cadastrado(s)`} onBack={onBack} right={
        <button type="button" data-test="add-cliente" onClick={abrirNovo} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>+ Cliente</button>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {clientes.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, padding: 18, textAlign: "center", color: "#444", boxShadow: "0 1px 5px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum cliente cadastrado</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>Cadastre clientes aqui para vincular a obras e contratos.</div>
            <button type="button" data-test="empty-add-cliente" onClick={abrirNovo} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>+ Adicionar Cliente</button>
          </div>
        ) : (
          clientes.sort((a, b) => String(a.nome).localeCompare(String(b.nome))).map(cliente => (
            <div key={cliente.id} data-test={`cliente-card-${cliente.id}`} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{cliente.nome}</div>
                  {cliente.cidade && <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{cliente.cidade}</div>}
                  {cliente.documento && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{cliente.documento}</div>}
                  {(cliente.telefone || cliente.email) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 11, color: "#555" }}>
                      {cliente.telefone && <div>📞 {cliente.telefone}</div>}
                      {cliente.email && <div>✉️ {cliente.email}</div>}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <button data-test={`edit-cliente-${cliente.id}`} onClick={() => abrirEdit(cliente)} style={{ background: "none", border: "none", color: NAVY, fontSize: 14, cursor: "pointer" }}>✏️ Editar</button>
                  <button data-test={`remove-cliente-${cliente.id}`} onClick={() => remover(cliente.id)} style={{ background: "none", border: "none", color: RED, fontSize: 14, cursor: "pointer" }}>🗑️ Remover</button>
                </div>
              </div>
              {cliente.observacoes && <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>{cliente.observacoes}</div>}
            </div>
          ))
        )}
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Cliente" : "Novo Cliente"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Construtora ABC" style={inputS} />

        <label style={labelS}>Documento</label>
        <input value={form.documento} onChange={e => set("documento", e.target.value)} placeholder="CNPJ ou CPF" style={inputS} />

        <label style={labelS}>Telefone</label>
        <input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(27) 99999-9999" style={inputS} />

        <label style={labelS}>E-mail</label>
        <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="contato@cliente.com" style={inputS} />

        <label style={labelS}>Cidade / Estado</label>
        <input value={form.cidade} onChange={e => set("cidade", e.target.value)} placeholder="Ex: Vitória - ES" style={inputS} />

        <label style={labelS}>Endereço</label>
        <input value={form.endereco} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, bairro" style={inputS} />

        <label style={labelS}>Observações</label>
        <textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={3} placeholder="Contrato, condições, notas..." style={{ ...inputS, resize: "vertical", fontFamily: "inherit" }} />

        {editandoId && (
          <button data-test="modal-delete-cliente" onClick={() => { confirmar("Excluir este cliente?", () => { onRemover(editandoId); setModal(false); }); }} style={{ width: "100%", padding: 10, background: "#fee2e2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir Cliente</button>
        )}

        <Btn data-test="modal-save-cliente" label={editandoId ? "Salvar" : "Adicionar"} color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}
