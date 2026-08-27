import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import {
  buildHtml,
  buildSubject,
  contentIdFor,
  type PayloadType,
} from "@/lib/mail-template";

export const runtime = "nodejs";

type GraphFileAttachment = {
  "@odata.type": "#microsoft.graph.fileAttachment";
  name: string;
  contentType: string;
  contentBytes: string;
  contentId: string;
  isInline: boolean;
};

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
  fallbackFilename: string,
  contentId: string
): Promise<GraphFileAttachment | null> {
  const pathname = extractPrivateBlobPathname(blobUrl);

  if (!pathname) return null;

  const result = await get(pathname, { access: "private" });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`No se pudo leer el blob privado: ${pathname}`);
  }

  const buffer = await readStreamToBuffer(result.stream);
  const extension = (pathname.split(".").pop() || "jpg").toLowerCase();

  return {
    "@odata.type": "#microsoft.graph.fileAttachment",
    // Nombre legible en vez del blob con prefijo aleatorio: así el adjunto
    // se identifica solo si alguien lo descarga.
    name: fallbackFilename.replace(/\.[^.]+$/, `.${extension}`),
    contentType: result.blob.contentType || "application/octet-stream",
    contentBytes: buffer.toString("base64"),
    // Deja que el cuerpo la muestre con <img src="cid:…"> junto a su nulo.
    contentId,
    isInline: true,
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


async function buildAttachments(payload: PayloadType): Promise<GraphFileAttachment[]> {
  const nulos = payload.nulos || [];

  const attachments = await Promise.all(
    nulos.flatMap((nulo, index) => {
      const items: Promise<GraphFileAttachment | null>[] = [
        buildGraphAttachmentFromPrivateBlob(
          nulo.fotoPedidoOriginalUrl,
          `nulo-${index + 1}-pedido-original.jpg`,
          contentIdFor(index, "pedido-original")
        ),
        buildGraphAttachmentFromPrivateBlob(
          nulo.fotoFacturaRectificativaUrl,
          `nulo-${index + 1}-factura-rectificativa.jpg`,
          contentIdFor(index, "factura-rectificativa")
        ),
      ];

      if (nulo.tieneNuevoPedido === "si") {
        items.push(
          buildGraphAttachmentFromPrivateBlob(
            nulo.fotoNuevoPedidoUrl,
            `nulo-${index + 1}-nuevo-pedido.jpg`,
            contentIdFor(index, "nuevo-pedido")
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
      subject: buildSubject(payload),
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
