import { useState } from 'react';
import './orbeEntrada.css';

// Composição local: sem vídeo, biblioteca 3D ou conexão externa na tela de acesso.
export function OrbeEntrada() {
  const [pausado, setPausado] = useState(false);
  return (
    <div className="km-orbe-palco" data-pausado={pausado ? '1' : '0'}>
      <div className="km-orbe-arte" aria-hidden="true">
        <div className="km-orbe-halo" />
        <div className="km-orbe-anel km-orbe-anel-a" />
        <div className="km-orbe-anel km-orbe-anel-b" />
        <div className="km-orbe-esfera">
          <div className="km-orbe-fluxo" />
          <div className="km-orbe-luz" />
          <div className="km-orbe-meridiano" />
        </div>
        <div className="km-orbe-base" />
      </div>
      <button type="button" className="km-orbe-pausa" aria-label={pausado ? 'Ativar animação do orbe' : 'Pausar animação do orbe'} aria-pressed={pausado} onClick={() => setPausado(v => !v)}>
        <span aria-hidden="true">{pausado ? '▷' : 'Ⅱ'}</span>
        <span>{pausado ? 'Animar' : 'Pausar'}</span>
      </button>
    </div>
  );
}
