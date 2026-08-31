import { NextResponse } from "next/server";
import { buildHtml, buildSubject, type PayloadType } from "@/lib/mail-template";

export const runtime = "nodejs";

/**
 * Previsualización del correo en el navegador, sin enviar nada.
 *   /api/mail-preview            → un día con desviaciones
 *   /api/mail-preview?ok=1       → un día que cuadra
 *   /api/mail-preview?outlook=1  → cómo lo repinta Outlook en modo oscuro
 * Sólo disponible fuera de producción.
 */

/**
 * Outlook (móvil y nuevo) no respeta los fondos neutros: conserva los colores
 * saturados —la banda de estado, los verdes y rojos— y sustituye las
 * superficies grises y negras por las suyas. Esto reproduce ese repintado
 * para poder comprobar que la jerarquía aguanta sin tener que enviarse un
 * correo a uno mismo cada vez.
 */
function simulateOutlookDark(html: string) {
  // El gris es el que se ve en las capturas reales de Outlook para iOS.
  const surfaces: Record<string, string> = {
    "#0C0D10": "#4A4E58", // fondo del mensaje
    "#15171C": "#4A4E58", // superficies
    "#1B1E25": "#3F434C",
    "#4A515E": "#5A606B", // reglas
  };

  let out = html;

  for (const [mine, theirs] of Object.entries(surfaces)) {
    // Sólo se repintan fondos y bordes; el color de texto Outlook lo respeta
    out = out
      .split(`background-color:${mine}`)
      .join(`background-color:${theirs}`)
      .split(`bgcolor="${mine}"`)
      .join(`bgcolor="${theirs}"`)
      .split(`solid ${mine}`)
      .join(`solid ${theirs}`);
  }

  return out;
}

const conDesviaciones: PayloadType = {
  fecha: "2026-08-27",
  encargado: "David",
  incidencia: "si",
  descripcionIncidencia: "Caída del TPV sobre las 22:30, unos 20 minutos.",
  haHabidoNulos: "si",
  numeroNulos: 2,
  nulos: [
    {
      horaPedido: "21:04",
      horaRectificativa: "21:41",
      cumpleMargen: "no",
      motivo: "El cliente cambió el pedido entero",
      tieneDosNombres: "si",
      tieneDosFirmas: "no",
      tieneNuevoPedido: "si",
      motivoSinNuevoPedido: "",
      fotoPedidoOriginalUrl: "https://ejemplo.blob.vercel-storage.com/a.jpg",
      fotoFacturaRectificativaUrl: "https://ejemplo.blob.vercel-storage.com/b.jpg",
      fotoNuevoPedidoUrl: "https://ejemplo.blob.vercel-storage.com/c.jpg",
    },
    {
      horaPedido: "23:12",
      horaRectificativa: "23:19",
      cumpleMargen: "si",
      motivo: "Error al teclear la mesa",
      tieneDosNombres: "si",
      tieneDosFirmas: "si",
      tieneNuevoPedido: "no",
      motivoSinNuevoPedido: "La impresora de cocina se quedó sin papel.",
      fotoPedidoOriginalUrl: "https://ejemplo.blob.vercel-storage.com/d.jpg",
      fotoFacturaRectificativaUrl: "https://ejemplo.blob.vercel-storage.com/e.jpg",
    },
  ],
  haHabidoComida: "si",
  personasConDerecho: 5,
  ticketsEsperados: 5,
  ticketsFinales: 4,
  personasSinTicar: "Marta",
  numeroPersonasComida: 2,
  comidas: [
    { nombre: "Marta", hora: "17:20" },
    { nombre: "Javi", hora: "17:45" },
  ],
  // (billetes + monedas) − efectivo = 1470 − 1482,60 = −12,60 → falta en caja
  efectivoStoreace: 1482.6,
  billetesLoomis: 1400,
  monedasLoomis: 70,
  observacionesCaja: "Falta cambio en el cajón 2.",
  comentarioFinal: "Servicio tranquilo salvo la caída del TPV.",
  quebranto: -12.6,
  tieneFichajes: "no",
  numeroFotosFichajes: 0,
  fichajes: [],
  motivoSinFichajes: "El terminal de fichajes estuvo caído toda la tarde.",
};

