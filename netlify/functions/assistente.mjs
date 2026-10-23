// Meu Bolso — o assistente (função da Netlify).
// Recebe uma frase ou a foto de um cupom, pergunta ao Gemini o que fazer e lança ou consulta
// os gastos no Supabase com o login da própria pessoa, para a proteção por linha valer.
// A chave do Gemini vem só de process.env.CHAVE_GEMINI, cadastrada no painel da Netlify.
// Os totais saem da soma feita aqui, com os valores do banco; o modelo nunca calcula nada.

// Copiados de app/configuracao.js: o endereço do projeto e a chave PÚBLICA.
const SUPABASE_URL = "https://vyxfftjlvrbrmcpoczmu.supabase.co";
const SUPABASE_CHAVE_PUBLICA = "sb_publishable_XCZP_0UnpL9wpa4fBd-NHw_OgmOteIq";

const MODELO = "gemini-3.5-flash-lite";
const ENDERECO_GEMINI = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
const COLUNAS = "id,data,descricao,valor,categoria,origem,criado_em";
const FORMATOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"];
const FOTO_MAXIMA = 4000000; // caracteres em base64, cerca de 3 MB
const PAGINA = 1000; // o Supabase devolve no máximo mil linhas por vez

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const config = { path: "/api/assistente" };

// ---------- Erros em português ----------

const FRASES = {
  semChave: "O assistente ainda não tem a chave do Gemini. No painel da Netlify, crie a variável CHAVE_GEMINI e publique o site de novo.",
  chaveRecusada: "O Gemini recusou a chave. Confira a variável CHAVE_GEMINI no painel da Netlify e publique o site de novo.",
  modelo: `O modelo ${MODELO} não está disponível para esta chave. Confira o nome do modelo na função e publique o site de novo.`,
  loginVencido: "Sua entrada expirou. Toque em Sair, entre de novo e repita.",
  limite: "O limite de uso do assistente foi atingido. Espere alguns minutos e tente de novo. Enquanto isso, lance à mão.",
  tabela: "A tabela gastos não existe no Supabase. Crie a tabela no projeto e tente de novo.",
  recusado: "O banco recusou o pedido. Toque em Sair, entre de novo e repita.",
  geminiOcupado: "O Gemini está ocupado agora. Espere um instante e tente de novo.",
  naoEntendi: "O assistente não entendeu o pedido. Escreva de outro jeito e tente de novo.",
  fotoIlegivel: "Não consegui ler essa foto. Tire outra, com o cupom inteiro e bem iluminado, e tente de novo.",
  fotoGrande: "A foto ficou grande demais. Tire outra, mais perto do cupom, e tente de novo.",
  fotoFormato: "Essa foto está num formato que o assistente não lê. Use o botão Foto do cupom e tente de novo.",
  semValor: "Não entendi o valor. Diga de novo com o valor, por exemplo: mercado 50 hoje.",
  semValorFoto: "Não consegui ler o valor total do cupom. Tire outra foto, com o cupom inteiro e bem iluminado.",
  vazio: "Escreva o gasto ou a pergunta, ou mande a foto do cupom.",
  pedidoQuebrado: "O pedido chegou incompleto. Recarregue a página e tente de novo.",
  semCategorias: "Faltou a lista de categorias. Recarregue a página e tente de novo.",
  soPost: "Use o botão Enviar do app para falar com o assistente.",
  geral: "O assistente teve um problema agora. Espere um instante e tente de novo.",
};

class ErroDoAssistente extends Error {
  constructor(status, frase) {
    super(frase);
    this.status = status;
  }
}

function erroDoBanco(status, dados, acao) {
  const codigo = String((dados && dados.code) || "");
  const mensagem = String((dados && dados.message) || "");
  if (status === 401 || codigo === "PGRST301" || codigo === "PGRST303" || /jwt/i.test(mensagem)) {
    return new ErroDoAssistente(401, FRASES.loginVencido);
  }
  if (codigo === "42P01" || codigo === "PGRST205") return new ErroDoAssistente(500, FRASES.tabela);
  if (status === 429) return new ErroDoAssistente(429, FRASES.limite);
  if (codigo === "23514") return new ErroDoAssistente(400, "O valor precisa ser maior que zero. Diga de novo com o valor certo.");
  if (codigo === "42501") return new ErroDoAssistente(403, FRASES.recusado);
  console.error("Supabase", status, codigo, mensagem);
  return new ErroDoAssistente(502, acao === "lancar"
    ? "Não foi possível lançar o gasto agora. Espere um instante e tente de novo."
    : "Não foi possível consultar seus gastos agora. Espere um instante e tente de novo.");
}

