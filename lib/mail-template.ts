// Tipos y utilidades compartidos por el envío y la previsualización.

export type NuloPayload = {
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

export type ComidaPayload = {
  nombre?: string;
  hora?: string;
};

export type FichajePayload = {
  fotoUrl?: string;
};

export type PayloadType = {
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
  tieneFichajes?: "si" | "no" | "";
  numeroFotosFichajes?: number;
  fichajes?: FichajePayload[];
  motivoSinFichajes?: string;
  comentarioFinal?: string;
  quebranto?: number;
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

/* ==========================================================================
   Informe E3 — "Excepciones"
   Empieza por lo que se ha desviado. Banda de estado, luego sólo lo que no
   cuadra, y todo lo correcto plegado en una línea. El detalle completo va
   debajo. Tablas + estilos en línea: se ve igual en Outlook, Gmail y móvil.
   ========================================================================== */

export type NuloPhotoKind =
  | "pedido-original"
  | "factura-rectificativa"
  | "nuevo-pedido";

/**
 * Identificador compartido entre el adjunto de Graph (`contentId`) y el
 * `<img src="cid:…">` del cuerpo. Los dos lados llaman a esta función para que
 * no puedan desincronizarse.
 */
export function contentIdFor(index: number, kind: NuloPhotoKind) {
  return `nulo-${index + 1}-${kind}`;
}

/** Identificador de cada foto del registro de jornada. */
export function fichajeContentId(index: number) {
  return `fichaje-${index + 1}`;
}

/** Las fotos de fichajes que realmente se adjuntan. */
export function fichajePhotos(payload: PayloadType) {
  if (payload.tieneFichajes !== "si") return [];

  return (payload.fichajes || [])
    .filter((fichaje) => Boolean(fichaje.fotoUrl))
    .map((_, index) => ({
      label: `Fichajes ${index + 1}`,
      cid: fichajeContentId(index),
    }));
}

/** Las fotos que realmente se adjuntan de un nulo, en orden. */
export function photosOfNulo(nulo: NuloPayload, index: number) {
  const all: { kind: NuloPhotoKind; label: string; url?: string }[] = [
    {
      kind: "pedido-original",
      label: "Pedido original",
      url: nulo.fotoPedidoOriginalUrl,
    },
    {
      kind: "factura-rectificativa",
      label: "Factura rectificativa",
      url: nulo.fotoFacturaRectificativaUrl,
    },
  ];

  if (nulo.tieneNuevoPedido === "si") {
    all.push({
      kind: "nuevo-pedido",
      label: "Nuevo pedido",
      url: nulo.fotoNuevoPedidoUrl,
    });
  }

  return all
    .filter((photo) => Boolean(photo.url))
    .map((photo) => ({ ...photo, cid: contentIdFor(index, photo.kind) }));
}

/**
 * Un píxel del color de fondo, en PNG (69 bytes).
 *
 * El modo oscuro de Outlook repinta el fondo del mensaje con su propio gris
 * pase lo que pase con `bgcolor` y `background-color` — da igual que se le
 * pase claro u oscuro. Lo que no toca son las imágenes. Repitiendo este píxel
 * como `background-image`, el color queda fijado: la imagen se pinta por
 * encima del fondo que Outlook haya decidido.
 */
const GROUND_TILE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPg4RUAAABSACpL8zo8AAAAAElFTkSuQmCC";

const C = {
  // Paleta oscura, la misma dirección "B · Cierre" que la app.
  // El correo se lee de noche y en clientes con modo oscuro; si ya viene
  // oscuro, Outlook no tiene nada que invertir y deja de salir gris y negro
  // a trozos.
  ground: "#0C0D10",
  card: "#15171C",
  soft: "#1B1E25",
  ink: "#F2F3F5",
  muted: "#A2A9B6",
  faint: "#79808E",
  rule: "#282C35",
  ruleSoft: "#20242C",
  // Se ve tanto sobre #15171C como sobre el gris que impone Outlook
  ruleStrong: "#4A515E",
  accent: "#F5A524",
  crit: "#FF7078",
  critBand: "#7A2028",
  critSoft: "#2A1416",
  warn: "#E8B85C",
  warnBand: "#5E4715",
  warnSoft: "#251E0F",
  ok: "#4ED89A",
  okBand: "#14503A",
  okSoft: "#0F2620",
};

type Deviation = {
  level: "crit" | "warn";
  title: string;
  detail: string;
};

function toMinutes(value?: string): number | null {
  if (!value) return null;

  const parts = value.split(":").map(Number);

  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }

  return parts[0] * 60 + parts[1];
}

function diffMinutes(nulo: NuloPayload): number | null {
  const a = toMinutes(nulo.horaPedido);
  const b = toMinutes(nulo.horaRectificativa);

  if (a === null || b === null) return null;

  return b - a;
}

function money(value?: number) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${safe.toFixed(2).replace(".", ",")} €`;
}

function signedMoney(value?: number) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  const sign = safe < 0 ? "−" : safe > 0 ? "+" : "";
  return `${sign}${Math.abs(safe).toFixed(2).replace(".", ",")} €`;
}

function formatFecha(value?: string) {
  if (!value) return "Sin fecha";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const dia = Number(parts[2]);
  const mes = meses[Number(parts[1]) - 1];

  if (!mes || Number.isNaN(dia)) return value;

  return `${dia} de ${mes} de ${parts[0]}`;
}

function formatFechaCorta(value?: string) {
  if (!value) return "sin fecha";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}`;
}

