// Meu Bolso — configuração.
// Aqui ficam só o endereço do projeto no Supabase e a chave PÚBLICA.
// A chave secreta do Supabase e a chave do Gemini nunca entram neste arquivo.

window.MEU_BOLSO = {
  // Endereço base do projeto (sem /rest/v1/ no fim: a biblioteca completa sozinha).
  SUPABASE_URL: "https://vyxfftjlvrbrmcpoczmu.supabase.co",

  // Chave pública: pode ficar no navegador, porque a proteção por linha
  // garante que cada conta só enxerga os próprios gastos.
  SUPABASE_CHAVE_PUBLICA: "sb_publishable_XCZP_0UnpL9wpa4fBd-NHw_OgmOteIq",

  // Categorias do BRIEFING.md, nesta ordem.
  CATEGORIAS: ["Transporte", "Alimentação", "Casa", "Saúde", "Lazer", "Outros"],
};