function erroDoGemini(status, dados, pedido) {
  const erro = (dados && dados.error) || {};
  const tudo = `${erro.message || ""} ${JSON.stringify(erro.details || "")}`;
  console.error("Gemini", status, erro.status || "", erro.message || "");
  if (/API_KEY_INVALID|API key/i.test(tudo) || status === 401 || status === 403) {
    return new ErroDoAssistente(502, FRASES.chaveRecusada);
  }
  if (status === 429) return new ErroDoAssistente(429, FRASES.limite);
  if (status === 404) return new ErroDoAssistente(502, FRASES.modelo);
  if (status === 400 && pedido.imagem) return new ErroDoAssistente(400, FRASES.fotoIlegivel);
  if (status >= 500) return new ErroDoAssistente(503, FRASES.geminiOcupado);
  return new ErroDoAssistente(502, FRASES.naoEntendi);
}

// Erro de rede (sem resposta nenhuma) também vira frase em português.
async function buscar(endereco, opcoes, quem) {
  try {
    return await fetch(endereco, opcoes);
  } catch (erro) {
    console.error(quem, erro);
    throw new ErroDoAssistente(502, `O assistente não conseguiu falar com o ${quem} agora. Espere um instante e tente de novo.`);
  }
}

function responder(status, corpo) {
  return Response.json(corpo, { status, headers: { "Cache-Control": "no-store" } });
}

// ---------- Datas e valores ----------