const diaCorrecto: PayloadType = {
  fecha: "2026-08-26",
  encargado: "Lucía",
  incidencia: "no",
  descripcionIncidencia: "",
  haHabidoNulos: "si",
  numeroNulos: 1,
  nulos: [
    {
      horaPedido: "22:10",
      horaRectificativa: "22:18",
      cumpleMargen: "si",
      motivo: "Alergia no avisada",
      tieneDosNombres: "si",
      tieneDosFirmas: "si",
      tieneNuevoPedido: "si",
      motivoSinNuevoPedido: "",
      fotoPedidoOriginalUrl: "https://ejemplo.blob.vercel-storage.com/f.jpg",
      fotoFacturaRectificativaUrl: "https://ejemplo.blob.vercel-storage.com/g.jpg",
      fotoNuevoPedidoUrl: "https://ejemplo.blob.vercel-storage.com/h.jpg",
    },
  ],
  haHabidoComida: "no",
  personasConDerecho: 0,
  ticketsEsperados: 0,
  ticketsFinales: 0,
  personasSinTicar: "",
  numeroPersonasComida: 0,
  comidas: [],
  // (1400 + 95) − 1495 = 0 → caja cuadrada
  efectivoStoreace: 1495,
  billetesLoomis: 1400,
  monedasLoomis: 95,
  observacionesCaja: "",
  comentarioFinal: "Sin novedad.",
  quebranto: 0,
  tieneFichajes: "si",
  numeroFotosFichajes: 2,
  fichajes: [
    { fotoUrl: "https://ejemplo.blob.vercel-storage.com/f1.jpg" },
    { fotoUrl: "https://ejemplo.blob.vercel-storage.com/f2.jpg" },
  ],
  motivoSinFichajes: "",
};

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const payload = searchParams.get("ok") ? diaCorrecto : conDesviaciones;
  const asOutlook = Boolean(searchParams.get("outlook"));

  const html = asOutlook ? simulateOutlookDark(buildHtml(payload)) : buildHtml(payload);
  const subject = buildSubject(payload);

  // La barra superior imita la bandeja de entrada para poder juzgar el asunto
  // y el preheader, que es donde se decide si abres el correo o no.
  const chrome = `
<div style="font:13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;background:#fff;border-bottom:1px solid #e2e2de;padding:12px 16px;">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#8a8a85;margin-bottom:4px;">Asunto</div>
  <div style="font-weight:700;color:#111;">${subject
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</div>
  ${
    asOutlook
      ? '<div style="margin-top:6px;font-size:11px;color:#8a5a08;">Simulando el repintado de Outlook en modo oscuro</div>'
      : ""
  }
</div>`;

  // El navegador no resuelve `cid:`, que es como viajan las fotos dentro del
  // correo. Se sustituyen por un marcador para poder juzgar la maqueta.
  const placeholder =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 210">
        <rect width="170" height="210" fill="#EDEDEA"/>
        <g fill="#B9B9B4">
          <rect x="26" y="30" width="118" height="7" rx="3"/>
          <rect x="26" y="52" width="86" height="5" rx="2"/>
          <rect x="26" y="66" width="102" height="5" rx="2"/>
          <rect x="26" y="80" width="72" height="5" rx="2"/>
          <rect x="26" y="104" width="118" height="2"/>
          <rect x="26" y="118" width="94" height="5" rx="2"/>
          <rect x="26" y="132" width="60" height="5" rx="2"/>
        </g>
        <text x="85" y="180" font-family="monospace" font-size="10"
              fill="#9A9A95" text-anchor="middle">foto</text>
      </svg>`
    );

  const withPlaceholders = html.replace(/src="cid:[^"]*"/g, `src="${placeholder}"`);

  return new NextResponse(
    withPlaceholders.replace(/(<body[^>]*>)/, `$1${chrome}`),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
