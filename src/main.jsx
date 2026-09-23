import React from 'react';
import { T, NAVY } from "./theme.js";
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './tema.css';
import KMZeroApp from './KMZeroApp.jsx';

/* Atualização forçada do PWA. O service worker novo (skipWaiting + clientsClaim) assume
   a página, mas o registro padrão do plugin não recarregava: o cliente só via a versão
   nova na SEGUNDA abertura. Aqui recarrega uma vez quando o SW troca — só se já havia
   um SW controlando (na primeira instalação não recarrega, e a flag evita loop) — e
   confere atualização a cada hora, porque o app fica aberto o dia todo no escritório. */
const tinhaSW = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
let recarregou = false;
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (tinhaSW && !recarregou) { recarregou = true; window.location.reload(); }
  });
}
registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    if (r) setInterval(() => { r.update().catch(() => {}); }, 60 * 60 * 1000);
  }
});

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--km-fundo-externo)", fontFamily: "'Segoe UI',sans-serif", padding: 20 }}>
        <div style={{ background: T.superficie, borderRadius: 16, padding: 28, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.titulo, marginBottom: 8 }}>Algo deu errado nesta tela</div>
          <div style={{ fontSize: 13, color: T.texto2, lineHeight: 1.5, marginBottom: 20 }}>Seus dados estão guardados. Tente de novo ou volte ao início.</div>
          <button onClick={this.tentarDeNovo} style={{ ...btn, background: NAVY, color: "#fff" }}>Tentar de novo</button>
          <button onClick={this.voltarAoInicio} style={{ ...btn, background: T.superficie2, color: T.titulo }}>Voltar ao início</button>
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