// Hoje no fuso de São Paulo, em AAAA-MM-DD, e o dia da semana por extenso.
function hojeEmSaoPaulo() {
  const agora = new Date();
  const fuso = { timeZone: "America/Sao_Paulo" };
  return {
    data: new Intl.DateTimeFormat("en-CA", { ...fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora),
    diaSemana: new Intl.DateTimeFormat("pt-BR", { ...fuso, weekday: "long" }).format(agora),
  };
}

function dataValida(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const dia = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === texto;
}

function dataBR(data) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Aceita 32.5, "32,50" ou "R$ 1.250,00". Devolve null se não for um valor de gasto.
function lerValor(bruto) {
  let numero = typeof bruto === "number" ? bruto : NaN;
  if (typeof bruto === "string") {
    let texto = bruto.replace(/[R$\s]/g, "");
    if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
    numero = Number(texto);
  }
  const valor = Math.round(numero * 100) / 100;
  return Number.isFinite(valor) && valor > 0 && valor < 1000000 ? valor : null;
}

const categoriaReserva = (categorias) => (categorias.includes("Outros") ? "Outros" : categorias[categorias.length - 1]);

// ---------- O pedido que chega do app ----------

function lerToken(req) {
  const cabecalho = req.headers.get("authorization") || "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === cabecalho) throw new ErroDoAssistente(401, FRASES.loginVencido);
  return token;
}

async function lerPedido(req) {
  let corpo;
  try {
    corpo = await req.json();
  } catch (_) {
    throw new ErroDoAssistente(400, FRASES.pedidoQuebrado);
  }
  corpo = corpo || {};

  const mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem.trim().slice(0, 500) : "";
  const imagem = typeof corpo.imagem === "string" ? corpo.imagem.replace(/^data:[^,]*,/, "") : "";
  const categorias = Array.isArray(corpo.categorias)
    ? [...new Set(corpo.categorias.filter((c) => typeof c === "string").map((c) => c.trim().slice(0, 40)).filter(Boolean))].slice(0, 20)
    : [];

  if (!categorias.length) throw new ErroDoAssistente(400, FRASES.semCategorias);
  if (!mensagem && !imagem) throw new ErroDoAssistente(400, FRASES.vazio);
  if (imagem) {
    if (!FORMATOS_DE_FOTO.includes(corpo.mime)) throw new ErroDoAssistente(400, FRASES.fotoFormato);
    if (imagem.length > FOTO_MAXIMA) throw new ErroDoAssistente(413, FRASES.fotoGrande);
    if (!/^[A-Za-z0-9+/]+=*$/.test(imagem)) throw new ErroDoAssistente(400, FRASES.fotoIlegivel);
  }
  return { mensagem, imagem, mime: imagem ? corpo.mime : null, categorias };
}

// ---------- Supabase, sempre com o login da pessoa ----------

const cabecalhosDoBanco = (token) => ({ apikey: SUPABASE_CHAVE_PUBLICA, Authorization: `Bearer ${token}` });

async function conferirLogin(token) {
  const r = await buscar(`${SUPABASE_URL}/auth/v1/user`, { headers: cabecalhosDoBanco(token) }, "Supabase");
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new ErroDoAssistente(401, FRASES.loginVencido);
  if (r.status === 429) throw new ErroDoAssistente(429, FRASES.limite);
  if (!r.ok) throw new ErroDoAssistente(502, "O assistente não conseguiu conferir sua entrada agora. Espere um instante e tente de novo.");
}

async function gravarGastos(novos, token) {
  const r = await buscar(`${SUPABASE_URL}/rest/v1/gastos?select=${COLUNAS}`, {
    method: "POST",
    headers: { ...cabecalhosDoBanco(token), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(novos),
  }, "Supabase");
  const linhas = await r.json().catch(() => null);
  if (!r.ok) throw erroDoBanco(r.status, linhas, "lancar");
  return Array.isArray(linhas) ? linhas : [];
}

// Lê os gastos do período, de mil em mil, e soma em centavos para não errar nos centavos.
async function somarGastos(desde, ate, categoria, token) {
  const filtros = new URLSearchParams({ select: "valor", order: "id.asc" });
  filtros.append("data", `gte.${desde}`);
  filtros.append("data", `lte.${ate}`);
  if (categoria) filtros.append("categoria", `eq.${categoria}`);

  let centavos = 0;
  let quantos = 0;
  for (;;) {
    const r = await buscar(`${SUPABASE_URL}/rest/v1/gastos?${filtros}&limit=${PAGINA}&offset=${quantos}`, {
      headers: { ...cabecalhosDoBanco(token), Prefer: "count=exact" },
    }, "Supabase");
    const linhas = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(linhas)) throw erroDoBanco(r.status, linhas, "consultar");

    for (const linha of linhas) centavos += Math.round(Number(linha.valor) * 100);
    quantos += linhas.length;
    // Content-Range vem como "0-999/1234": o número depois da barra é quantos gastos existem.
    const existentes = Number((r.headers.get("content-range") || "").split("/")[1]);
    const acabou = Number.isFinite(existentes) ? quantos >= existentes : linhas.length < PAGINA;
    if (!linhas.length || acabou) break;
  }
  return { centavos, quantos };
}

// ---------- Gemini ----------

function instrucoes(categorias, hoje) {
  return [
    "Você é o assistente do Meu Bolso, um app de gastos pessoais em português do Brasil.",
    `Hoje é ${hoje.diaSemana}, ${hoje.data} (AAAA-MM-DD), no fuso de São Paulo.`,
    `Categorias do app, e só elas: ${categorias.join(", ")}.`,
    "",
    "Regras:",
    "- Quando a pessoa contar um gasto, chame registrar_gasto. Sem data, use hoje. Datas como ontem ou sexta passada viram AAAA-MM-DD contando a partir de hoje.",
    `- Escolha sempre uma categoria da lista. Se nenhuma servir, use ${categoriaReserva(categorias)}.`,
    "- Na descrição, ponha só onde ou com o quê, curto (por exemplo: mercado, padaria, Uber).",
    "- Quando vier a foto de um cupom fiscal: chame registrar_gasto uma única vez, com o VALOR TOTAL do cupom (não os itens, nem o valor pago, nem o troco), a data de emissão do cupom e o nome da loja como descrição.",
    "- Quando a pessoa perguntar quanto gastou, chame consultar_gastos com o período (desde e ate em AAAA-MM-DD, os dois dias incluídos). Este mês vai do dia 1 até hoje. Mande categoria só se a pergunta for sobre uma categoria.",
    "- Nunca some nem invente valores ou totais: quem soma é o app, direto no banco.",
    "- Se faltar o valor, ou se a foto não for um cupom legível, não chame ferramenta: peça o que falta numa frase curta.",
    "- Nunca peça senha, número de conta ou número de cartão.",
  ].join("\n");
}

function ferramentas(categorias) {
  return [
    {
      name: "registrar_gasto",
      description: "Lança um gasto no Meu Bolso.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Dia do gasto, em AAAA-MM-DD." },
          descricao: { type: "string", description: "Onde ou com o quê, curto. Na foto de cupom, o nome da loja." },
          valor: { type: "number", description: "Valor em reais, maior que zero, com até duas casas (ex.: 32.5). Na foto de cupom, o VALOR TOTAL." },
          categoria: { type: "string", enum: categorias, description: "Uma das categorias do app." },
        },
        required: ["data", "descricao", "valor", "categoria"],
      },
    },
    {
      name: "consultar_gastos",
      description: "Mostra quanto a pessoa gastou num período. A soma é feita pelo app, direto no banco.",
      parameters: {
        type: "object",
        properties: {
          desde: { type: "string", description: "Primeiro dia do período, em AAAA-MM-DD." },
          ate: { type: "string", description: "Último dia do período, em AAAA-MM-DD, incluído." },
          categoria: { type: "string", enum: categorias, description: "Só quando a pergunta for sobre uma categoria." },
        },
        required: ["desde", "ate"],
      },
    },
  ];
}

