# Guarda de segurança — 23/10/2026

| Arquivo | O que encontrou | Gravidade | O que fazer |
|---|---|---|---|
| Nenhum problema encontrado | Nenhuma chave secreta (`sb_secret_`, `service_role`, `AIza`, `ghp_`, `github_pat_`, `nfp_`, `sk-`, `eyJ…`), senha escrita, token fixo ou dado pessoal (e-mail, CPF, telefone, cartão, conta) em arquivo algum. A chave do Gemini vem só de `process.env.CHAVE_GEMINI` (`netlify/functions/assistente.mjs:359`), e os tokens são lidos da sessão na hora. A chave pública `sb_publishable_…` (`sb_publi…`) está só em `app/configuracao.js:11` e no topo de `netlify/functions/assistente.mjs:9`, os dois lugares permitidos. O `.gitignore` tem `.env`, `.netlify` e `node_modules`, e não existe arquivo `.env` na pasta. | Nenhuma | Nada a fazer. |

Conferi 18 arquivos das pastas raiz, `app/`, `netlify/functions/`, `supabase/`, `.claude/` (agentes e `launch.json`), deixando de fora a pasta `.git`.

PODE ENVIAR
