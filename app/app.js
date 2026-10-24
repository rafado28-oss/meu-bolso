// Meu Bolso — o funcionamento do app.
// Usa só o cliente do Supabase (carregado pela CDN) e a configuração de configuracao.js.

(function () {
  "use strict";

  const COLUNAS = "id, data, descricao, valor, categoria, origem, criado_em";
  const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const $ = (id) => document.getElementById(id);

  const estado = {
    usuarioId: undefined, // undefined = ainda não sabemos se há alguém entrado
    gastos: [],
    ultimoLancado: null,
    tempoFaixa: null,
  };

  const CONFIG = window.MEU_BOLSO;
  if (!window.supabase || !CONFIG) {
    $("tela-entrada").hidden = false;
    avisar($("aviso-entrada"), "Não foi possível carregar o app. Confira a internet e recarregue a página.", "erro");
    $("botao-entrar").disabled = true;
    $("botao-criar").disabled = true;
    return;
  }

  // O cliente precisa do endereço base do projeto; se vier com /rest/v1/ no fim, tiramos.
  const enderecoBase = CONFIG.SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const banco = window.supabase.createClient(enderecoBase, CONFIG.SUPABASE_CHAVE_PUBLICA);

  // ---------- Pequenas ajudas ----------

  function el(tag, classe, texto) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto !== undefined) no.textContent = texto;
    return no;
  }

  function avisar(alvo, frase, tipo) {
    alvo.textContent = frase || "";
    alvo.className = "aviso " + (tipo || "");
    alvo.hidden = !frase;
  }

  // O cliente do Supabase costuma devolver { error } quando algo dá errado.
  // Se em vez disso ele lançar uma exceção, tratamos do mesmo jeito: nada fica travado e o erro vira frase.
  async function seguro(pedido) {
    try {
      return await pedido;
    } catch (erro) {
      return { data: null, error: erro };
    }
  }

  // Data "AAAA-MM-DD" no fuso do aparelho (não no fuso de Londres).
  function dataLocal(d) {
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  function limitesDoMes() {
    const hoje = new Date();
    return {
      inicio: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      proximo: dataLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)),
    };
  }

  function noMesAtual(data) {
    const { inicio, proximo } = limitesDoMes();
    return data >= inicio && data < proximo;
  }

  function diaMes(data) {
    const [, mes, dia] = data.split("-");
    return `${dia}/${mes}`;
  }

  function dataCompleta(data) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // Soma em centavos, para não errar nos centavos.
  const centavos = (valor) => Math.round(Number(valor) * 100);

  // Aceita "12,50", "12.50", "R$ 1.250,00". Devolve null se vazio e NaN se não for número.
  function lerValor(texto) {
    let t = String(texto).replace(/[R$\s]/g, "");
    if (!t) return null;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Number(t);
  }

  // ---------- Erros em português ----------

  function semConexao(erro) {
    const msg = String((erro && (erro.message || erro)) || "");
    return !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
  }

  function fraseDeEntrada(erro) {
    if (semConexao(erro)) return "Sem conexão com a internet. Confira a rede e tente de novo.";
    const codigo = erro.code || "";
    const msg = (erro.message || "").toLowerCase();
    if (codigo === "invalid_credentials" || msg.includes("invalid login")) {
      return "E-mail ou senha não conferem. Confira e tente de novo. Se ainda não tem conta, toque em Criar conta.";
    }
    if (codigo === "user_already_exists" || codigo === "email_exists" || msg.includes("already registered")) {
      return "Já existe uma conta com este e-mail. Toque em Entrar.";
    }
    if (codigo === "weak_password" || msg.includes("password should")) {
      return "Senha fraca. Use pelo menos 6 caracteres e tente de novo.";
    }
    if (codigo === "email_address_invalid" || codigo === "validation_failed" || msg.includes("invalid format")) {
      return "Esse e-mail não parece válido. Confira e tente de novo.";
    }
    if (codigo === "email_not_confirmed" || msg.includes("not confirmed")) {
      return "Esta conta está esperando confirmação por e-mail. No Supabase, desligue “Confirm email” (Authentication › Sign In / Providers › Email) e tente de novo.";
    }
    if (codigo === "signup_disabled" || msg.includes("signups not allowed")) {
      return "A criação de contas está desligada no Supabase. Ligue em Authentication › Sign In / Providers e tente de novo.";
    }
    if (erro.status === 429 || codigo.startsWith("over_")) {
      return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    }
    return "Não foi possível entrar agora. Espere um instante e tente de novo.";
  }

  function fraseDoBanco(erro, acao) {
    if (semConexao(erro)) return "Sem conexão com a internet. Confira a rede e tente de novo.";
    const codigo = erro.code || "";
    if (codigo === "PGRST301" || codigo === "PGRST303" || /jwt/i.test(erro.message || "")) {
      return "Sua entrada expirou. Toque em Sair, entre de novo e repita.";
    }
    if (codigo === "23514") return "O valor precisa ser maior que zero. Corrija e tente de novo.";
    if (codigo === "42501") return "O banco recusou o pedido. Toque em Sair, entre de novo e repita.";
    const frases = {
      carregar: "Não foi possível carregar seus gastos. Toque em Tentar de novo.",
      lancar: "Não foi possível lançar o gasto. Confira o valor e tente de novo.",
      apagar: "Não foi possível apagar o gasto. Espere um instante e tente de novo.",
    };
    return frases[acao];
  }

  // ---------- Entrada (e-mail e senha) ----------

  function travarEntrada(sim, modo) {
    $("botao-entrar").disabled = sim;
    $("botao-criar").disabled = sim;
    $("botao-entrar").textContent = sim && modo === "entrar" ? "Entrando…" : "Entrar";
    $("botao-criar").textContent = sim && modo === "criar" ? "Criando conta…" : "Criar conta";
  }

  async function entrar(modo) {
    const aviso = $("aviso-entrada");
    const email = $("email").value.trim();
    const senha = $("senha").value;

    if (!email) return avisar(aviso, "Digite o seu e-mail.", "erro");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return avisar(aviso, "Esse e-mail não parece válido. Confira e tente de novo.", "erro");
    }
    if (senha.length < 6) return avisar(aviso, "A senha precisa ter pelo menos 6 caracteres.", "erro");

    avisar(aviso, "");
    travarEntrada(true, modo);
    let resposta;
    try {
      resposta = modo === "criar"
        ? await banco.auth.signUp({ email, password: senha })
        : await banco.auth.signInWithPassword({ email, password: senha });
    } catch (erro) {
      resposta = { error: erro };
    }
    travarEntrada(false);

    if (resposta.error) return avisar(aviso, fraseDeEntrada(resposta.error), "erro");
    if (modo === "criar" && !resposta.data.session) {
      return avisar(aviso, "Conta criada, mas o Supabase ainda pede confirmação por e-mail. Desligue “Confirm email” em Authentication › Sign In / Providers › Email e toque em Entrar.", "erro");
    }
    // Deu certo: a troca de tela acontece em onAuthStateChange.
  }

  async function sair() {
    const botao = $("botao-sair");
    botao.disabled = true;
    const { error } = await seguro(banco.auth.signOut());
    botao.disabled = false;
    // O aviso fica logo abaixo do total, perto do botão Sair.
    if (error) avisar($("aviso-carregar"), "Não foi possível sair agora. Confira a internet e tente de novo.", "erro");
  }

  // ---------- Troca de telas ----------

  function abrirEntrada() {
    estado.gastos = [];
    $("tela-app").hidden = true;
    $("tela-entrada").hidden = false;
    $("senha").value = "";
    avisar($("aviso-entrada"), "");
    esconderFaixa();
    $("total-mes").textContent = "—";
    $("lista").replaceChildren();
    $("cartao-resumo").hidden = true;
  }

  function abrirApp() {
    $("tela-entrada").hidden = true;
    $("tela-app").hidden = false;
    avisar($("aviso-entrada"), "");
    $("data").value = dataLocal(new Date());
    carregarTudo();
  }

  // ---------- Carregar e desenhar ----------

  function carregarTudo() {
    const hoje = new Date();
    $("nome-mes").textContent = hoje.toLocaleDateString("pt-BR", { month: "long" });
    $("total-dica").textContent = `até hoje, dia ${hoje.getDate()}`;
    return Promise.all([carregarGastos(), carregarResumo()]);
  }

  function ordenar() {
    estado.gastos.sort((a, b) =>
      a.data === b.data ? String(b.criado_em).localeCompare(String(a.criado_em)) : b.data.localeCompare(a.data));
  }

  async function carregarGastos() {
    const { inicio, proximo } = limitesDoMes();
    $("aviso-carregar").hidden = true;
    $("botao-tentar").hidden = true;

    const { data: linhas, error } = await seguro(banco
      .from("gastos")
      .select(COLUNAS)
      .gte("data", inicio)
      .lt("data", proximo)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false }));

    if (error) {
      avisar($("aviso-carregar"), fraseDoBanco(error, "carregar"), "erro");
      $("botao-tentar").hidden = false;
      // Sem carregar, não dá para dizer que a lista está vazia.
      $("lista-vazia").hidden = true;
      return;
    }
    estado.gastos = linhas || [];
    desenhar();
  }

  async function carregarResumo() {
    const { data: linha, error } = await seguro(banco
      .from("resumos")
      .select("texto")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle());
    const texto = !error && linha && linha.texto ? linha.texto.trim() : "";
    $("texto-resumo").textContent = texto;
    $("cartao-resumo").hidden = !texto;
  }

  function desenhar() {
    const porCategoria = new Map();
    let total = 0;
    for (const g of estado.gastos) {
      const c = centavos(g.valor);
      const chave = CONFIG.CATEGORIAS.includes(g.categoria) ? g.categoria : "Outros";
      porCategoria.set(chave, (porCategoria.get(chave) || 0) + c);
      total += c;
    }
    $("total-mes").textContent = reais.format(total / 100);
    desenharBarras(porCategoria, total);
    desenharLista();
  }

  function desenharBarras(porCategoria, total) {
    const lista = $("barras");
    lista.replaceChildren();
    for (const nome of CONFIG.CATEGORIAS) {
      const valor = porCategoria.get(nome) || 0;
      const item = el("li", "barra");
      const linha = el("div", "barra-linha");
      linha.append(el("span", "barra-nome", nome), el("span", "barra-valor", reais.format(valor / 100)));
      const trilho = el("div", "barra-trilho");
      trilho.setAttribute("aria-hidden", "true");
      const preenchida = el("div", "barra-preenchida");
      preenchida.style.width = total ? `${(valor / total) * 100}%` : "0%";
      trilho.append(preenchida);
      item.append(linha, trilho);
      lista.append(item);
    }
  }

  function desenharLista() {
    const lista = $("lista");
    lista.replaceChildren();
    $("lista-vazia").hidden = estado.gastos.length > 0;
    for (const g of estado.gastos) {
      const valor = reais.format(Number(g.valor));
      const item = el("li", "item");
      const botao = el("button", "", "Apagar");
      botao.type = "button";
      botao.setAttribute("aria-label", `Apagar ${valor} em ${g.categoria}, dia ${diaMes(g.data)}`);
      botao.addEventListener("click", () => pedirApagar(g, botao));
      item.append(
        el("span", "item-titulo", g.descricao || g.categoria),
        el("span", "item-valor", valor),
        el("span", "item-detalhe", `${diaMes(g.data)} · ${g.categoria}`),
        botao,
      );
      lista.append(item);
    }
  }

  // ---------- Lançar à mão ----------

  function montarCategorias() {
    const grade = $("botoes-categoria");
    for (const nome of CONFIG.CATEGORIAS) {
      const botao = el("button", "", nome);
      botao.type = "button";
      botao.addEventListener("click", () => lancar(nome));
      grade.append(botao);
    }
  }

  function travarCategorias(sim) {
    for (const botao of $("botoes-categoria").querySelectorAll("button")) botao.disabled = sim;
  }

  async function lancar(categoria) {
    const aviso = $("aviso-lancar");
    const campoValor = $("valor");
    const valor = lerValor(campoValor.value);

    if (valor === null) {
      avisar(aviso, "Digite o valor antes de tocar na categoria.", "erro");
      return campoValor.focus();
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      avisar(aviso, "Esse valor não parece certo. Digite só números, por exemplo 12,50.", "erro");
      return campoValor.focus();
    }
    if (valor >= 1000000) {
      avisar(aviso, "Esse valor parece grande demais. Confira e digite de novo.", "erro");
      return campoValor.focus();
    }

    const data = $("data").value || dataLocal(new Date());
    const descricao = $("descricao").value.trim();

    avisar(aviso, "");
    travarCategorias(true);
    const { data: linha, error } = await seguro(banco
      .from("gastos")
      // A coluna descricao não aceita "nada": quando fica em branco, vai texto vazio.
      .insert({ data, descricao, valor, categoria, origem: "manual" })
      .select(COLUNAS)
      .single());
    travarCategorias(false);

    if (error) return avisar(aviso, fraseDoBanco(error, "lancar"), "erro");

    campoValor.value = "";
    $("descricao").value = "";
    $("data").value = dataLocal(new Date());
    if (noMesAtual(linha.data)) {
      estado.gastos.push(linha);
      ordenar();
      desenhar();
    }
    mostrarFaixa(linha);
  }

  // ---------- Faixa com Desfazer ----------

  function mostrarFaixa(linha) {
    estado.ultimoLancado = linha;
    const fora = noMesAtual(linha.data) ? "" : ` (dia ${dataCompleta(linha.data)})`;
    $("texto-faixa").textContent = `Lançado: ${reais.format(Number(linha.valor))} em ${linha.categoria}${fora}`;
    $("botao-desfazer").disabled = false;
    $("faixa").hidden = false;
    clearTimeout(estado.tempoFaixa);
    estado.tempoFaixa = setTimeout(esconderFaixa, 6000);
  }

  function esconderFaixa() {
    clearTimeout(estado.tempoFaixa);
    estado.ultimoLancado = null;
    $("faixa").hidden = true;
  }

  async function desfazer() {
    const linha = estado.ultimoLancado;
    if (!linha) return;
    clearTimeout(estado.tempoFaixa);
    $("botao-desfazer").disabled = true;

    const { error } = await seguro(banco.from("gastos").delete().eq("id", linha.id));
    if (error) {
      $("texto-faixa").textContent = fraseDoBanco(error, "apagar");
      $("botao-desfazer").disabled = false;
      estado.tempoFaixa = setTimeout(esconderFaixa, 6000);
      return;
    }
    estado.gastos = estado.gastos.filter((g) => g.id !== linha.id);
    desenhar();
    esconderFaixa();
  }

  // ---------- Apagar da lista (toque em Apagar, depois em Confirmar) ----------

  function pedirApagar(gasto, botao) {
    if (botao.dataset.confirmar !== "sim") {
      botao.dataset.confirmar = "sim";
      botao.textContent = "Confirmar";
      botao.classList.add("confirmar");
      setTimeout(() => {
        if (!botao.isConnected || botao.disabled) return;
        botao.dataset.confirmar = "";
        botao.textContent = "Apagar";
        botao.classList.remove("confirmar");
      }, 4000);
      return;
    }
    apagar(gasto, botao);
  }

  async function apagar(gasto, botao) {
    const aviso = $("aviso-lista");
    botao.disabled = true;
    botao.textContent = "Apagando…";

    const { error } = await seguro(banco.from("gastos").delete().eq("id", gasto.id));
    if (error) {
      avisar(aviso, fraseDoBanco(error, "apagar"), "erro");
      botao.disabled = false;
      botao.dataset.confirmar = "";
      botao.textContent = "Apagar";
      botao.classList.remove("confirmar");
      return;
    }
    avisar(aviso, "");
    estado.gastos = estado.gastos.filter((g) => g.id !== gasto.id);
    desenhar();
  }

  // ---------- Assistente (frase, pergunta ou foto do cupom) ----------

  const LADO_MAXIMO_FOTO = 1600;
  const ASSISTENTE_FORA = "O assistente não respondeu agora. Espere um instante e tente de novo, ou lance à mão.";

  // Campo de arquivo invisível: o botão Foto do cupom abre a câmera ou a galeria.
  const campoFoto = el("input");
  campoFoto.type = "file";
  campoFoto.accept = "image/*";
  campoFoto.hidden = true;
  document.body.append(campoFoto);

  function travarAssistente(sim) {
    for (const botao of $("form-assistente").querySelectorAll("button")) botao.disabled = sim;
  }

  async function abrirImagem(arquivo) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      } catch (_) {
        // Alguns navegadores não abrem assim; tenta do jeito antigo.
      }
    }
    const endereco = URL.createObjectURL(arquivo);
    try {
      const imagem = new Image();
      imagem.src = endereco;
      await imagem.decode();
      return imagem;
    } finally {
      URL.revokeObjectURL(endereco);
    }
  }

  // Reduz a foto no aparelho (no máximo 1600 px, em JPEG) e devolve só o conteúdo em base64.
  // Nada é guardado: a foto só existe na memória até o envio.
  async function reduzirFoto(arquivo) {
    const imagem = await abrirImagem(arquivo);
    const largura = imagem.naturalWidth || imagem.width;
    const altura = imagem.naturalHeight || imagem.height;
    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(largura, altura));
    const tela = document.createElement("canvas");
    tela.width = Math.round(largura * escala);
    tela.height = Math.round(altura * escala);
    tela.getContext("2d").drawImage(imagem, 0, 0, tela.width, tela.height);
    if (imagem.close) imagem.close();
    const conteudo = tela.toDataURL("image/jpeg", 0.85).split(",")[1];
    tela.width = tela.height = 0;
    return conteudo;
  }

  // Manda o pedido para a função, com o login da sessão. Devolve a resposta, ou null se deu erro.
  async function falarComAssistente(pedido) {
    const aviso = $("aviso-assistente");
    const { data } = await seguro(banco.auth.getSession());
    const token = data && data.session ? data.session.access_token : null;
    if (!token) {
      avisar(aviso, "Sua entrada expirou. Toque em Sair, entre de novo e repita.", "erro");
      return null;
    }

    travarAssistente(true);
    avisar(aviso, pedido.imagem ? "Lendo o cupom…" : "Pensando…", "ok");
    let resposta;
    let corpo = null;
    try {
      resposta = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...pedido, categorias: CONFIG.CATEGORIAS }),
      });
      corpo = await resposta.json().catch(() => null);
    } catch (erro) {
      travarAssistente(false);
      avisar(aviso, semConexao(erro) ? "Sem conexão com a internet. Confira a rede e tente de novo." : ASSISTENTE_FORA, "erro");
      return null;
    }
    travarAssistente(false);

    if (!resposta.ok || !corpo || !corpo.resposta) {
      avisar(aviso, (corpo && corpo.erro) || ASSISTENTE_FORA, "erro");
      return null;
    }
    avisar(aviso, corpo.resposta, "ok");

    // Depois de lançar, a lista, o total e as barras se atualizam.
    const novos = (corpo.gastos || []).filter((g) => noMesAtual(g.data));
    if (novos.length) {
      estado.gastos.push(...novos);
      ordenar();
      desenhar();
    }
    return corpo;
  }

  async function enviarFrase() {
    const campo = $("frase");
    const mensagem = campo.value.trim();
    if (!mensagem) {
      avisar($("aviso-assistente"), "Escreva o gasto ou a pergunta. Ex.: mercado 50 hoje.", "erro");
      return campo.focus();
    }
    const corpo = await falarComAssistente({ mensagem });
    if (corpo && corpo.gastos && corpo.gastos.length) campo.value = "";
  }

  async function enviarFoto() {
    const arquivo = campoFoto.files && campoFoto.files[0];
    campoFoto.value = ""; // solta o arquivo escolhido: a foto não fica guardada
    if (!arquivo) return;

    const aviso = $("aviso-assistente");
    travarAssistente(true);
    avisar(aviso, "Preparando a foto…", "ok");
    let imagem;
    try {
      imagem = await reduzirFoto(arquivo);
    } catch (_) {
      travarAssistente(false);
      return avisar(aviso, "Não consegui abrir essa foto. Tire outra ou escolha outra foto e tente de novo.", "erro");
    }
    const corpo = await falarComAssistente({ mensagem: $("frase").value.trim(), imagem, mime: "image/jpeg" });
    if (corpo && corpo.gastos && corpo.gastos.length) $("frase").value = "";
  }

  // ---------- Microfone (reconhecimento de voz do navegador) ----------

  // Quem transforma a voz em texto é o navegador; o app não grava nem guarda o áudio.
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  let escuta = null; // o reconhecimento em andamento, ou null

  function fraseDoMicrofone(codigo) {
    const bloqueado = "O navegador não deixou usar o microfone. Permita o microfone para este site e tente de novo.";
    const frases = {
      "not-allowed": bloqueado,
      "service-not-allowed": bloqueado,
      "no-speech": "Não ouvi nada. Toque em Falar e diga o gasto.",
      "audio-capture": "Não achei o microfone. Confira o microfone do aparelho e tente de novo.",
      network: "O reconhecimento de voz precisa de internet. Confira a rede e tente de novo.",
    };
    return frases[codigo] || "Não entendi o que você disse. Tente de novo ou escreva o gasto.";
  }

  function mostrarEscutando(sim) {
    const botao = $("botao-microfone");
    botao.setAttribute("aria-pressed", String(sim));
    botao.textContent = sim ? "Ouvindo…" : "Falar";
  }

  function falar() {
    // Tocar de novo enquanto escuta: para de ouvir e envia o que já ouviu.
    if (escuta) return escuta.stop();

    const aviso = $("aviso-assistente");
    const campo = $("frase");
    const reconhecimento = new Reconhecimento();
    reconhecimento.lang = "pt-BR";
    reconhecimento.interimResults = true; // o texto aparece no campo enquanto a pessoa fala
    reconhecimento.maxAlternatives = 1;
    let ouvido = "";
    let erro = null;

    reconhecimento.onresult = (evento) => {
      ouvido = Array.from(evento.results, (resultado) => resultado[0].transcript).join("").trim();
      campo.value = ouvido;
    };
    reconhecimento.onerror = (evento) => {
      erro = evento.error;
    };
    reconhecimento.onend = () => {
      escuta = null;
      mostrarEscutando(false);
      if (erro && erro !== "aborted") return avisar(aviso, fraseDoMicrofone(erro), "erro");
      if (!ouvido) return avisar(aviso, fraseDoMicrofone("no-speech"), "erro");
      enviarFrase();
    };

    try {
      reconhecimento.start();
    } catch (_) {
      return avisar(aviso, fraseDoMicrofone(), "erro");
    }
    escuta = reconhecimento;
    mostrarEscutando(true);
    avisar(aviso, "Pode falar…", "ok");
  }

  // ---------- Ligações ----------

  montarCategorias();

  $("form-entrada").addEventListener("submit", (evento) => {
    evento.preventDefault();
    entrar("entrar");
  });
  $("botao-criar").addEventListener("click", () => entrar("criar"));
  $("botao-sair").addEventListener("click", sair);
  $("botao-tentar").addEventListener("click", carregarTudo);
  $("botao-desfazer").addEventListener("click", desfazer);

  $("form-lancar").addEventListener("submit", (evento) => {
    evento.preventDefault();
    avisar($("aviso-lancar"), "Agora toque na categoria para lançar.", "ok");
  });

  $("form-assistente").addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarFrase();
  });
  $("botao-foto").addEventListener("click", () => campoFoto.click());
  campoFoto.addEventListener("change", enviarFoto);

  if (Reconhecimento) {
    $("botao-microfone").addEventListener("click", falar);
  } else {
    // Sem reconhecimento de voz no navegador: o botão some e fica a dica do teclado.
    $("botao-microfone").hidden = true;
    $("dica-microfone").hidden = false;
  }

  // Ao voltar para o app (por exemplo, no dia seguinte), atualiza tudo.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !estado.usuarioId) return;
    if (!$("valor").value) $("data").value = dataLocal(new Date());
    carregarTudo();
  });

  // Se o Supabase não disser em 8 segundos se há alguém entrado, mostra a tela de entrada com uma frase,
  // em vez de deixar a tela em branco. Se a resposta chegar depois, o app abre normalmente.
  setTimeout(() => {
    if (estado.usuarioId !== undefined) return;
    $("tela-entrada").hidden = false;
    avisar($("aviso-entrada"), "O app está demorando para abrir. Confira a internet e recarregue a página.", "erro");
  }, 8000);

  banco.auth.onAuthStateChange((_evento, sessao) => {
    const id = sessao ? sessao.user.id : null;
    if (id === estado.usuarioId) return;
    estado.usuarioId = id;
    // Espera o Supabase terminar o que está fazendo antes de buscar os dados.
    setTimeout(() => (id ? abrirApp() : abrirEntrada()), 0);
  });
})();
