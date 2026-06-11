import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type NuloPayload = {
  horaPedido?: string
  horaRectificativa?: string
  cumpleMargen?: 'si' | 'no' | ''
  motivo?: string
  tieneDosNombres?: 'si' | 'no' | ''
  tieneDosFirmas?: 'si' | 'no' | ''
  tieneNuevoPedido?: 'si' | 'no' | ''
  motivoSinNuevoPedido?: string
}

type ComidaPayload = {
  nombre?: string
  hora?: string
}

type PayloadType = {
  fecha?: string
  encargado?: string
  incidencia?: 'si' | 'no' | ''
  descripcionIncidencia?: string
  haHabidoNulos?: 'si' | 'no' | ''
  numeroNulos?: number
  nulos?: NuloPayload[]
  haHabidoComida?: 'si' | 'no' | ''
  personasConDerecho?: number
  ticketsEsperados?: number
  ticketsFinales?: number
  personasSinTicar?: string
  numeroPersonasComida?: number
  comidas?: ComidaPayload[]
  efectivoStoreace?: number
  billetesLoomis?: number
  monedasLoomis?: number
  observacionesCaja?: string
  comentarioFinal?: string
  quebranto?: number
}

function escapeHtml(text: string | number | null | undefined) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatSiNo(value?: string) {
  if (value === 'si') return 'Sí'
  if (value === 'no') return 'No'
  return '-'
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('base64')
}

async function getGraphToken() {
  const tenantId = process.env.GRAPH_TENANT_ID
  const clientId = process.env.GRAPH_CLIENT_ID
  const clientSecret = process.env.GRAPH_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Faltan GRAPH_TENANT_ID, GRAPH_CLIENT_ID o GRAPH_CLIENT_SECRET en .env.local')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  console.log('--- TOKEN REQUEST START ---')
  console.log('TENANT ID:', tenantId)
  console.log('CLIENT ID:', clientId)
  console.log('CLIENT SECRET EXISTS:', Boolean(clientSecret))

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    }
  )

  const rawText = await response.text()

  console.log('TOKEN STATUS:', response.status)
  console.log('TOKEN RAW:', rawText)
  console.log('--- TOKEN REQUEST END ---')

  let data: any
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error(`El endpoint del token no devolvió JSON. Respuesta real: ${rawText}`)
  }

  if (!response.ok) {
    throw new Error(`Error al pedir token: ${JSON.stringify(data)}`)
  }

  if (!data.access_token) {
    throw new Error(`No vino access_token. Respuesta: ${JSON.stringify(data)}`)
  }

  return data.access_token as string
}