/** Clasifica el parte. Todo sale de datos que ya viajan en el payload. */
function buildDeviations(payload: PayloadType): Deviation[] {
  const out: Deviation[] = [];
  const nulos = payload.nulos || [];

  const quebranto = Number(payload.quebranto ?? 0);
  if (Math.abs(quebranto) >= 0.005) {
    // Convenio del cálculo: negativo = falta en caja, positivo = sobra.
    const verbo = quebranto < 0 ? "Falta" : "Sobra";

    out.push({
      level: "crit",
      title: `${verbo} en caja: ${signedMoney(quebranto)}`,
      detail: `Loomis contó ${money(
        Number(payload.billetesLoomis ?? 0) + Number(payload.monedasLoomis ?? 0)
      )} frente a ${money(payload.efectivoStoreace)} de Storeace.${
        payload.observacionesCaja
          ? ` Observaciones: “${payload.observacionesCaja}”.`
          : ""
      }`,
    });
  }

  nulos.forEach((nulo, index) => {
    const n = index + 1;
    const diff = diffMinutes(nulo);

    if (nulo.cumpleMargen === "no") {
      const exceso = diff !== null ? diff - 15 : null;

      out.push({
        level: "crit",
        title: `Nulo ${n} fuera del margen`,
        detail: `${nulo.horaPedido || "?"} → ${nulo.horaRectificativa || "?"}.${
          diff !== null
            ? ` Son ${diff} minutos${
                exceso !== null && exceso > 0 ? `, ${exceso} por encima del margen de 15` : ""
              }.`
            : ""
        }${nulo.motivo ? ` Motivo: “${nulo.motivo}”.` : ""}`,
      });
    }

    if (nulo.tieneDosNombres === "no" || nulo.tieneDosFirmas === "no") {
      const falta = [
        nulo.tieneDosNombres === "no" ? "los dos nombres" : null,
        nulo.tieneDosFirmas === "no" ? "las dos firmas" : null,
      ]
        .filter(Boolean)
        .join(" y ");

      out.push({
        level: "crit",
        title: `Nulo ${n}: faltan ${falta}`,
        detail: "La rectificativa no cumple el requisito de doble validación.",
      });
    }

    if (nulo.tieneNuevoPedido === "no") {
      out.push({
        level: "warn",
        title: `Nulo ${n} sin nuevo pedido adjunto`,
        detail:
          nulo.motivoSinNuevoPedido ||
          "No se ha indicado motivo.",
      });
    }
  });

  if (payload.haHabidoComida === "si") {
    const esperados = Number(payload.ticketsEsperados ?? 0);
    const finales = Number(payload.ticketsFinales ?? 0);
    const delta = finales - esperados;

    if (delta !== 0) {
      out.push({
        level: "warn",
        title: `${delta < 0 ? "Faltan" : "Sobran"} ${Math.abs(delta)} ${
          Math.abs(delta) === 1 ? "ticket" : "tickets"
        } de comida`,
        detail: `${payload.personasConDerecho ?? 0} personas con derecho, ${esperados} tickets esperados, ${finales} finales.${
          payload.personasSinTicar ? ` Sin ticar: ${payload.personasSinTicar}.` : ""
        }`,
      });
    } else if (payload.personasSinTicar) {
      out.push({
        level: "warn",
        title: "Personas con derecho sin ticar",
        detail: payload.personasSinTicar,
      });
    }
  }

  if (payload.tieneFichajes === "no") {
    out.push({
      level: "crit",
      title: "Sin foto de los fichajes",
      detail:
        payload.motivoSinFichajes ||
        "No se ha indicado motivo. El registro de jornada es obligatorio.",
    });
  }

  if (payload.incidencia === "si") {
    out.push({
      level: "warn",
      title: "Incidencia declarada",
      detail: payload.descripcionIncidencia || "Sin descripción.",
    });
  }

  return out;
}

