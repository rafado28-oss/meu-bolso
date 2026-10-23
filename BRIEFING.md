# Briefing — Meu Bolso

Resultado da entrevista de oito perguntas, no formato CLARO. Vale junto com o CLAUDE.md: as regras técnicas de lá continuam valendo.

---

## C — Contexto (quem usa e onde)

- **Nome do app:** Meu Bolso.
- **Quem usa:** só eu, no celular e no computador. O celular de 390 px vem primeiro; no computador, a mesma tela aparece centralizada.
- **Onde eu lanço mais:** na fila do caixa. Em pé, com pressa, muitas vezes com uma mão só.
- **Cores e sensação:** preto e dourado, com sensação de **controle e conquista**: abrir o app é como olhar um painel que mostra que estou no comando.

---

## L — Limites (o que nunca faz e os toques máximos)

**Toques máximos:** lançar um gasto leva **no máximo 2 toques**. Digitar o valor não conta como toque.

**O que o app nunca faz:**

- Nunca pergunta senha de banco nem número de cartão.
- Nunca pede, guarda ou mostra número de conta.
- Nunca guarda a foto do cupom.
- Nunca envia e-mail ou mensagem.
- Nunca usa dado de outra pessoa.

**O que me faria abandonar o app:** não entender a tela (letra pequena, número confuso, não saber onde tocar). Por isso:

- todo texto tem pelo menos 16 px, e o total do mês é bem maior que o resto;
- todo botão tem pelo menos 48 px de altura e mostra o nome escrito, não só um desenho;
- o dourado sobre o preto tem contraste forte, fácil de ler na fila, com luz de mercado.

---

## A — Ação (o que construir)

**Uma tela só.** Na primeira vez, entro com e-mail e senha (regra do CLAUDE.md). Depois disso, o app abre direto nesta tela, que tem estas partes, de cima para baixo:

### 1. O que aparece nos cinco segundos

- No topo: **"Gasto em [mês]"** e o **total do mês até hoje**, em número grande, dourado sobre preto.
- Logo abaixo, o total de cada categoria, em tamanho menor.

### 2. Lançamento à mão (2 toques)

- **Toque 1:** no campo do valor. Abre o teclado de números e eu digito o valor.
- **Toque 2:** no botão da categoria. O gasto é salvo na hora, com a data de hoje.
- Depois de salvar, aparece por alguns segundos a frase "Lançado em [categoria]" com um botão **Desfazer**, para corrigir um toque errado sem gastar toque a mais.
- O total do topo atualiza na mesma hora.

### 3. As categorias, com os meus nomes

Seis botões grandes, sempre nesta ordem:

1. Transporte
2. Alimentação
3. Casa
4. Saúde
5. Lazer
6. Outros

### 4. Lista do mês

- Todos os gastos do mês atual, do mais recente para o mais antigo.
- Cada linha mostra a data, a categoria e o valor.
- Dá para apagar um gasto lançado errado.

### 5. Espaço do assistente (chega na sexta)

- Um espaço já reservado logo abaixo do lançamento à mão, com o aviso **"Chega na sexta"**.
- Na sexta, ele vai receber o gasto por uma frase ou pela foto do cupom. Até lá, aparece mas não faz nada.

---

## R — Resultado (a pergunta dos cinco segundos)

A pergunta **"Quanto eu já gastei este mês?"** fica respondida no topo da tela, sem eu tocar em nada e sem rolar a página.

---

## O — Observáveis (cinco testes que provam que o app está pronto)

1. **Cinco segundos.** Abro o app no celular, já com a conta entrada. Em até 5 segundos, sem tocar nem rolar, leio o total do mês no topo.
2. **Dois toques.** Lanço um gasto de teste em Alimentação: toco no campo do valor, digito, toco em Alimentação. O gasto é salvo e o total do topo aumenta na hora, sem um terceiro toque.
3. **A lista bate com o total.** Lanço três gastos de teste em categorias diferentes. Os três aparecem na lista do mês, do mais recente para o mais antigo; a soma deles bate com o total do topo e com os totais por categoria. Fecho e abro o app de novo, e tudo continua lá.
4. **Dá para entender sem explicação.** Uma pessoa que nunca viu o app consegue lançar um gasto sem ajuda. Nenhum texto tem menos de 16 px e todo botão mostra o nome escrito.
5. **Nada proibido.** Em nenhum lugar do app aparece campo pedindo senha de banco, número de cartão ou número de conta. O espaço do assistente aparece com o aviso "Chega na sexta" e ainda não faz nada.