function buildHtml(payload: PayloadType) {
  const nulos = payload.nulos || []
  const comidas = payload.comidas || []

  return `
    <h1>Formulario Administrativo Diario</h1>

    <h2>Datos generales</h2>
    <p><strong>Fecha:</strong> ${escapeHtml(payload.fecha || '-')}</p>
    <p><strong>Encargado:</strong> ${escapeHtml(payload.encargado || '-')}</p>
    <p><strong>¿Incidencia?:</strong> ${formatSiNo(payload.incidencia)}</p>
    <p><strong>Descripción incidencia:</strong> ${escapeHtml(payload.descripcionIncidencia || '-')}</p>

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
      <p><strong>Hora pedido:</strong> ${escapeHtml(nulo.horaPedido || '-')}</p>
      <p><strong>Hora rectificativa:</strong> ${escapeHtml(nulo.horaRectificativa || '-')}</p>
      <p><strong>¿Cumple margen?:</strong> ${formatSiNo(nulo.cumpleMargen)}</p>
      <p><strong>Motivo:</strong> ${escapeHtml(nulo.motivo || '-')}</p>
      <p><strong>¿Dos nombres?:</strong> ${formatSiNo(nulo.tieneDosNombres)}</p>
      <p><strong>¿Dos firmas?:</strong> ${formatSiNo(nulo.tieneDosFirmas)}</p>
      <p><strong>¿Nuevo pedido adjunto?:</strong> ${formatSiNo(nulo.tieneNuevoPedido)}</p>
      <p><strong>Motivo sin nuevo pedido:</strong> ${escapeHtml(nulo.motivoSinNuevoPedido || '-')}</p>
    `
            )
            .join('')
        : '<p>No hay nulos registrados.</p>'
    }

    <h2>Comida personal</h2>
    <p><strong>¿Ha habido comida personal?:</strong> ${formatSiNo(payload.haHabidoComida)}</p>
    <p><strong>Personas con derecho:</strong> ${escapeHtml(payload.personasConDerecho ?? 0)}</p>
    <p><strong>Tickets esperados:</strong> ${escapeHtml(payload.ticketsEsperados ?? 0)}</p>
    <p><strong>Tickets finales:</strong> ${escapeHtml(payload.ticketsFinales ?? 0)}</p>
    <p><strong>Personas sin ticar:</strong> ${escapeHtml(payload.personasSinTicar || '-')}</p>
    <p><strong>Número de personas comida:</strong> ${escapeHtml(payload.numeroPersonasComida ?? 0)}</p>

    ${
      comidas.length
        ? comidas
            .map(
              (comida, index) => `
      <hr />
      <h3>Persona ${index + 1}</h3>
      <p><strong>Nombre:</strong> ${escapeHtml(comida.nombre || '-')}</p>
      <p><strong>Hora:</strong> ${escapeHtml(comida.hora || '-')}</p>
    `
            )
            .join('')
        : '<p>No hay personas registradas en comida.</p>'
    }

    <h2>Caja</h2>
    <p><strong>Efectivo post de storeace:</strong> ${escapeHtml(payload.efectivoStoreace ?? 0)}</p>
    <p><strong>Billetes Loomis:</strong> ${escapeHtml(payload.billetesLoomis ?? 0)}</p>
    <p><strong>Monedas Loomis:</strong> ${escapeHtml(payload.monedasLoomis ?? 0)}</p>
    <p><strong>Quebranto:</strong> ${escapeHtml(payload.quebranto ?? 0)}</p>
    <p><strong>Observaciones de caja:</strong> ${escapeHtml(payload.observacionesCaja || '-')}</p>

    <h2>Cierre</h2>
    <p><strong>Comentario final:</strong> ${escapeHtml(payload.comentarioFinal || '-')}</p>
  `
}

async function getAttachmentsFromFormData(data: FormData) {
  const attachments: any[] = []

  for (const [key, value] of data.entries()) {
    if (key === 'payload') continue
    if (!(value instanceof File)) continue
    if (value.size === 0) continue

    console.log('ADJUNTO DETECTADO:', key, value.name, value.type, value.size)

    const arrayBuffer = await value.arrayBuffer()

    attachments.push({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: value.name || key,
      contentType: value.type || 'application/octet-stream',
      contentBytes: arrayBufferToBase64(arrayBuffer),
    })
  }

  console.log('TOTAL ADJUNTOS:', attachments.length)

  return attachments
}

async function sendMailWithGraph(payload: PayloadType, attachments: any[]) {
  const sender = process.env.GRAPH_SENDER_USER
  const to = process.env.FORM_TO || process.env.GRAPH_SENDER_USER

  if (!sender || !to) {
    throw new Error('Faltan GRAPH_SENDER_USER o FORM_TO en .env.local')
  }

  const token = await getGraphToken()
  const html = buildHtml(payload)

  const mailPayload = {
    message: {
      subject: `Formulario Administrativo - ${payload.fecha || 'sin fecha'} - ${payload.encargado || 'sin encargado'}`,
      body: {
        contentType: 'HTML',
        content: html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
      attachments,
    },
    saveToSentItems: true,
  }

  console.log('--- SENDMAIL START ---')
  console.log('GRAPH_SENDER_USER:', sender)
  console.log('FORM_TO:', to)
  console.log('ASUNTO:', mailPayload.message.subject)
  console.log('ADJUNTOS ENVIADOS:', attachments.length)

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailPayload),
    }
  )

  const rawText = await response.text()

  console.log('SENDMAIL STATUS:', response.status)
  console.log('SENDMAIL RAW:', rawText)
  console.log('--- SENDMAIL END ---')

  if (!response.ok) {
    throw new Error(`Error al enviar con Graph: ${rawText}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('=== /api/send-form HIT ===')

    const data = await req.formData()
    const keys = Array.from(data.keys())

    console.log('FORMDATA KEYS:', keys)

    const rawPayload = data.get('payload')

    if (typeof rawPayload !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'No ha llegado el campo payload' },
        { status: 400 }
      )
    }

    let payload: PayloadType
    try {
      payload = JSON.parse(rawPayload)
    } catch (error) {
      console.error('PAYLOAD JSON ERROR:', error)
      return NextResponse.json(
        { ok: false, error: 'El payload no es un JSON válido' },
        { status: 400 }
      )
    }

    console.log('PAYLOAD FECHA:', payload.fecha)
    console.log('PAYLOAD ENCARGADO:', payload.encargado)
    console.log('PAYLOAD NULOS:', payload.nulos?.length || 0)
    console.log('PAYLOAD COMIDAS:', payload.comidas?.length || 0)

    const attachments = await getAttachmentsFromFormData(data)

    await sendMailWithGraph(payload, attachments)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('ERROR FINAL /api/send-form:', error)

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo enviar el formulario',
      },
      { status: 500 }
    )
  }
}