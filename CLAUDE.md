# Meu Bolso — memória do projeto

Este arquivo é a memória deste projeto. O Claude lê este arquivo toda vez que esta pasta é aberta. Tudo o que está aqui vale para qualquer conversa sobre o Meu Bolso.

---

## 1. O que é este projeto

O **Meu Bolso** é um app de gastos pessoais, feito durante a Formação Claude Pro.

- **Quem usa:** só eu, no celular e no computador.
- **O que ele faz:**
  - registra cada gasto;
  - mostra o total do mês, separado por categoria.
- **O que vem na sexta:** um assistente que lança o gasto sozinho, a partir de uma frase (por exemplo, "gastei 32 reais no almoço") ou da foto do cupom fiscal.
- **Telas e categorias:** ainda não estão definidas. Elas vão sair de uma entrevista que o Claude vai conduzir comigo.

---

## 2. Regras técnicas que não se discutem

Estas regras valem sempre. Se algum pedido parecer exigir quebrar uma delas, o Claude para e me avisa antes.

1. **Onde ficam os arquivos do app:** todos dentro da pasta `app/`, e são só estes:
   - `index.html` (a página)
   - `estilo.css` (a aparência)
   - `app.js` (o funcionamento)
   - `configuracao.js` (o endereço do banco de dados e a chave pública)
   - `manifest.webmanifest` (o que permite instalar o app no celular)
   - `icone.svg` (o ícone do app)
2. **Nada de ferramentas extras:** sem Node, sem etapa de "build" e sem framework. O app é feito só com HTML, CSS e JavaScript simples.
3. **Banco de dados (Supabase):** o acesso ao Supabase entra direto pela internet, com esta linha na página:
   `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>`
4. **Entrada no app:** por e-mail e senha, sem e-mail de confirmação.
5. **Proteção dos dados:** as tabelas `gastos` e `resumos` têm proteção por linha. Em palavras simples: cada conta só enxerga e mexe nos próprios registros.
6. **Configuração:** o endereço do projeto no Supabase e a chave pública ficam no arquivo `app/configuracao.js`, dentro de `window.MEU_BOLSO`.
7. **Chaves secretas nunca vão para arquivo nenhum:** a chave secreta do Supabase e a chave do Gemini não entram em nenhum arquivo desta pasta, em hipótese alguma.
8. **Publicação (Netlify):** na raiz da pasta fica o `netlify.toml`, que publica só a pasta `app`.
9. **O que fica de fora do Git:** na raiz fica o `.gitignore`, que deixa de fora `.env`, `.netlify` e `node_modules`.
10. **Celular primeiro:** toda tela é pensada primeiro para um celular de 390 px de largura; depois se ajusta ao computador.
11. **Mensagens de erro:** todo erro aparece para mim como uma frase em português, dizendo o que aconteceu e o que eu devo fazer.

---

## 3. O que este app nunca faz

- Nunca pede, guarda ou mostra senha de banco, número de conta ou número de cartão.
- Nunca guarda a foto do cupom. A foto é usada só para ler o gasto e depois é descartada.
- Nunca envia e-mail ou mensagem.
- Nunca usa dado de outra pessoa.

---

## 4. Como trabalhar comigo

- **Plano antes de mexer:** antes de alterar qualquer arquivo, o Claude me conta o plano em até dez linhas e espera a minha aprovação.
- **Uma mudança por vez:** cada mudança é feita sozinha, e o Claude me mostra o que mudou (o antes e o depois).
- **Entregas em arquivo:** todo resultado vai para um arquivo. Na conversa aparecem só os caminhos dos arquivos.
- **Linguagem:** sempre em português, explicado para quem não programa.
