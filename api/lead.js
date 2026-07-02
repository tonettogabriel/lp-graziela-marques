// Vercel Function: recebe os dados do formulário da LP e cria uma linha
// na base de leads do Notion.
//
// Precisa de duas variáveis de ambiente configuradas no projeto da Vercel
// (Settings > Environment Variables), NUNCA escritas aqui no código:
//   NOTION_TOKEN        -> o "Internal Integration Secret" criado no Notion
//   NOTION_DATABASE_ID  -> o ID da base "6. Leads - LP Captação de Imóveis"

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const data = req.body || {};

  // honeypot anti-spam: se o campo escondido veio preenchido, é bot.
  // Respondemos "ok" mesmo assim pra não dar pista pro bot, só não gravamos nada.
  if (data.empresa) {
    res.status(200).json({ ok: true });
    return;
  }

  const nome = (data.nome || '').toString().trim();
  const whatsapp = (data.whatsapp || '').toString().trim();
  const endereco = (data.endereco || '').toString().trim();
  const horario = (data.horario || '').toString().trim();
  const tipoImovel = (data.tipoImovel || '').toString().trim();
  const origem = (data.origem || 'direto').toString().trim();

  if (!nome || !whatsapp || !endereco || !horario) {
    res.status(400).json({ ok: false, error: 'missing_fields' });
    return;
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
    console.error('NOTION_TOKEN ou NOTION_DATABASE_ID não configurados.');
    res.status(500).json({ ok: false, error: 'server_not_configured' });
    return;
  }

  const properties = {
    'Nome': { title: [{ text: { content: nome.slice(0, 200) } }] },
    'Telefone': { phone_number: whatsapp.slice(0, 40) },
    'Bairro / Endereço do imóvel': { rich_text: [{ text: { content: endereco.slice(0, 500) } }] },
    'Melhor horário para contato': { rich_text: [{ text: { content: horario.slice(0, 200) } }] },
    'Origem': { rich_text: [{ text: { content: origem.slice(0, 200) } }] },
    'Status': { select: { name: 'Novo' } }
  };

  if (tipoImovel === 'Casa' || tipoImovel === 'Apartamento') {
    properties['Tipo de imóvel'] = { select: { name: tipoImovel } };
  }

  try {
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: properties
      })
    });

    if (!notionRes.ok) {
      const errText = await notionRes.text();
      console.error('Erro do Notion:', notionRes.status, errText);
      res.status(502).json({ ok: false, error: 'notion_error' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro inesperado:', err);
    res.status(500).json({ ok: false, error: 'unexpected_error' });
  }
};
