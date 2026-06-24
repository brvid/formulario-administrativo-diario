import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type NuloPayload = {
  horaPedido?: string;
  horaRectificativa?: string;
  cumpleMargen?: "si" | "no" | "";
  motivo?: string;
  tieneDosNombres?: "si" | "no" | "";
  tieneDosFirmas?: "si" | "no" | "";
  tieneNuevoPedido?: "si" | "no" | "";
  motivoSinNuevoPedido?: string;
  fotoPedidoOriginalUrl?: string;
  fotoFacturaRectificativaUrl?: string;
  fotoNuevoPedidoUrl?: string;
};

type ComidaPayload = {
  nombre?: string;
  hora?: string;
};

type PayloadType = {
  fecha?: string;
  encargado?: string;
  incidencia?: "si" | "no" | "";
  descripcionIncidencia?: string;
  haHabidoNulos?: "si" | "no" | "";
  numeroNulos?: number;
  nulos?: NuloPayload[];
  haHabidoComida?: "si" | "no" | "";
  personasConDerecho?: number;
  ticketsEsperados?: number;
  ticketsFinales?: number;
  personasSinTicar?: string;
  numeroPersonasComida?: number;
  comidas?: ComidaPayload[];
  efectivoStoreace?: number;
  billetesLoomis?: number;
  monedasLoomis?: number;
  observacionesCaja?: string;
  comentarioFinal?: string;
  quebranto?: number;
};

type GraphFileAttachment = {
  "@odata.type": "#microsoft.graph.fileAttachment";
  name: string;
  contentType: string;
  contentBytes: string;
};

function escapeHtml(text: string | number | null | undefined) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSiNo(value?: string) {
  if (value === "si") return "Sí";
  if (value === "no") return "No";
  return "-";
}

function extractPrivateBlobPathname(blobUrl?: string) {
  if (!blobUrl) return null;

  try {
    const url = new URL(blobUrl);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

async function readStreamToBuffer(
  stream: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function buildGraphAttachmentFromPrivateBlob(
  blobUrl: string | undefined,
  fallbackFilename: string
): Promise<GraphFileAttachment | null> {
  const pathname = extractPrivateBlobPathname(blobUrl);

  if (!pathname) return null;

  const result = await get(pathname, { access: "private" });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`No se pudo leer el blob privado: ${pathname}`);
  }

  const buffer = await readStreamToBuffer(result.stream);
  const fileName = pathname.split("/").pop() || fallbackFilename;

  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: fileName,
    contentType: result.blob.contentType || "application/octet-stream",
    contentBytes: buffer.toString("base64"),
  };
}

