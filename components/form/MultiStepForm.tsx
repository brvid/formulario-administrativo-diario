"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { upload } from "@vercel/blob/client";
import type { FormDataType } from "@/types/form";

const steps = [
  "Bienvenida",
  "Datos generales",
  "Nulos",
  "Comida personal",
  "Caja",
  "Cierre",
];

type SubmitMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

export default function MultiStepForm() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<SubmitMessage>(null);

  const {
    register,
    watch,
    setValue,
    getValues,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<FormDataType>({
    defaultValues: {
      fecha: "",
      encargado: "",
      incidencia: "",
      descripcionIncidencia: "",
      haHabidoNulos: "",
      numeroNulos: 0,
      nulos: [],
      haHabidoComida: "",
      personasConDerecho: 0,
      ticketsEsperados: 0,
      ticketsFinales: 0,
      personasSinTicar: "",
      numeroPersonasComida: 0,
      comidas: [],
      efectivoStoreace: 0,
      billetesLoomis: 0,
      monedasLoomis: 0,
      observacionesCaja: "",
      comentarioFinal: "",
    } as FormDataType,
    mode: "onSubmit",
  });

  const numeroNulos = Number(watch("numeroNulos") || 0);
  const numeroPersonasComida = Number(watch("numeroPersonasComida") || 0);
  const incidencia = watch("incidencia");
  const haHabidoNulos = watch("haHabidoNulos");
  const haHabidoComida = watch("haHabidoComida");

  const efectivoStoreace = Number((watch as any)("efectivoStoreace") || 0);
  const billetesLoomis = Number((watch as any)("billetesLoomis") || 0);
  const monedasLoomis = Number((watch as any)("monedasLoomis") || 0);

  const quebranto = useMemo(() => {
    return efectivoStoreace - billetesLoomis - monedasLoomis;
  }, [efectivoStoreace, billetesLoomis, monedasLoomis]);

  useEffect(() => {
    setSubmitMessage(null);
  }, [step]);

  const prev = () => setStep((prev) => Math.max(prev - 1, 0));

  const next = async () => {
    setSubmitMessage(null);

    let valid = true;

    if (step === 1) {
      valid = await trigger(["fecha", "encargado"]);
    }

    if (step === 2 && !haHabidoNulos) {
      valid = false;
    }

    if (step === 3 && !haHabidoComida) {
      valid = false;
    }

    if (!valid) {
      setSubmitMessage({
        type: "error",
        text: "Revisa los campos obligatorios de este paso.",
      });
      return;
    }

    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const syncCumpleMargen = (
    index: number,
    overrides?: {
      horaPedido?: string;
      horaRectificativa?: string;
    }
  ) => {
    const horaPedido =
      overrides?.horaPedido ?? getValues(`nulos.${index}.horaPedido`);
    const horaRectificativa =
      overrides?.horaRectificativa ??
      getValues(`nulos.${index}.horaRectificativa`);

    const resultado = getCumpleMargen(horaPedido, horaRectificativa);

    setValue(`nulos.${index}.cumpleMargen`, resultado);
  };

  const handleNuevoPedidoChange = (index: number, value: "si" | "no") => {
    setValue(`nulos.${index}.tieneNuevoPedido`, value);

    if (value === "si") {
      (setValue as any)(`nulos.${index}.motivoSinNuevoPedido`, "");
    }

    if (value === "no") {
      (setValue as any)(`nulos.${index}.fotoNuevoPedido`, null);
    }
  };

  const onInvalid = () => {
    setSubmitMessage({
      type: "error",
      text: "Hay campos pendientes o inválidos. Revisa este paso antes de enviar.",
    });
  };

  const onSubmit = async (data: FormDataType) => {
    if (step !== steps.length - 1) return;

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const nulosConUrls = await Promise.all(
        (data.nulos || []).map(async (nulo, index) => {
          const [
            fotoPedidoOriginalUrl,
            fotoFacturaRectificativaUrl,
            fotoNuevoPedidoUrl,
          ] = await Promise.all([
            nulo.fotoPedidoOriginal instanceof File
              ? uploadFileToBlob(
                  nulo.fotoPedidoOriginal,
                  `formularios/nulos/${index + 1}/pedido-original`
                )
              : Promise.resolve(""),
            nulo.fotoFacturaRectificativa instanceof File
              ? uploadFileToBlob(
                  nulo.fotoFacturaRectificativa,
                  `formularios/nulos/${index + 1}/factura-rectificativa`
                )
              : Promise.resolve(""),
            nulo.tieneNuevoPedido === "si" &&
            nulo.fotoNuevoPedido instanceof File
              ? uploadFileToBlob(
                  nulo.fotoNuevoPedido,
                  `formularios/nulos/${index + 1}/nuevo-pedido`
                )
              : Promise.resolve(""),
          ]);

          return {
            horaPedido: nulo.horaPedido,
            horaRectificativa: nulo.horaRectificativa,
            cumpleMargen: nulo.cumpleMargen,
            motivo: nulo.motivo,
            tieneDosNombres: nulo.tieneDosNombres,
            tieneDosFirmas: nulo.tieneDosFirmas,
            tieneNuevoPedido: nulo.tieneNuevoPedido,
            motivoSinNuevoPedido: nulo.motivoSinNuevoPedido || "",
            fotoPedidoOriginalUrl,
            fotoFacturaRectificativaUrl,
            fotoNuevoPedidoUrl,
          };
        })
      );

      const payload = {
        ...data,
        quebranto,
        nulos: nulosConUrls,
      };

      const response = await fetch("/api/send-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();

      let result: any = null;
      try {
        result = rawText ? JSON.parse(rawText) : null;
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
            result?.message ||
            rawText ||
            `Error ${response.status}: no se pudo enviar el formulario.`
        );
      }

      setSubmitMessage({
        type: "success",
        text: "Formulario enviado correctamente por correo.",
      });
    } catch (error) {
      setSubmitMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Ha ocurrido un error al enviar el formulario.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f3ee] text-[#1f1b18]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-4 py-5 sm:px-6 sm:py-6 md:px-10 md:py-8 lg:px-16">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.32em] text-black/35 sm:text-[11px] sm:tracking-[0.35em]">
              Formulario Administrativo Diario
            </p>
          </div>

          <div className="w-full sm:min-w-[180px] sm:max-w-[220px]">
            <div className="mb-2 flex items-center justify-between text-[11px] text-black/45 sm:text-xs">
              <span>Paso</span>
              <span>
                {step + 1} / {steps.length}
              </span>
            </div>

            <div className="h-[3px] w-full overflow-hidden rounded-full bg-black/8">
              <div
                className="h-full rounded-full bg-[#1f1b18] transition-all duration-300"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          noValidate
          className="flex min-h-[calc(100vh-110px)] flex-1 flex-col justify-between sm:min-h-[78vh]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -22 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-[760px]"
            >
              {step === 0 && (
                <StepShell
                  eyebrow="Bienvenida"
                  title="Vamos a revisar el día."
                  description="Completa el control administrativo diario de forma rápida, clara y ordenada."
                >
                  <div className="max-w-[580px] rounded-[22px] border border-black/8 bg-white/35 p-4 text-sm leading-7 text-black/60 sm:rounded-[28px] sm:p-6 sm:text-base sm:leading-8">
                    Tendrás que revisar nulos, comida personal, caja y cierre.
                    Iremos paso a paso, como en un flujo conversacional.
                  </div>
                </StepShell>
              )}

              {step === 1 && (
                <StepShell
                  eyebrow="Datos generales"
                  title="Primero, lo básico."
                  description="Empezamos con la información mínima para identificar el cierre."
                >
                  <Field>
                    <label>Fecha del día</label>
                    <input type="date" {...register("fecha", { required: true })} />
                    {errors.fecha && <ErrorText />}
                  </Field>

                  <Field>
                    <label>Nombre del encargado</label>
                    <input
                      type="text"
                      placeholder="Ej. David"
                      {...register("encargado", { required: true })}
                    />
                    {errors.encargado && <ErrorText />}
                  </Field>

                  <Field>
                    <label>¿Ha habido alguna incidencia hoy?</label>
                    <ChoiceChips
                      value={incidencia}
                      onChange={(value) =>
                        setValue("incidencia", value as "si" | "no" | "")
                      }
                      options={[
                        { label: "Sí", value: "si" },
                        { label: "No", value: "no" },
                      ]}
                    />
                  </Field>

                  {incidencia === "si" && (
                    <Field>
                      <label>Describe brevemente la incidencia</label>
                      <textarea
                        rows={3}
                        placeholder="Explica lo ocurrido"
                        {...register("descripcionIncidencia")}
                      />
                    </Field>
                  )}
                </StepShell>
              )}

              {step === 2 && (
                <StepShell
                  eyebrow="Nulos"
                  title="Ahora, los nulos."
                  description="Indica si ha habido nulos y el formulario mostrará automáticamente los bloques necesarios."
                >
                  <Field>
                    <label>¿Ha habido nulos hoy?</label>
                    <ChoiceChips
                      value={haHabidoNulos}
                      onChange={(value) =>
                        setValue("haHabidoNulos", value as "si" | "no" | "", {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      options={[
                        { label: "Sí", value: "si" },
                        { label: "No", value: "no" },
                      ]}
                    />
                  </Field>

                  {haHabidoNulos === "si" && (
                    <>
                      <Field>
                        <label>Número de tickets anulados</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          {...register("numeroNulos", { valueAsNumber: true })}
                        />
                      </Field>

                      {Array.from({ length: numeroNulos || 0 }).map((_, index) => {
                        const horaPedido = watch(`nulos.${index}.horaPedido`);
                        const horaRectificativa = watch(
                          `nulos.${index}.horaRectificativa`
                        );
                        const cumpleMargenCalculado = getCumpleMargen(
                          horaPedido,
                          horaRectificativa
                        );
                        const tieneNuevoPedido =
                          watch(`nulos.${index}.tieneNuevoPedido`) || "";

                        const fotoPedidoOriginal = (watch as any)(
                          `nulos.${index}.fotoPedidoOriginal`
                        ) as File | null | undefined;

                        const fotoFacturaRectificativa = (watch as any)(
                          `nulos.${index}.fotoFacturaRectificativa`
                        ) as File | null | undefined;

                        const fotoNuevoPedido = (watch as any)(
                          `nulos.${index}.fotoNuevoPedido`
                        ) as File | null | undefined;

                        const errorMotivoNoAdjunta = (errors as any)?.nulos?.[index]
                          ?.motivoSinNuevoPedido;

                        return (
                          <div
                            key={index}
                            className="rounded-[22px] border border-black/8 bg-white/40 p-4 sm:rounded-[26px] sm:p-6"
                          >
                            <h3 className="mb-5 text-xl font-semibold tracking-[-0.02em] sm:mb-6 sm:text-2xl">
                              Nulo {index + 1}
                            </h3>

                            <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                              <Field>
                                <label>Hora del pedido realizado</label>
                                <input
                                  type="time"
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setValue(`nulos.${index}.horaPedido`, value);
                                    syncCumpleMargen(index, {
                                      horaPedido: value,
                                    });
                                  }}
                                />
                              </Field>

                              <Field>
                                <label>Hora de la factura rectificativa</label>
                                <input
                                  type="time"
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setValue(
                                      `nulos.${index}.horaRectificativa`,
                                      value
                                    );
                                    syncCumpleMargen(index, {
                                      horaRectificativa: value,
                                    });
                                  }}
                                />
                              </Field>

                              <Field>
                                <label>¿Se cumple el margen de 15 minutos?</label>
                                <AutoCalculatedStatus
                                  value={cumpleMargenCalculado}
                                  emptyText="Completa ambas horas para calcularlo."
                                  yesText="Sí, está dentro del margen."
                                  noText="No, supera el margen."
                                />
                              </Field>

                              <Field>
                                <label>Motivo del nulo</label>
                                <input
                                  type="text"
                                  placeholder="Explica el motivo"
                                  onChange={(e) =>
                                    setValue(`nulos.${index}.motivo`, e.target.value)
                                  }
                                />
                              </Field>

                              <Field>
                                <label>¿Están los dos nombres?</label>
                                <ChoiceChips
                                  value={watch(`nulos.${index}.tieneDosNombres`) || ""}
                                  onChange={(value) =>
                                    setValue(
                                      `nulos.${index}.tieneDosNombres`,
                                      value as "si" | "no"
                                    )
                                  }
                                  options={[
                                    { label: "Sí", value: "si" },
                                    { label: "No", value: "no" },
                                  ]}
                                />
                              </Field>

                              <Field>
                                <label>¿Están las dos firmas?</label>
                                <ChoiceChips
                                  value={watch(`nulos.${index}.tieneDosFirmas`) || ""}
                                  onChange={(value) =>
                                    setValue(
                                      `nulos.${index}.tieneDosFirmas`,
                                      value as "si" | "no"
                                    )
                                  }
                                  options={[
                                    { label: "Sí", value: "si" },
                                    { label: "No", value: "no" },
                                  ]}
                                />
                              </Field>

                              <Field>
                                <label>Foto del pedido original</label>
                                <FileUploadField
                                  fileName={fotoPedidoOriginal?.name}
                                  onChange={(file) =>
                                    (setValue as any)(
                                      `nulos.${index}.fotoPedidoOriginal`,
                                      file
                                    )
                                  }
                                />
                              </Field>

                              <Field>
                                <label>Foto de la factura rectificativa</label>
                                <FileUploadField
                                  fileName={fotoFacturaRectificativa?.name}
                                  onChange={(file) =>
                                    (setValue as any)(
                                      `nulos.${index}.fotoFacturaRectificativa`,
                                      file
                                    )
                                  }
                                />
                              </Field>

                              <Field className="md:col-span-2">
                                <label>¿Está el nuevo pedido adjunto?</label>
                                <ChoiceChips
                                  value={tieneNuevoPedido}
                                  onChange={(value) =>
                                    handleNuevoPedidoChange(
                                      index,
                                      value as "si" | "no"
                                    )
                                  }
                                  options={[
                                    { label: "Sí", value: "si" },
                                    { label: "No", value: "no" },
                                  ]}
                                />
                              </Field>

                              {tieneNuevoPedido === "si" && (
                                <Field className="md:col-span-2">
                                  <label>Foto del nuevo pedido</label>
                                  <FileUploadField
                                    fileName={fotoNuevoPedido?.name}
                                    onChange={(file) =>
                                      (setValue as any)(
                                        `nulos.${index}.fotoNuevoPedido`,
                                        file
                                      )
                                    }
                                  />
                                </Field>
                              )}

                              {tieneNuevoPedido === "no" && (
                                <Field className="md:col-span-2">
                                  <label>
                                    Explica por qué no está adjunto el nuevo pedido
                                  </label>
                                  <textarea
                                    rows={3}
                                    placeholder="Describe el motivo"
                                    {...((register as any)(
                                      `nulos.${index}.motivoSinNuevoPedido`,
                                      {
                                        validate: (value: string) => {
                                          const estado = (watch as any)(
                                            `nulos.${index}.tieneNuevoPedido`
                                          );

                                          if (
                                            estado === "no" &&
                                            !String(value || "").trim()
                                          ) {
                                            return "Este campo es obligatorio.";
                                          }

                                          return true;
                                        },
                                      }
                                    ) as any)}
                                  />
                                  {errorMotivoNoAdjunta && <ErrorText />}
                                </Field>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </StepShell>
              )}

              {step === 3 && (
                <StepShell
                  eyebrow="Comida personal"
                  title="Seguimos con comida personal."
                  description="Registra el resumen del día y después las personas necesarias."
                >
                  <Field>
                    <label>¿Ha habido comida personal hoy?</label>
                    <ChoiceChips
                      value={haHabidoComida}
                      onChange={(value) =>
                        setValue("haHabidoComida", value as "si" | "no" | "", {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      options={[
                        { label: "Sí", value: "si" },
                        { label: "No", value: "no" },
                      ]}
                    />
                  </Field>

                  {haHabidoComida === "si" && (
                    <>
                      <Field>
                        <label>¿Cuántas personas tenían derecho a comer?</label>
                        <input
                          type="number"
                          {...register("personasConDerecho", { valueAsNumber: true })}
                        />
                      </Field>

                      <Field>
                        <label>¿Cuántos tickets tenía que haber en el día?</label>
                        <input
                          type="number"
                          {...register("ticketsEsperados", { valueAsNumber: true })}
                        />
                      </Field>

                      <Field>
                        <label>¿Cuántos tickets ha habido finalmente en el día?</label>
                        <input
                          type="number"
                          {...register("ticketsFinales", { valueAsNumber: true })}
                        />
                      </Field>

                      <Field>
                        <label>
                          ¿Qué personas no tienen ticada la comida pese a tener derecho?
                        </label>
                        <textarea rows={3} {...register("personasSinTicar")} />
                      </Field>

                      <Field>
                        <label>Número de personas a registrar</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          {...register("numeroPersonasComida", {
                            valueAsNumber: true,
                          })}
                        />
                      </Field>

                      {Array.from({ length: numeroPersonasComida || 0 }).map(
                        (_, index) => (
                          <div
                            key={index}
                            className="rounded-[22px] border border-black/8 bg-white/40 p-4 sm:rounded-[26px] sm:p-6"
                          >
                            <h3 className="mb-5 text-xl font-semibold tracking-[-0.02em] sm:mb-6 sm:text-2xl">
                              Persona {index + 1}
                            </h3>

                            <div className="grid gap-5 md:grid-cols-2 md:gap-6">
                              <Field>
                                <label>Nombre</label>
                                <input
                                  type="text"
                                  placeholder="Nombre del empleado"
                                  onChange={(e) =>
                                    setValue(`comidas.${index}.nombre`, e.target.value)
                                  }
                                />
                              </Field>

                              <Field>
                                <label>Hora</label>
                                <input
                                  type="time"
                                  onChange={(e) =>
                                    setValue(`comidas.${index}.hora`, e.target.value)
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                        )
                      )}
                    </>
                  )}
                </StepShell>
              )}

              {step === 4 && (
                <StepShell
                  eyebrow="Caja"
                  title="Revisamos importes."
                  description="Introduce efectivo, billetes y monedas de Loomis. El quebranto se calcula automáticamente y puedes dejar observaciones."
                >
                  <Field>
                    <label>Efectivo post de storeace</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register("efectivoStoreace" as keyof FormDataType, {
                        valueAsNumber: true,
                      })}
                    />
                  </Field>

                  <Field>
                    <label>Billetes Loomis</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register("billetesLoomis" as keyof FormDataType, {
                        valueAsNumber: true,
                      })}
                    />
                  </Field>

                  <Field>
                    <label>Monedas Loomis</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register("monedasLoomis" as keyof FormDataType, {
                        valueAsNumber: true,
                      })}
                    />
                  </Field>

                  <Field>
                    <label>Observaciones de caja</label>
                    <textarea
                      rows={3}
                      placeholder="Añade aquí cualquier detalle sobre caja o diferencias detectadas"
                      {...register("observacionesCaja" as keyof FormDataType)}
                    />
                  </Field>

                  <div className="rounded-[22px] bg-[#1f1b18] px-5 py-6 text-white sm:rounded-[28px] sm:px-7 sm:py-8">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-white/50 sm:text-[11px] sm:tracking-[0.32em]">
                      Quebranto calculado
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
                      {Number.isFinite(quebranto) ? quebranto.toFixed(2) : "0.00"} €
                    </p>
                  </div>
                </StepShell>
              )}

              {step === 5 && (
                <StepShell
                  eyebrow="Cierre"
                  title="Último paso."
                  description="Primero añade una observación final. Después pulsa el botón para enviar el formulario."
                >
                  <Field>
                    <label>Comentario final del encargado</label>
                    <textarea
                      rows={4}
                      placeholder="Añade una observación si hace falta"
                      {...register("comentarioFinal")}
                    />
                  </Field>

                  {submitMessage && (
                    <div
                      className={`rounded-[22px] border px-5 py-4 text-sm sm:rounded-[26px] ${
                        submitMessage.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {submitMessage.text}
                    </div>
                  )}

                  <div className="rounded-[22px] border border-dashed border-black/12 bg-white/25 p-4 text-sm leading-7 text-black/55 sm:rounded-[26px] sm:p-6">
                    Aquí todavía no se envía nada automáticamente. El formulario
                    solo se enviará cuando pulses el botón final.
                  </div>
                </StepShell>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex flex-col-reverse gap-3 pt-6 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-8">
            <button
              type="button"
              onClick={prev}
              disabled={step === 0 || isSubmitting}
              className="w-full rounded-full border border-black/10 px-5 py-3 text-sm font-medium text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
            >
              Anterior
            </button>

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={next}
                disabled={isSubmitting}
                className="w-full rounded-full bg-[#1f1b18] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(onSubmit, onInvalid)()}
                disabled={isSubmitting}
                className="w-full rounded-full bg-[#1f1b18] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSubmitting ? "Enviando..." : "Finalizar y enviar"}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

function getCumpleMargen(
  horaPedido?: string,
  horaRectificativa?: string
): "si" | "no" | "" {
  if (!horaPedido || !horaRectificativa) return "";

  const pedidoMinutos = timeToMinutes(horaPedido);
  const rectificativaMinutos = timeToMinutes(horaRectificativa);

  if (pedidoMinutos === null || rectificativaMinutos === null) return "";

  const diferencia = rectificativaMinutos - pedidoMinutos;

  if (diferencia < 0) return "no";

  return diferencia <= 15 ? "si" : "no";
}

function timeToMinutes(value: string): number | null {
  const parts = value.split(":").map(Number);

  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }

  return parts[0] * 60 + parts[1];
}

async function uploadFileToBlob(file: File, folder: string): Promise<string> {
  const fileName = buildBlobFileName(file.name, folder);

  const blob = await upload(fileName, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });

  return blob.url;
}

function buildBlobFileName(originalName: string, folder: string) {
  const cleanName = sanitizeFileName(originalName || "archivo");
  const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${folder}/${uniquePrefix}-${cleanName}`;
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

function StepShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="pt-2 sm:pt-6 md:pt-10">
      <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-[#c7783d] sm:mb-6 sm:text-[11px] sm:tracking-[0.35em]">
        {eyebrow}
      </p>

      <h2 className="max-w-[680px] text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-[#1f1b18] sm:text-5xl lg:text-7xl">
        {title}
      </h2>

      <p className="mt-4 max-w-[560px] text-base leading-7 text-black/55 sm:mt-6 sm:text-lg sm:leading-8">
        {description}
      </p>

      <div className="mt-10 space-y-6 sm:mt-14 sm:space-y-8">{children}</div>
    </div>
  );
}

function Field({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`space-y-3 ${className}`}>{children}</div>;
}

function ErrorText() {
  return <p className="text-sm text-[#c65a3a]">Este campo es obligatorio.</p>;
}

function ChoiceChips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-2 sm:flex sm:flex-wrap">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-[48px] w-full rounded-2xl border px-4 py-3 text-sm font-medium transition sm:w-auto sm:rounded-full sm:px-5 sm:text-base ${
              active
                ? "border-[#1f1b18] bg-[#1f1b18] text-white shadow-sm"
                : "border-black/10 bg-white text-[#1f1b18] hover:border-black/20 hover:bg-black/[0.03]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AutoCalculatedStatus({
  value,
  emptyText,
  yesText,
  noText,
}: {
  value: "si" | "no" | "";
  emptyText: string;
  yesText: string;
  noText: string;
}) {
  if (!value) {
    return (
      <div className="rounded-2xl border border-black/8 bg-white/60 px-4 py-4 text-sm text-black/55">
        {emptyText}
      </div>
    );
  }

  const isYes = value === "si";

  return (
    <div
      className={`rounded-2xl border px-4 py-4 text-sm font-medium ${
        isYes
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {isYes ? yesText : noText}
    </div>
  );
}

function FileUploadField({
  fileName,
  onChange,
}: {
  fileName?: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-black/12 bg-white/70 p-4">
      <input
        type="file"
        accept="image/*"
        className="!w-full !border-0 !p-0 !text-sm !leading-6 file:mr-3 file:rounded-full file:border-0 file:bg-[#1f1b18] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      <p className="mt-3 text-sm text-black/45">
        {fileName
          ? `Archivo seleccionado: ${fileName}`
          : "No se ha subido ninguna imagen todavía."}
      </p>
    </div>
  );
}