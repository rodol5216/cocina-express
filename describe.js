// Función serverless opcional de Vercel (gratis en el plan Hobby).
// Solo funciona si agregas tu propia clave ANTHROPIC_API_KEY en Vercel
// (Project Settings > Environment Variables). El uso de esta clave tiene
// un costo pequeño por cada descripción generada (ver console.anthropic.com).
// Si no configuras la clave, el botón "Generar con IA" en el panel admin
// simplemente mostrará un mensaje y el vendedor puede escribir la
// descripción a mano — el resto de la tienda funciona igual sin esto.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(400).json({
      error: "no_api_key",
      message: "No hay una clave de API configurada en el servidor.",
    });
    return;
  }

  try {
    const { image, name, category } = req.body;
    const base64Data = (image || "").split(",")[1];
    if (!base64Data || !name) {
      res.status(400).json({ error: "Faltan datos (imagen o nombre)." });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Data } },
              {
                type: "text",
                text: `Eres el redactor de "Cocina Express", una tienda online de artículos de cocina en República Dominicana. Mira la foto de este producto: "${name}" (categoría: ${category}). Escribe una descripción corta y atractiva en español dominicano (2 a 3 frases, máximo 220 caracteres), cálida y persuasiva, mencionando materiales o beneficios visibles en la foto. Responde SOLO con la descripción, sin comillas ni texto adicional.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: "Error al llamar a la API de Anthropic", details: errText });
      return;
    }

    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    res.status(200).json({ description: text.replace(/^["']|["']$/g, "") });
  } catch (e) {
    res.status(500).json({ error: "Error interno", details: String(e) });
  }
}
