export type NuloItem = {
  horaPedido: string;
  horaRectificativa: string;
  cumpleMargen: "si" | "no" | "";
  motivo: string;
  tieneDosNombres: "si" | "no" | "";
  tieneDosFirmas: "si" | "no" | "";
  tieneNuevoPedido: "si" | "no" | "";

  fotoPedidoOriginal: File | null;
  fotoFacturaRectificativa: File | null;
  fotoNuevoPedido: File | null;
  motivoSinNuevoPedido: string;
};

export type ComidaItem = {
  nombre: string;
  hora: string;
};

export type FormDataType = {
  fecha: string;
  encargado: string;
  incidencia: "si" | "no" | "";
  descripcionIncidencia: string;

  haHabidoNulos: "si" | "no" | "";
  numeroNulos: number;
  nulos: NuloItem[];

  haHabidoComida: "si" | "no" | "";
  personasConDerecho: number;
  ticketsEsperados: number;
  ticketsFinales: number;
  personasSinTicar: string;
  numeroPersonasComida: number;
  comidas: ComidaItem[];

  efectivoStoreace: number;
  billetesLoomis: number;
  monedasLoomis: number;
  observacionesCaja: string;

  comentarioFinal: string;
};