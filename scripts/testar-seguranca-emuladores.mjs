#!/usr/bin/env node
// Execução sequencial: todos usam os mesmos emuladores locais e datasets separados.
import { spawnSync } from "node:child_process";

for (const script of ["testar-regras-seguranca.mjs", "testar-backup-emulador.mjs", "testar-fotos-api-emulador.mjs"]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`], { stdio: "inherit", env: process.env, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