async function perguntarAoGemini(chave, pedido, hoje) {
  const partes = [];
  if (pedido.imagem) partes.push({ inline_data: { mime_type: pedido.mime, data: pedido.imagem } });
  partes.push({ text: pedido.mensagem || "Lance o gasto deste cupom fiscal." });

  const r = await buscar(ENDERECO_GEMINI, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: instrucoes(pedido.categorias, hoje) }] },
      contents: [{ role: "user", parts: partes }],
      tools: [{ function_declarations: ferramentas(pedido.categorias) }],
    }),
  }, "Gemini");
  const dados = await r.json().catch(() => null);
  if (!r.ok) throw erroDoGemini(r.status, dados, pedido);

  const candidato = dados && dados.candidates && dados.candidates[0];
  const partesDaResposta = (candidato && candidato.content && candidato.content.parts) || [];
  return {
    chamadas: partesDaResposta.map((p) => p.functionCall || p.function_call).filter(Boolean),
    texto: partesDaResposta
      .filter((p) => typeof p.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim()
      .slice(0, 600),
  };
}

// ---------- O que fazer com a escolha do modelo ----------

function montarGasto(args, pedido, hoje) {
  const a = args || {};
  const valor = lerValor(a.valor);
  if (valor === null) return null;
  return {
    // Data inválida ou no futuro vira hoje; a resposta mostra a data, para conferir.
    data: dataValida(a.data) && a.data <= hoje.data ? a.data : hoje.data,
    descricao: typeof a.descricao === "string" ? a.descricao.trim().slice(0, 80) : "",
    valor,
    categoria: pedido.categorias.includes(a.categoria) ? a.categoria : categoriaReserva(pedido.categorias),
    origem: pedido.imagem ? "foto" : "texto",
  };
}

// O valor da frase é o que o banco devolveu depois de gravar, não o que o modelo disse.
const fraseDoLancamento = (g) =>
  `Lancei ${reais.format(Number(g.valor))} em ${g.categoria}${g.descricao ? `: ${g.descricao}` : ""}, ${dataBR(g.data)}.`;

async function consultar(args, pedido, hoje, token) {
  const a = args || {};
  let desde = dataValida(a.desde) ? a.desde : `${hoje.data.slice(0, 8)}01`;
  let ate = dataValida(a.ate) ? a.ate : hoje.data;
  if (desde > ate) [desde, ate] = [ate, desde];
  const categoria = typeof a.categoria === "string" ? a.categoria.trim() : "";
  if (categoria && !pedido.categorias.includes(categoria)) {
    return `Não conheço a categoria ${categoria}. As categorias são: ${pedido.categorias.join(", ")}.`;
  }

  const { centavos, quantos } = await somarGastos(desde, ate, categoria, token);
  const periodo = desde === ate ? `Em ${dataBR(desde)}` : `De ${dataBR(desde)} a ${dataBR(ate)}`;
  if (!quantos) return `${periodo}, não há gastos${categoria ? ` em ${categoria}` : ""}.`;
  const onde = categoria ? `em ${categoria}` : "ao todo";
  return `${periodo}, você gastou ${reais.format(centavos / 100)} ${onde} (${quantos} ${quantos === 1 ? "gasto" : "gastos"}).`;
}

async function agir({ chamadas, texto }, pedido, hoje, token) {
  const registros = chamadas.filter((c) => c.name === "registrar_gasto").slice(0, 10);
  const consultas = chamadas.filter((c) => c.name === "consultar_gastos").slice(0, 5);

  // Sem ferramenta: o modelo está pedindo alguma coisa (por exemplo, o valor).
  if (!registros.length && !consultas.length) return { resposta: texto || FRASES.naoEntendi };

  const frases = [];
  let gastos = [];
  if (registros.length) {
    const novos = registros.map((c) => montarGasto(c.args, pedido, hoje));
    if (novos.includes(null)) return { resposta: pedido.imagem ? FRASES.semValorFoto : FRASES.semValor };
    gastos = await gravarGastos(novos, token);
    frases.push(...gastos.map(fraseDoLancamento));
  }
  for (const c of consultas) frases.push(await consultar(c.args, pedido, hoje, token));
  return { resposta: frases.join(" "), gastos };
}

// ---------- A função ----------

export default async (req) => {
  if (req.method !== "POST") return responder(405, { erro: FRASES.soPost });
  try {
    const chave = process.env.CHAVE_GEMINI;
    if (!chave) throw new ErroDoAssistente(500, FRASES.semChave);

    const token = lerToken(req);
    await conferirLogin(token);
    const pedido = await lerPedido(req);
    const hoje = hojeEmSaoPaulo();

    const escolha = await perguntarAoGemini(chave, pedido, hoje);
    return responder(200, await agir(escolha, pedido, hoje, token));
  } catch (erro) {
    if (erro instanceof ErroDoAssistente) return responder(erro.status, { erro: erro.message });
    console.error(erro);
    return responder(500, { erro: FRASES.geral });
  }
};