/** Lo que sí ha cuadrado, plegado a una línea por punto. */
function buildOkLines(payload: PayloadType): string[] {
  const out: string[] = [];
  const nulos = payload.nulos || [];

  if (payload.haHabidoNulos === "no") {
    out.push("Sin nulos en el día");
  } else {
    nulos.forEach((nulo, index) => {
      const diff = diffMinutes(nulo);

      if (
        nulo.cumpleMargen === "si" &&
        nulo.tieneDosNombres !== "no" &&
        nulo.tieneDosFirmas !== "no" &&
        nulo.tieneNuevoPedido !== "no"
      ) {
        out.push(
          `Nulo ${index + 1}${diff !== null ? ` · ${diff} min` : ""}, dos firmas y dos nombres`
        );
      }
    });
  }

  if (payload.haHabidoComida === "no") {
    out.push("Sin comida personal");
  }

  if (payload.incidencia === "no") {
    out.push("Sin incidencias");
  }

  if (Math.abs(Number(payload.quebranto ?? 0)) < 0.005) {
    out.push("Caja cuadrada");
  }

  const fotosFichajes = (payload.fichajes || []).filter((f) => f.fotoUrl).length;
  if (payload.tieneFichajes === "si" && fotosFichajes > 0) {
    out.push(
      `Fichajes adjuntos · ${fotosFichajes} ${fotosFichajes === 1 ? "foto" : "fotos"}`
    );
  }

  return out;
}

export function buildSubject(payload: PayloadType) {
  const deviations = buildDeviations(payload);
  const crit = deviations.filter((d) => d.level === "crit").length;
  const warn = deviations.length - crit;

  const flag = crit > 0 ? "⚠ " : "";
  const parts = [
    `${flag}Cierre ${formatFechaCorta(payload.fecha)}`,
    payload.encargado || "sin encargado",
    `Quebranto ${signedMoney(payload.quebranto)}`,
  ];

  if (crit > 0) {
    parts.push(`${crit} ${crit === 1 ? "punto" : "puntos"} a revisar`);
  } else if (warn > 0) {
    parts.push(`${warn} ${warn === 1 ? "aviso" : "avisos"}`);
  } else {
    parts.push("todo correcto");
  }

  return parts.join(" · ");
}

/* --- piezas de maquetación (tablas, para que Outlook no se queje) --- */

function row(label: string, value: string, opts?: { tone?: string; strong?: boolean }) {
  const tone = opts?.tone || C.ink;
  const weight = opts?.strong ? "700" : "600";

  return `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid ${C.ruleStrong};font-size:13px;color:${C.muted};">${label}</td>
      <td align="right" style="padding:9px 0;border-bottom:1px solid ${C.ruleStrong};font-size:13px;font-weight:${weight};color:${tone};white-space:nowrap;">${value}</td>
    </tr>`;
}