async function getGraphToken() {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Faltan GRAPH_TENANT_ID, GRAPH_CLIENT_ID o GRAPH_CLIENT_SECRET en las variables de entorno."
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    }
  );

  const rawText = await response.text();

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `El endpoint del token no devolvió JSON. Respuesta real: ${rawText}`
    );
  }

  if (!response.ok) {
    throw new Error(`Error al pedir token: ${JSON.stringify(data)}`);
  }

  if (!data.access_token) {
    throw new Error(`No vino access_token. Respuesta: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

function buildHtml(payload: PayloadType) {
  const nulos = payload.nulos || [];
  const comidas = payload.comidas || [];

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #1f1b18;">
      <h1>Formulario Administrativo Diario</h1>

      <h2>Datos generales</h2>
      <p><strong>Fecha:</strong> ${escapeHtml(payload.fecha || "-")}</p>
      <p><strong>Encargado:</strong> ${escapeHtml(payload.encargado || "-")}</p>
      <p><strong>¿Incidencia?:</strong> ${formatSiNo(payload.incidencia)}</p>
      <p><strong>Descripción incidencia:</strong> ${escapeHtml(payload.descripcionIncidencia || "-")}</p>

      <h2>Nulos</h2>
      <p><strong>¿Ha habido nulos?:</strong> ${formatSiNo(payload.haHabidoNulos)}</p>
      <p><strong>Número de nulos:</strong> ${escapeHtml(payload.numeroNulos ?? 0)}</p>

      ${
        nulos.length
          ? nulos
              .map(
                (nulo, index) => `
        <hr />
        <h3>Nulo ${index + 1}</h3>
        <p><strong>Hora pedido:</strong> ${escapeHtml(nulo.horaPedido || "-")}</p>
        <p><strong>Hora rectificativa:</strong> ${escapeHtml(nulo.horaRectificativa || "-")}</p>
        <p><strong>¿Cumple margen?:</strong> ${formatSiNo(nulo.cumpleMargen)}</p>
        <p><strong>Motivo:</strong> ${escapeHtml(nulo.motivo || "-")}</p>
        <p><strong>¿Dos nombres?:</strong> ${formatSiNo(nulo.tieneDosNombres)}</p>
        <p><strong>¿Dos firmas?:</strong> ${formatSiNo(nulo.tieneDosFirmas)}</p>
        <p><strong>¿Nuevo pedido adjunto?:</strong> ${formatSiNo(nulo.tieneNuevoPedido)}</p>
        <p><strong>Motivo sin nuevo pedido:</strong> ${escapeHtml(nulo.motivoSinNuevoPedido || "-")}</p>
        <p><strong>Adjuntos:</strong> Las imágenes de este nulo van adjuntas en el correo.</p>
      `
              )
              .join("")
          : "<p>No hay nulos registrados.</p>"
      }

      <h2>Comida personal</h2>
      <p><strong>¿Ha habido comida personal?:</strong> ${formatSiNo(payload.haHabidoComida)}</p>
      <p><strong>Personas con derecho:</strong> ${escapeHtml(payload.personasConDerecho ?? 0)}</p>
      <p><strong>Tickets esperados:</strong> ${escapeHtml(payload.ticketsEsperados ?? 0)}</p>
      <p><strong>Tickets finales:</strong> ${escapeHtml(payload.ticketsFinales ?? 0)}</p>
      <p><strong>Personas sin ticar:</strong> ${escapeHtml(payload.personasSinTicar || "-")}</p>
      <p><strong>Número de personas comida:</strong> ${escapeHtml(payload.numeroPersonasComida ?? 0)}</p>

      ${
        comidas.length
          ? comidas
              .map(
                (comida, index) => `
        <hr />
        <h3>Persona ${index + 1}</h3>
        <p><strong>Nombre:</strong> ${escapeHtml(comida.nombre || "-")}</p>
        <p><strong>Hora:</strong> ${escapeHtml(comida.hora || "-")}</p>
      `
              )
              .join("")
          : "<p>No hay personas registradas en comida.</p>"
      }

      <h2>Caja</h2>
      <p><strong>Efectivo post de storeace:</strong> ${escapeHtml(payload.efectivoStoreace ?? 0)}</p>
      <p><strong>Billetes Loomis:</strong> ${escapeHtml(payload.billetesLoomis ?? 0)}</p>
      <p><strong>Monedas Loomis:</strong> ${escapeHtml(payload.monedasLoomis ?? 0)}</p>
      <p><strong>Quebranto:</strong> ${escapeHtml(payload.quebranto ?? 0)}</p>
      <p><strong>Observaciones de caja:</strong> ${escapeHtml(payload.observacionesCaja || "-")}</p>

      <h2>Cierre</h2>
      <p><strong>Comentario final:</strong> ${escapeHtml(payload.comentarioFinal || "-")}</p>
    </div>
  `;
}

async function buildAttachments(payload: PayloadType): Promise<GraphFileAttachment[]> {
  const nulos = payload.nulos || [];

  const attachments = await Promise.all(
    nulos.flatMap((nulo, index) => {
      const items: Promise<GraphFileAttachment | null>[] = [
        buildGraphAttachmentFromPrivateBlob(
          nulo.fotoPedidoOriginalUrl,
          `nulo-${index + 1}-pedido-original.jpg`
        ),
        buildGraphAttachmentFromPrivateBlob(
          nulo.fotoFacturaRectificativaUrl,
          `nulo-${index + 1}-factura-rectificativa.jpg`
        ),
      ];

      if (nulo.tieneNuevoPedido === "si") {
        items.push(
          buildGraphAttachmentFromPrivateBlob(
            nulo.fotoNuevoPedidoUrl,
            `nulo-${index + 1}-nuevo-pedido.jpg`
          )
        );
      }

      return items;
    })
  );

  return attachments.filter(Boolean) as GraphFileAttachment[];
}

async function sendMailWithGraph(payload: PayloadType) {
  const sender = process.env.GRAPH_SENDER_USER;
  const to = process.env.FORM_TO || process.env.GRAPH_SENDER_USER;

  if (!sender || !to) {
    throw new Error("Faltan GRAPH_SENDER_USER o FORM_TO en las variables de entorno.");
  }

  const token = await getGraphToken();
  const html = buildHtml(payload);
  const attachments = await buildAttachments(payload);

  const toRecipients = to
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ emailAddress: { address: email } }));

  const mailPayload = {
    message: {
      subject: `Formulario Administrativo - ${payload.fecha || "sin fecha"} - ${payload.encargado || "sin encargado"}`,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients,
      attachments,
    },
    saveToSentItems: true,
  };

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mailPayload),
    }
  );

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Error al enviar con Graph: ${rawText}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as PayloadType;

    if (!payload.fecha || !payload.encargado) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan fecha o encargado.",
        },
        { status: 400 }
      );
    }

    await sendMailWithGraph(payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ERROR FINAL /api/send-form:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar el formulario",
      },
      { status: 500 }
    );
  }
}
