import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("Falta BLOB_READ_WRITE_TOKEN en las variables de entorno.");
    }

    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: { contentType?: string; accept?: string[] } = {};

        if (clientPayload) {
          try {
            payload = JSON.parse(clientPayload);
          } catch {
            payload = {};
          }
        }

        const allowedContentTypes =
          Array.isArray(payload.accept) && payload.accept.length > 0
            ? payload.accept
            : ["image/jpeg", "image/jpg", "image/png", "image/webp"];

        return {
          allowedContentTypes,
          contentType:
            typeof payload.contentType === "string"
              ? payload.contentType
              : undefined,
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Upload completado:", blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Error en /api/upload:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el token de subida.",
      },
      { status: 400 }
    );
  }
}