function section(title: string, inner: string, badge?: string) {
  return `
    <tr><td style="padding:0 0 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 0 7px 0;border-bottom:1px solid ${C.accent};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${C.accent};font-weight:700;">${title}</td>
          ${badge ? `<td align="right" style="padding:0 0 7px 0;border-bottom:1px solid ${C.accent};">${badge}</td>` : ""}
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${inner}
      </table>
    </td></tr>`;
}

function badge(text: string, tone: "ok" | "bad" | "warn") {
  const map = {
    ok: { bg: C.okSoft, fg: C.ok },
    bad: { bg: C.critSoft, fg: C.crit },
    warn: { bg: C.warnSoft, fg: C.warn },
  } as const;

  return `<span style="display:inline-block;background:${map[tone].bg};color:${map[tone].fg};border:1px solid ${map[tone].fg};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:3px 7px;border-radius:3px;">${escapeHtml(text)}</span>`;
}

export function buildHtml(payload: PayloadType) {
  const nulos = payload.nulos || [];
  const comidas = payload.comidas || [];

  const deviations = buildDeviations(payload);
  const okLines = buildOkLines(payload);

  const crit = deviations.filter((d) => d.level === "crit").length;
  const warn = deviations.length - crit;

  const bandColor = crit > 0 ? C.critBand : warn > 0 ? C.warnBand : C.okBand;
  const bandHeadline =
    crit > 0
      ? `${crit} ${crit === 1 ? "punto requiere" : "puntos requieren"} revisión`
      : warn > 0
        ? `${warn} ${warn === 1 ? "aviso" : "avisos"}, nada crítico`
        : "Día correcto";

  const bandSub =
    crit > 0 && warn > 0
      ? `${crit} ${crit === 1 ? "crítico" : "críticos"} y ${warn} ${warn === 1 ? "aviso" : "avisos"}.`
      : crit > 0
        ? "Revísalo antes de archivar el parte."
        : warn > 0
          ? "Nada crítico, pero conviene mirarlo."
          : "Nulos, comida y caja sin desviaciones.";

  const preheader =
    deviations.length > 0
      ? deviations.map((d) => d.title).join(" · ")
      : "Sin desviaciones. Caja cuadrada.";

  const deviationRows = deviations
    .map((d) => {
      const bar = d.level === "crit" ? C.crit : C.warn;

      return `
        <tr>
          <td width="3" style="background:${bar};width:3px;font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding:11px 14px;border-bottom:1px solid ${C.ruleStrong};">
            <div class="m-ink" style="font-size:13px;font-weight:700;color:${C.ink};margin-bottom:3px;">${escapeHtml(d.title)}</div>
            <div class="m-muted" style="font-size:12px;color:${C.muted};line-height:1.5;">${escapeHtml(d.detail)}</div>
          </td>
        </tr>`;
    })
    .join("");

  const okRows = okLines
    .map(
      (line) => `
        <tr>
          <td style="padding:9px 14px;border-bottom:1px solid ${C.ruleStrong};font-size:12px;color:${C.muted};">${escapeHtml(line)}</td>
          <td align="right" style="padding:9px 14px;border-bottom:1px solid ${C.ruleStrong};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${C.ok};white-space:nowrap;">Correcto</td>
        </tr>`
    )
    .join("");

  const nulosDetail = nulos.length
    ? nulos
        .map((nulo, index) => {
          const diff = diffMinutes(nulo);
          const ok = nulo.cumpleMargen === "si";
          const fotos = photosOfNulo(nulo, index);

          // Cada foto va incrustada junto a su nulo, no suelta al final del
          // correo, para no tener que adivinar cuál es cuál.
          const strip = fotos.length
            ? `
              <tr><td colspan="2" style="padding-top:12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    ${fotos
                      .map(
                        (foto) => `
                      <td class="m-photo" width="${Math.floor(100 / fotos.length)}%" valign="top" style="padding-right:6px;">
                        <img src="cid:${foto.cid}" alt="${escapeHtml(foto.label)}" width="170"
                             style="display:block;width:100%;max-width:170px;height:auto;border:1px solid ${C.rule};border-radius:4px;">
                        <div style="font-size:10px;color:${C.faint};padding-top:5px;letter-spacing:0.04em;">${escapeHtml(foto.label)}</div>
                      </td>`
                      )
                      .join("")}
                  </tr>
                </table>
              </td></tr>`
            : "";

          return section(
            `Nulo ${index + 1}`,
            [
              row("Hora del pedido", escapeHtml(nulo.horaPedido || "—")),
              row("Hora rectificativa", escapeHtml(nulo.horaRectificativa || "—")),
              row(
                "Diferencia",
                diff !== null ? `${diff} min` : "—",
                { tone: ok ? C.ok : C.crit }
              ),
              row("Motivo", escapeHtml(nulo.motivo || "—")),
              row("Dos nombres · dos firmas", `${formatSiNo(nulo.tieneDosNombres)} · ${formatSiNo(nulo.tieneDosFirmas)}`),
              row("Nuevo pedido adjunto", formatSiNo(nulo.tieneNuevoPedido)),
              nulo.tieneNuevoPedido === "no"
                ? row("Motivo sin adjuntar", escapeHtml(nulo.motivoSinNuevoPedido || "—"))
                : "",
              strip,
            ].join(""),
            badge(ok ? "En margen" : "Fuera de margen", ok ? "ok" : "bad")
          );
        })
        .join("")
    : section(
        "Nulos",
        row("Nulos registrados", "Ninguno"),
        badge("Sin nulos", "ok")
      );

  const fotosFichajes = fichajePhotos(payload);

  const fichajesStrip = fotosFichajes.length
    ? `
      <tr><td colspan="2" style="padding-top:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${fotosFichajes
              .map(
                (foto) => `
            <td class="m-photo" width="${Math.floor(100 / fotosFichajes.length)}%" valign="top" style="padding-right:6px;">
              <img src="cid:${foto.cid}" alt="${escapeHtml(foto.label)}" width="170"
                   style="display:block;width:100%;max-width:170px;height:auto;border:1px solid ${C.ruleStrong};border-radius:4px;">
              <div style="font-size:10px;color:${C.faint};padding-top:5px;letter-spacing:0.04em;">${escapeHtml(foto.label)}</div>
            </td>`
              )
              .join("")}
          </tr>
        </table>
      </td></tr>`
    : "";

  const fichajesDetail = section(
    "Fichajes",
    [
      row("Foto del registro de jornada", formatSiNo(payload.tieneFichajes), {
        tone: payload.tieneFichajes === "si" ? C.ok : C.crit,
      }),
      payload.tieneFichajes === "si"
        ? row("Fotos adjuntas", String(fotosFichajes.length))
        : row("Motivo", escapeHtml(payload.motivoSinFichajes || "—")),
      fichajesStrip,
    ].join(""),
    badge(
      payload.tieneFichajes === "si" ? "Adjuntos" : "Sin registro",
      payload.tieneFichajes === "si" ? "ok" : "bad"
    )
  );

  const comidasDetail = comidas.length
    ? section(
        "Personas registradas en comida",
        comidas
          .map((comida, index) =>
            row(
              `${index + 1}. ${escapeHtml(comida.nombre || "Sin nombre")}`,
              escapeHtml(comida.hora || "—")
            )
          )
          .join("")
      )
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Parte administrativo diario</title>
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }

  /* Outlook (nuevo y web) invierte los correos claros en modo oscuro, y lo
     hace a trozos: unas tarjetas se quedaban grises y otras negras. Al venir
     ya oscuro no hay nada que invertir, y estos selectores —los que Outlook
     inyecta al aplicar su modo oscuro— vuelven a fijar los colores por si
     acaso decide tocarlos igualmente. */
  [data-ogsc] .m-ground, [data-ogsb] .m-ground { background-color: ${C.ground} !important; }
  [data-ogsc] .m-band,   [data-ogsb] .m-band   { background-color: ${bandColor} !important; }
  [data-ogsc] .m-ink    { color: ${C.ink} !important; }
  [data-ogsc] .m-muted  { color: ${C.muted} !important; }
  [data-ogsc] .m-faint  { color: ${C.faint} !important; }
  [data-ogsc] .m-onband { color: #FFFFFF !important; }

  @media (max-width: 620px) {
    .m-photo { width: 100% !important; display: block !important; padding: 0 0 10px 0 !important; }
  }
</style>
</head>
<body class="m-ground" bgcolor="${C.ground}" style="margin:0;padding:0;background-color:${C.ground};background-image:url('${GROUND_TILE}');background-repeat:repeat;">
<div style="display:none;font-size:1px;color:${C.ground};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="m-ground" bgcolor="${C.ground}" background="${GROUND_TILE}" style="background-color:${C.ground};background-image:url('${GROUND_TILE}');background-repeat:repeat;padding:20px 12px;">
<tr><td align="center" background="${GROUND_TILE}" bgcolor="${C.ground}" style="background-color:${C.ground};background-image:url('${GROUND_TILE}');background-repeat:repeat;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${C.ink};">

  <!-- Banda de estado -->
  <tr><td class="m-band" bgcolor="${bandColor}" style="background-color:${bandColor};color:#FFFFFF;border-radius:6px;padding:18px 18px 16px 18px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.2em;opacity:0.75;margin-bottom:6px;">${escapeHtml(formatFecha(payload.fecha))} · ${escapeHtml(payload.encargado || "sin encargado")}</div>
    <div style="font-size:19px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">${escapeHtml(bandHeadline)}</div>
    <div style="font-size:12px;opacity:0.88;margin-top:5px;">${escapeHtml(bandSub)}</div>
  </td></tr>

  ${
    deviations.length
      ? `<tr><td style="padding-top:2px;">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${deviationRows}</table>
         </td></tr>`
      : ""
  }

  ${
    okRows
      ? `<tr><td>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${okRows}</table>
         </td></tr>`
      : ""
  }

  <tr><td style="padding:16px 4px 0 4px;text-align:center;font-size:11px;color:${C.faint};letter-spacing:0.05em;">
    Detalle completo del parte más abajo
  </td></tr>

  <tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- Detalle -->
  <tr><td style="padding-bottom:10px;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:${C.faint};font-weight:700;">Parte completo</td></tr>

  ${section(
    "Datos generales",
    [
      row("Fecha", escapeHtml(payload.fecha || "—")),
      row("Encargado", escapeHtml(payload.encargado || "—")),
      row("Incidencia", formatSiNo(payload.incidencia)),
      payload.incidencia === "si"
        ? row("Descripción", escapeHtml(payload.descripcionIncidencia || "—"))
        : "",
    ].join("")
  )}

  ${nulosDetail}

  ${section(
    "Comida personal",
    [
      row("¿Ha habido comida personal?", formatSiNo(payload.haHabidoComida)),
      row("Personas con derecho", String(payload.personasConDerecho ?? 0)),
      row("Tickets esperados", String(payload.ticketsEsperados ?? 0)),
      row("Tickets finales", String(payload.ticketsFinales ?? 0), {
        tone:
          Number(payload.ticketsFinales ?? 0) === Number(payload.ticketsEsperados ?? 0)
            ? C.ink
            : C.crit,
      }),
      row("Personas sin ticar", escapeHtml(payload.personasSinTicar || "—")),
    ].join("")
  )}

  ${comidasDetail}

  ${section(
    "Caja",
    [
      row("Billetes Loomis", money(payload.billetesLoomis)),
      row("Monedas Loomis", money(payload.monedasLoomis)),
      row("Efectivo post de Storeace", `−${money(payload.efectivoStoreace)}`),
      row("Quebranto", signedMoney(payload.quebranto), {
        tone:
          Math.abs(Number(payload.quebranto ?? 0)) < 0.005
            ? C.ok
            : Number(payload.quebranto ?? 0) < 0
              ? C.crit
              : C.warn,
        strong: true,
      }),
      row("Observaciones", escapeHtml(payload.observacionesCaja || "—")),
    ].join("")
  )}

  ${fichajesDetail}

  ${section("Cierre", row("Comentario final", escapeHtml(payload.comentarioFinal || "—")))}

  <tr><td style="padding:14px 2px 4px 2px;font-size:11px;color:${C.faint};line-height:1.6;">
    Las fotos van incrustadas junto a su nulo y también adjuntas al correo.
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}
