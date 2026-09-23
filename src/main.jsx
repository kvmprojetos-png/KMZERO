import React from 'react';
import ReactDOM from 'react-dom/client';
import KMZeroApp from './KMZeroApp.jsx';

// Rede de proteção: erro em qualquer tela mostra um aviso com saída, em vez de tela branca
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }
  static getDerivedStateFromError(erro) {
    return { erro };
  }
  componentDidCatch(erro, info) {
    console.error("Erro na tela:", erro, info && info.componentStack);
  }
  tentarDeNovo() {
    window.location.reload();
  }
  voltarAoInicio() {
    // A tela atual não fica gravada no localStorage (o app sempre abre na tela inicial do perfil);
    // limpa um eventual resto de navegação na URL (#/?) e recarrega
    try { window.location.replace(window.location.pathname); } catch { window.location.reload(); }
  }
  render() {
    if (!this.state.erro) return this.props.children;
    const btn = { border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", margin: 6 };
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1535", fontFamily: "'Segoe UI',sans-serif", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F2151", marginBottom: 8 }}>Algo deu errado nesta tela</div>
          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5, marginBottom: 20 }}>Seus dados estão guardados. Tente de novo ou volte ao início.</div>
          <button onClick={this.tentarDeNovo} style={{ ...btn, background: "#0F2151", color: "#fff" }}>Tentar de novo</button>
          <button onClick={this.voltarAoInicio} style={{ ...btn, background: "#eee", color: "#0F2151" }}>Voltar ao início</button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <KMZeroApp />
    </ErrorBoundary>
  </React.StrictMode>
);
