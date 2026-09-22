import { useEffect, useRef, useState } from "react";
import {
  enviarDocNuvem, removerDocNuvem, observarColecaoNuvem,
  semDataUrl, mesclarAnexosLocais, jsonEstavel, lerIdsSync, salvarIdsSync,
} from "./store.js";

/* ─────────────────────────────────────────────────────────────────────────────
   useSyncColecao — espelha um array de objetos (cada um com `id`) na coleção
   empresas/{empresaId}/{colecao} do Firestore.

   • Recebe em tempo real o que outros aparelhos gravaram (a nuvem vence quando
     o mesmo id existe nos dois lados).
   • Envia criações, edições e remoções feitas neste aparelho.
   • Strings base64 (data:...) NÃO sobem — ficam só no aparelho. Fotos das obras
     têm o próprio fluxo (Storage). Ao receber da nuvem, os anexos locais são
     preservados.
   • Só começa a ENVIAR depois do 1º retorno da nuvem, para nunca subir dado
     antigo por cima de dado novo de outro aparelho.
   • Guarda no localStorage os ids já vistos na nuvem; assim uma remoção feita
     em outro aparelho enquanto este estava fechado é aplicada na próxima abertura.

   opcoes.ordenar(arr) → função opcional para reordenar depois de receber da nuvem.
   ───────────────────────────────────────────────────────────────────────────── */
export function useSyncColecao(colecao, itens, setItens, ativo, opcoes = {}) {
  const { ordenar } = opcoes;
  const nuvemRef = useRef(new Map());        // id → JSON estável do doc como está na nuvem
  const prontoRef = useRef(false);           // já recebeu o 1º snapshot?
  const idsAnterioresRef = useRef(null);     // ids locais na última passada (detecta remoção)
  const [versaoNuvem, setVersaoNuvem] = useState(0);

  // 1) Assina a nuvem e aplica no estado local
  useEffect(() => {
    if (!ativo) {
      nuvemRef.current = new Map();
      prontoRef.current = false;
      idsAnterioresRef.current = null;
      return;
    }
    const conhecidos = new Set(lerIdsSync(colecao));
    const parar = observarColecaoNuvem(colecao, docs => {
      const nuvem = new Map();
      docs.forEach(d => { if (d && d.id !== undefined && d.id !== null) nuvem.set(String(d.id), d); });

      setItens(loc => {
        const locArr = Array.isArray(loc) ? loc : [];
        const porId = new Map(locArr.map(x => [String(x.id), x]));
        let mudou = false;

        nuvem.forEach((docNuvem, id) => {
          const local = porId.get(id);
          const jsonNuvem = jsonEstavel(semDataUrl(docNuvem));
          nuvemRef.current.set(id, jsonNuvem);
          if (!local || jsonEstavel(semDataUrl(local)) !== jsonNuvem) {
            porId.set(id, mesclarAnexosLocais(docNuvem, local));
            mudou = true;
          }
        });

        // Removidos em outro aparelho: já estiveram na nuvem e agora não estão mais
        const sumiram = new Set();
        nuvemRef.current.forEach((_, id) => { if (!nuvem.has(id)) sumiram.add(id); });
        conhecidos.forEach(id => { if (!nuvem.has(id)) sumiram.add(id); });
        sumiram.forEach(id => {
          nuvemRef.current.delete(id);
          conhecidos.delete(id);
          if (porId.has(id)) { porId.delete(id); mudou = true; }
        });

        nuvem.forEach((_, id) => conhecidos.add(id));
        salvarIdsSync(colecao, [...conhecidos]);

        if (!mudou) return loc;
        const novo = [...porId.values()];
        return ordenar ? ordenar(novo) : novo;
      });

      prontoRef.current = true;
      setVersaoNuvem(v => v + 1);
    });
    return () => { try { parar(); } catch {} };
  }, [colecao, ativo]);

  // 2) Envia para a nuvem o que mudou localmente
  useEffect(() => {
    if (!ativo || !prontoRef.current) return;
    const arr = Array.isArray(itens) ? itens : [];
    const idsAtuais = new Set();

    arr.forEach(item => {
      if (!item || item.id === undefined || item.id === null) return;
      const id = String(item.id);
      idsAtuais.add(id);
      const limpo = semDataUrl(item);
      const json = jsonEstavel(limpo);
      if (nuvemRef.current.get(id) !== json) {
        nuvemRef.current.set(id, json);
        enviarDocNuvem(colecao, id, limpo).then(ok => { if (!ok) nuvemRef.current.delete(id); });
      }
    });

    if (idsAnterioresRef.current) {
      idsAnterioresRef.current.forEach(id => {
        if (!idsAtuais.has(id) && nuvemRef.current.has(id)) {
          nuvemRef.current.delete(id);
          removerDocNuvem(colecao, id);
        }
      });
    }
    idsAnterioresRef.current = idsAtuais;
  }, [itens, ativo, versaoNuvem, colecao]);
}

/* Ordenações prontas (ids são Date.now(), então id maior = mais novo) */
export const porIdAsc  = arr => [...arr].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
export const porIdDesc = arr => [...arr].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
