## Conferência do briefing — Meu Bolso

Li o BRIEFING.md, o CLAUDE.md e os seis arquivos de `app/`. Só li o código. Não abri o app nem entrei nele.

| Teste | Resultado | Motivo |
|---|---|---|
| 1. Cinco segundos | SÓ DÁ PARA SABER ABRINDO O APP | O total está no topo, em número grande e sem rolar (`app/index.html:57-63`, `app/estilo.css:385-396`). O tempo até aparecer depende da internet. Enquanto carrega, o total mostra "—" (`app/app.js:194`). A sessão fica salva pelo Supabase, então o app deve abrir direto. |
| 2. Dois toques | CUMPRE | O toque no campo do valor (`inputmode="decimal"`, `app/index.html:76`) e o toque na categoria salvam na hora, com a data de hoje (`app/app.js:324-366`). O total é redesenhado na mesma hora (`app.js:360-364`). Não há botão "Salvar" no meio. |
| 3. A lista bate com o total | CUMPRE | Total, barras e lista saem da mesma lista (`app/app.js:255-267`), somada em centavos. A ordem é do mais recente para o mais antigo (`app.js:216-219`). Os dados ficam no banco, então continuam depois de fechar e abrir. Um gasto com categoria fora da lista é somado em "Outros" (`app.js:260`). |
| 4. Dá para entender sem explicação | SÓ DÁ PARA SABER ABRINDO O APP | A parte do código cumpre. Nenhum texto fica abaixo de 16 px (`app/estilo.css:42, 164, 262, 275`). Os botões têm de 48 a 52 px ou mais (`estilo.css:201-203, 254, 682`). Todo botão mostra o nome escrito, com ícone só como enfeite (`estilo.css:564-575`). Só uma pessoa usando pela primeira vez mostra se o lançamento é compreensível. |
| 5. Nada proibido | NÃO CUMPRE | Não há campo de senha de banco, cartão ou conta. O único campo de senha é a entrada do próprio app (`app/index.html:35-38`). O espaço do assistente já funciona (frase e foto, `app/app.js:537-565`) e não diz mais "Chega na sexta" (`app/index.html:96-113`). É uma mudança prevista no CLAUDE.md, não um erro. |

**Categorias:** iguais ao briefing. Transporte, Alimentação, Casa, Saúde, Lazer e Outros, com os mesmos nomes, acentos e ordem (`app/configuracao.js:14`).

## O que falta para o app ficar como o briefing pediu

1. **Cores:** o briefing pede preto e dourado, com contraste forte do dourado sobre o preto. O app usa fundo escuro com ciano, violeta e rosa (`app/estilo.css:8-22`), e o total é branco com brilho ciano (`estilo.css:392-393`). Não há dourado. É a maior diferença entre o pedido e o que foi feito.
2. **Total em dourado:** o briefing pede o total do mês em dourado sobre preto. Hoje ele é branco (`app/estilo.css:392`).
3. **Frase depois de lançar:** o briefing pede "Lançado em [categoria]". O app mostra "Lançado: R$ X em Categoria" (`app/app.js:373`). Funciona, mas o texto é diferente.
4. **Título do topo:** o rótulo aparece como "// gasto em junho", com `//` na frente e tudo em minúsculas (`app/estilo.css:380-383`). O briefing pede "Gasto em [mês]", que fica mais fácil de ler sem o `//`.
5. **Computador em duas colunas:** o briefing diz que no computador "a mesma tela aparece centralizada". O app abre em duas colunas a partir de 1024 px (`app/estilo.css:739-757`). Foi uma decisão posterior de visual, mas o briefing não foi atualizado.
6. **Palavra "online" fixa no topo:** ela é só um enfeite e aparece mesmo sem internet (`app/index.html:52`). Pode enganar quem está sem rede.
7. **Cartão extra "Resumo da semana":** ele fica entre o assistente e a lista (`app/index.html:116`). O briefing não o previa. É opcional e só aparece quando existe um resumo.
8. **Briefing desatualizado:** o item 5 da parte A e o teste 5 ainda dizem "Chega na sexta". Convém atualizar o texto para refletir que o assistente já chegou.
9. **Conferir no celular de 390 px, com o teclado aberto:** os botões de categoria precisam continuar visíveis depois que o teclado numérico abre, para que o segundo toque seja possível. O código não permite saber isso.
