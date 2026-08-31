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
  "Fichajes",
  "Cierre",
];

type SubmitMessage =
  | {
      type: "success" | "error";
      text: string;
    }
  | null;

type UploadStatus = "idle" | "uploading" | "uploaded" | "error";

type UploadedFileState = {
  status: UploadStatus;
  fileName?: string;
  url?: string;
  error?: string;
};

type UploadFieldName =
  | "fotoPedidoOriginal"
  | "fotoFacturaRectificativa"
  | "fotoNuevoPedido";

export default function MultiStepForm() {
  const [step, setStep] = useState(0);
  // Dirección del último cambio de paso. Sólo alimenta la animación:
  // hacia delante entra por la derecha, hacia atrás por la izquierda.
  const [dir, setDir] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<SubmitMessage>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, UploadedFileState>
  >({});

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
      tieneFichajes: "",
      numeroFotosFichajes: 1,
      fichajes: [],
      motivoSinFichajes: "",
      comentarioFinal: "",
    } as FormDataType,
    mode: "onSubmit",
  });

  const numeroNulos = Number(watch("numeroNulos") || 0);
  const numeroPersonasComida = Number(watch("numeroPersonasComida") || 0);
  const incidencia = watch("incidencia");
  const haHabidoNulos = watch("haHabidoNulos");
  const haHabidoComida = watch("haHabidoComida");
  const tieneFichajes = watch("tieneFichajes");
  const numeroFotosFichajes = Number(watch("numeroFotosFichajes") || 0);

  const efectivoStoreace = Number((watch as any)("efectivoStoreace") || 0);
  const billetesLoomis = Number((watch as any)("billetesLoomis") || 0);
  const monedasLoomis = Number((watch as any)("monedasLoomis") || 0);

  const quebranto = useMemo(() => {
    return (billetesLoomis + monedasLoomis) - efectivoStoreace;
  }, [efectivoStoreace, billetesLoomis, monedasLoomis]);

  // Sólo presentación: la desviación ya se deduce de dos campos observados.
  const ticketsEsperados = Number(watch("ticketsEsperados") || 0);
  const ticketsFinales = Number(watch("ticketsFinales") || 0);
  const ticketsDelta = ticketsFinales - ticketsEsperados;

  const isUploadingFiles = useMemo(() => {
    return Object.values(uploadedFiles).some(
      (fileState) => fileState.status === "uploading"
    );
  }, [uploadedFiles]);

  const uploadSummary = useMemo(() => {
    const values = Object.values(uploadedFiles);
    const totalSelected = values.length;
    const uploading = values.filter((item) => item.status === "uploading").length;
    const uploaded = values.filter((item) => item.status === "uploaded").length;
    const error = values.filter((item) => item.status === "error").length;
    const progressPercent =
      totalSelected > 0 ? Math.round((uploaded / totalSelected) * 100) : 0;

    return {
      totalSelected,
      uploading,
      uploaded,
      error,
      progressPercent,
    };
  }, [uploadedFiles]);

  useEffect(() => {
    setSubmitMessage(null);
  }, [step]);

  const prev = () => {
    setDir(-1);
    setStep((prev) => Math.max(prev - 1, 0));
  };

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

    if (step === 5 && !tieneFichajes) {
      valid = false;
    }

    if (!valid) {
      setSubmitMessage({
        type: "error",
        text: "Revisa los campos obligatorios de este paso.",
      });
      return;
    }

    setDir(1);
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

  const getUploadKey = (index: number, fieldName: UploadFieldName) =>
    `nulos.${index}.${fieldName}`;

  const clearUploadedFile = (index: number, fieldName: UploadFieldName) => {
    const key = getUploadKey(index, fieldName);

    setUploadedFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    (setValue as any)(`nulos.${index}.${fieldName}`, null);
  };

  const handleNuevoPedidoChange = (index: number, value: "si" | "no") => {
    setValue(`nulos.${index}.tieneNuevoPedido`, value);

    if (value === "si") {
      (setValue as any)(`nulos.${index}.motivoSinNuevoPedido`, "");
    }

    if (value === "no") {
      clearUploadedFile(index, "fotoNuevoPedido");
    }
  };

  const handleFileSelected = async (
    index: number,
    fieldName: UploadFieldName,
    file: File | null,
    folderSuffix: string
  ) => {
    const key = getUploadKey(index, fieldName);

    setSubmitMessage(null);

    if (!file) {
      clearUploadedFile(index, fieldName);
      return;
    }

    (setValue as any)(`nulos.${index}.${fieldName}`, file);

    setUploadedFiles((prev) => ({
      ...prev,
      [key]: {
        status: "uploading",
        fileName: file.name,
      },
    }));

    try {
      const url = await uploadFileToBlob(
        file,
        `formularios/nulos/${index + 1}/${folderSuffix}`
      );

      setUploadedFiles((prev) => ({
        ...prev,
        [key]: {
          status: "uploaded",
          fileName: file.name,
          url,
        },
      }));
    } catch (error) {
      setUploadedFiles((prev) => ({
        ...prev,
        [key]: {
          status: "error",
          fileName: file.name,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo subir la imagen.",
        },
      }));
    }
  };

  const getFichajeUploadKey = (index: number) => `fichajes.${index}.foto`;

  const handleFichajeFileSelected = async (
    index: number,
    file: File | null
  ) => {
    const key = getFichajeUploadKey(index);

    setSubmitMessage(null);

    if (!file) {
      setUploadedFiles((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      (setValue as any)(`fichajes.${index}.foto`, null);
      return;
    }

    (setValue as any)(`fichajes.${index}.foto`, file);

    setUploadedFiles((prev) => ({
      ...prev,
      [key]: {
        status: "uploading",
        fileName: file.name,
      },
    }));

    try {
      const url = await uploadFileToBlob(
        file,
        `formularios/fichajes/${index + 1}`
      );

      setUploadedFiles((prev) => ({
        ...prev,
        [key]: {
          status: "uploaded",
          fileName: file.name,
          url,
        },
      }));
    } catch (error) {
      setUploadedFiles((prev) => ({
        ...prev,
        [key]: {
          status: "error",
          fileName: file.name,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo subir la imagen.",
        },
      }));
    }
  };

  const handleTieneFichajesChange = (value: "si" | "no") => {
    setValue("tieneFichajes", value, {
      shouldValidate: true,
      shouldDirty: true,
    });

    if (value === "si") {
      (setValue as any)("motivoSinFichajes", "");
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

    if (isUploadingFiles) {
      setSubmitMessage({
        type: "error",
        text: "Todavía se están subiendo imágenes. Espera a que terminen antes de enviar.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const nulosConUrls = (data.nulos || []).map((nulo, index) => {
        const fotoPedidoOriginalUrl =
          uploadedFiles[getUploadKey(index, "fotoPedidoOriginal")]?.url || "";
        const fotoFacturaRectificativaUrl =
          uploadedFiles[getUploadKey(index, "fotoFacturaRectificativa")]?.url ||
          "";
        const fotoNuevoPedidoUrl =
          uploadedFiles[getUploadKey(index, "fotoNuevoPedido")]?.url || "";

        if (nulo.fotoPedidoOriginal && !fotoPedidoOriginalUrl) {
          throw new Error(
            `La imagen "Foto del pedido original" del nulo ${index + 1} no se ha subido correctamente.`
          );
        }

        if (nulo.fotoFacturaRectificativa && !fotoFacturaRectificativaUrl) {
          throw new Error(
            `La imagen "Foto de la factura rectificativa" del nulo ${index + 1} no se ha subido correctamente.`
          );
        }

        if (
          nulo.tieneNuevoPedido === "si" &&
          nulo.fotoNuevoPedido &&
          !fotoNuevoPedidoUrl
        ) {
          throw new Error(
            `La imagen "Foto del nuevo pedido" del nulo ${index + 1} no se ha subido correctamente.`
          );
        }

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
      });

      const fichajesConUrls = (data.fichajes || [])
        .slice(0, Number(data.numeroFotosFichajes) || 0)
        .map((fichaje, index) => {
          const fotoUrl =
            uploadedFiles[getFichajeUploadKey(index)]?.url || "";

          if (fichaje?.foto && !fotoUrl) {
            throw new Error(
              `La foto ${index + 1} de los fichajes no se ha subido correctamente.`
            );
          }

          return { fotoUrl };
        })
        .filter((fichaje) => Boolean(fichaje.fotoUrl));

      const payload = {
        ...data,
        quebranto,
        nulos: nulosConUrls,
        fichajes: data.tieneFichajes === "si" ? fichajesConUrls : [],
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
    <main className="app">
      <div className="shell">
        <div className="topbar">
          <p className="topbar-brand">Parte administrativo diario</p>

          <p className="topbar-count">
            <span key={step} className="count-swap">
              <b>{String(step + 1).padStart(2, "0")}</b> / {steps.length}
            </span>
          </p>
        </div>

        <div className="progress">
          <span
            className="progress-fill"
            style={{
              transform: `scaleX(${(step + 1) / steps.length})`,
            }}
          />
        </div>

        <form
          onSubmit={(e) => e.preventDefault()}
          noValidate
          className="flex flex-1 flex-col justify-between"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: dir * 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -18 }}
              transition={{ duration: 0.17, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-[820px]"
            >
              {step === 0 && (
                <StepShell
                  eyebrow="Bienvenida"
                  title="Vamos a revisar el día."
                  description="Completa el control administrativo diario de forma rápida, clara y ordenada."
                >
                  <div className="enter notice" style={{ "--i": 4 } as never}>
                    <span className="notice-icon">
                      <InfoIcon />
                    </span>
                    <span>
                      Vas a revisar nulos, comida personal, caja y cierre. Iremos
                      paso a paso: cada pantalla te pide sólo lo que necesita.
                    </span>
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

                  <Reveal open={incidencia === "si"}>
                    <Field>
                      <label>Describe brevemente la incidencia</label>
                      <textarea
                        rows={3}
                        placeholder="Explica lo ocurrido"
                        {...register("descripcionIncidencia")}
                      />
                    </Field>
                  </Reveal>
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

                      {uploadSummary.totalSelected > 0 && (
                        <UploadSummaryCard summary={uploadSummary} />
                      )}

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

                        const uploadPedidoOriginal =
                          uploadedFiles[getUploadKey(index, "fotoPedidoOriginal")];
                        const uploadFacturaRectificativa =
                          uploadedFiles[
                            getUploadKey(index, "fotoFacturaRectificativa")
                          ];
                        const uploadNuevoPedido =
                          uploadedFiles[getUploadKey(index, "fotoNuevoPedido")];

                        return (
                          <div
                            key={index}
                            className="card"
                            style={{ "--i": Math.min(index, 5) } as never}
                          >
                            <div className="card-head">
                              <h3 className="card-title">Nulo {index + 1}</h3>
                              <span className="card-index">
                                {String(index + 1).padStart(2, "0")} /{" "}
                                {String(numeroNulos || 0).padStart(2, "0")}
                              </span>
                            </div>

                            <div className="card-grid">
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
                                  file={fotoPedidoOriginal}
                                  uploadState={uploadPedidoOriginal}
                                  onChange={(file) =>
                                    handleFileSelected(
                                      index,
                                      "fotoPedidoOriginal",
                                      file,
                                      "pedido-original"
                                    )
                                  }
                                />
                              </Field>

                              <Field>
                                <label>Foto de la factura rectificativa</label>
                                <FileUploadField
                                  file={fotoFacturaRectificativa}
                                  uploadState={uploadFacturaRectificativa}
                                  onChange={(file) =>
                                    handleFileSelected(
                                      index,
                                      "fotoFacturaRectificativa",
                                      file,
                                      "factura-rectificativa"
                                    )
                                  }
                                />
                              </Field>

                              <Field className="span-2">
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
                                <Field className="span-2">
                                  <label>Foto del nuevo pedido</label>
                                  <FileUploadField
                                    file={fotoNuevoPedido}
                                    uploadState={uploadNuevoPedido}
                                    onChange={(file) =>
                                      handleFileSelected(
                                        index,
                                        "fotoNuevoPedido",
                                        file,
                                        "nuevo-pedido"
                                      )
                                    }
                                  />
                                </Field>
                              )}

                              {tieneNuevoPedido === "no" && (
                                <Field className="span-2">
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
                        {ticketsDelta !== 0 && (
                          <span className="delta">
                            <AlertIcon />
                            {ticketsDelta > 0 ? "+" : "−"}
                            {Math.abs(ticketsDelta)}{" "}
                            {Math.abs(ticketsDelta) === 1 ? "ticket" : "tickets"}{" "}
                            respecto a lo esperado
                          </span>
                        )}
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
                            className="card"
                            style={{ "--i": Math.min(index, 5) } as never}
                          >
                            <div className="card-head">
                              <h3 className="card-title">Persona {index + 1}</h3>
                              <span className="card-index">
                                {String(index + 1).padStart(2, "0")} /{" "}
                                {String(numeroPersonasComida || 0).padStart(2, "0")}
                              </span>
                            </div>

                            <div className="card-grid">
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

                  <QuebrantoCard
                    quebranto={quebranto}
                    efectivo={efectivoStoreace}
                    billetes={billetesLoomis}
                    monedas={monedasLoomis}
                  />
                </StepShell>
              )}

              {step === 5 && (
                <StepShell
                  eyebrow="Fichajes"
                  title="El registro de jornada."
                  description="Adjunta la foto de los fichajes del día. Si hacen falta varias capturas para que salga el turno entero, indica cuántas."
                >
                  <Field>
                    <label>¿Tienes la foto de los fichajes?</label>
                    <ChoiceChips
                      value={tieneFichajes}
                      onChange={(value) =>
                        handleTieneFichajesChange(value as "si" | "no")
                      }
                      options={[
                        { label: "Sí", value: "si" },
                        { label: "No", value: "no" },
                      ]}
                    />
                  </Field>

                  {tieneFichajes === "si" && (
                    <>
                      <Field>
                        <label>Número de fotos</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          {...register("numeroFotosFichajes", {
                            valueAsNumber: true,
                          })}
                        />
                      </Field>

                      {Array.from({ length: numeroFotosFichajes || 0 }).map(
                        (_, index) => {
                          const foto = (watch as any)(
                            `fichajes.${index}.foto`
                          ) as File | null | undefined;

                          const uploadFichaje =
                            uploadedFiles[getFichajeUploadKey(index)];

                          return (
                            <div
                              key={index}
                              className="card"
                              style={{ "--i": Math.min(index, 5) } as never}
                            >
                              <div className="card-head">
                                <h3 className="card-title">
                                  Foto {index + 1}
                                </h3>
                                <span className="card-index">
                                  {String(index + 1).padStart(2, "0")} /{" "}
                                  {String(numeroFotosFichajes || 0).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>
                              </div>

                              <Field>
                                <label>Foto del registro de jornada</label>
                                <FileUploadField
                                  file={foto}
                                  uploadState={uploadFichaje}
                                  onChange={(file) =>
                                    handleFichajeFileSelected(index, file)
                                  }
                                />
                              </Field>
                            </div>
                          );
                        }
                      )}
                    </>
                  )}

                  <Reveal open={tieneFichajes === "no"}>
                    <Field>
                      <label>Explica por qué no hay foto de los fichajes</label>
                      <textarea
                        rows={3}
                        placeholder="Describe el motivo"
                        {...register("motivoSinFichajes")}
                      />
                    </Field>
                  </Reveal>
                </StepShell>
              )}

              {step === 6 && submitMessage?.type === "success" && (
                <div className="confirm">
                  <span className="confirm-mark">
                    <CheckIcon size={24} tone="var(--pos)" />
                  </span>

                  <div>
                    <p className="step-eyebrow">Día cerrado</p>
                    <h2 className="confirm-title">Parte enviado.</h2>
                    <p className="step-desc">
                      Ya está en el correo del restaurante. Puedes cerrar esta
                      pantalla.
                    </p>
                  </div>

                  <div className="confirm-list">
                    <div className="confirm-row" style={{ "--i": 0 } as never}>
                      <span>Fecha</span>
                      <b>{formatFechaCorta(getValues("fecha"))}</b>
                    </div>
                    <div className="confirm-row" style={{ "--i": 1 } as never}>
                      <span>Encargado</span>
                      <b>{getValues("encargado") || "—"}</b>
                    </div>
                    <div className="confirm-row" style={{ "--i": 2 } as never}>
                      <span>Quebranto</span>
                      <b>{formatEuros(quebranto)}</b>
                    </div>
                    <div className="confirm-row" style={{ "--i": 3 } as never}>
                      <span>Imágenes adjuntas</span>
                      <b>{uploadSummary.uploaded}</b>
                    </div>
                  </div>
                </div>
              )}

              {step === 6 && submitMessage?.type !== "success" && (
                <StepShell
                  eyebrow="Cierre"
                  title="Último paso."
                  description="Añade una observación final si hace falta y envía el parte."
                >
                  <Field>
                    <label>Comentario final del encargado</label>
                    <textarea
                      rows={4}
                      placeholder="Añade una observación si hace falta"
                      {...register("comentarioFinal")}
                    />
                  </Field>

                  {uploadSummary.totalSelected > 0 && (
                    <UploadSummaryCard summary={uploadSummary} />
                  )}

                  {submitMessage && (
                    <div className="notice" data-tone="error">
                      <span className="notice-icon">
                        <AlertIcon />
                      </span>
                      <span>{submitMessage.text}</span>
                    </div>
                  )}

                  <div className="notice" data-tone="info">
                    <span className="notice-icon">
                      <InfoIcon />
                    </span>
                    <span>
                      Las imágenes se suben al seleccionarlas. Cuando todas estén
                      confirmadas, el botón enviará el parte con sus enlaces.
                    </span>
                  </div>
                </StepShell>
              )}
            </motion.div>
          </AnimatePresence>

          {step < 6 && submitMessage?.type === "error" && (
            <div className="mt-8 max-w-[820px]">
              <div className="notice" data-tone="error">
                <span className="notice-icon">
                  <AlertIcon />
                </span>
                <span>{submitMessage.text}</span>
              </div>
            </div>
          )}

          <div className="nav">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                disabled={isSubmitting}
                className="btn btn-ghost"
              >
                Atrás
              </button>
            )}

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={next}
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                <span className="btn-label">Siguiente</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(onSubmit, onInvalid)()}
                disabled={isSubmitting || isUploadingFiles}
                className="btn btn-primary"
              >
                {isSubmitting ? (
                  <span key="sending" className="btn-label">
                    <Spinner />
                    Enviando
                  </span>
                ) : isUploadingFiles ? (
                  <span key="waiting" className="btn-label">
                    <Spinner />
                    Esperando imágenes
                  </span>
                ) : submitMessage?.type === "success" ? (
                  <span key="sent" className="btn-label">
                    <CheckIcon />
                    Enviado
                  </span>
                ) : (
                  <span key="idle" className="btn-label">
                    Finalizar y enviar
                  </span>
                )}
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
    access: "private",
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

function formatFechaCorta(value?: string) {
  if (!value) return "—";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatEuros(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe).toFixed(2).replace(".", ",");
  const sign = safe < 0 ? "−" : safe > 0 ? "+" : "";

  return `${sign}${abs} €`;
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
    <div className="step">
      <p className="step-eyebrow enter" style={{ "--i": 0 } as never}>
        {eyebrow}
      </p>

      <h2 className="step-title enter" style={{ "--i": 1 } as never}>
        {title}
      </h2>

      <p className="step-desc enter" style={{ "--i": 2 } as never}>
        {description}
      </p>

      <div className="step-fields enter" style={{ "--i": 3 } as never}>
        {children}
      </div>
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
  return <div className={`field ${className}`}>{children}</div>;
}

/**
 * Despliega contenido animando la altura sin medirla en JS.
 * El contenido sigue montado siempre — react-hook-form conserva el valor
 * exactamente igual que antes — pero queda inerte cuando está cerrado.
 */
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="reveal" data-open={open} aria-hidden={!open}>
      <div className="reveal-inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}

function ErrorText() {
  return (
    <p className="mt-2 text-[13px] text-[var(--neg)]">
      Este campo es obligatorio.
    </p>
  );
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
  const selected = options.findIndex((option) => option.value === value);

  return (
    <div className="chips" data-sel={selected >= 0 ? selected : undefined}>
      <span className="chips-ind" />

      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className="chip"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * El veredicto se pinta con un barrido de color de izquierda a derecha y los
 * tres textos se cruzan tras un desenfoque de 2 px. Sin el blur se ven dos
 * cajas solapándose; con él se lee como una sola cosa transformándose.
 */
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
  return (
    <div className="status" data-state={value || "empty"}>
      <span className="status-fill" />

      <span className="status-lines">
        <span className="status-line" data-show={!value}>
          {emptyText}
        </span>
        <span className="status-line" data-tone="si" data-show={value === "si"}>
          {yesText}
        </span>
        <span className="status-line" data-tone="no" data-show={value === "no"}>
          {noText}
        </span>
      </span>
    </div>
  );
}

function QuebrantoCard({
  quebranto,
  efectivo,
  billetes,
  monedas,
}: {
  quebranto: number;
  efectivo: number;
  billetes: number;
  monedas: number;
}) {
  const safe = Number.isFinite(quebranto) ? quebranto : 0;
  const rounded = Math.round(safe * 100) / 100;

  // Convenio: negativo = falta en caja, positivo = sobra. Las dos cosas son
  // un descuadre, así que ninguna se pinta de verde; sólo el cero cuadra.
  const sign = rounded < 0 ? "neg" : rounded > 0 ? "pos" : "zero";
  const veredicto =
    rounded < 0 ? "Falta en caja" : rounded > 0 ? "Sobra en caja" : "Caja cuadrada";
  const text = formatEuros(rounded);

  return (
    <div className="queb" data-sign={sign}>
      <p className="queb-key">Quebranto calculado</p>

      {/* La key hace que la cifra vuelva a entrar cada vez que cambia */}
      <p className="queb-value">
        <span key={text} className="queb-roll">
          {text}
        </span>
      </p>

      <p className="queb-verdict">
        <span key={veredicto} className="queb-roll">
          {veredicto}
        </span>
      </p>

      {/* El orden refleja la resta que se está haciendo */}
      <div className="ledger">
        <div className="ledger-row">
          <span>Billetes Loomis</span>
          <span>{formatAmount(billetes)}</span>
        </div>
        <div className="ledger-row">
          <span>Monedas Loomis</span>
          <span>{formatAmount(monedas)}</span>
        </div>
        <div className="ledger-row">
          <span>Efectivo post de Storeace</span>
          <span>−{formatAmount(efectivo)}</span>
        </div>
      </div>
    </div>
  );
}

function formatAmount(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(2).replace(".", ",");
}

function UploadSummaryCard({
  summary,
}: {
  summary: {
    totalSelected: number;
    uploading: number;
    uploaded: number;
    error: number;
    progressPercent: number;
  };
}) {
  return (
    <div className="summary">
      <div className="summary-top">
        <div>
          <p className="summary-key">Estado de imágenes</p>
          <p className="summary-value">
            <b>{summary.uploaded}</b> de <b>{summary.totalSelected}</b> subidas
          </p>
        </div>

        <div className="summary-aside">
          {summary.uploading > 0 && <span>Subiendo {summary.uploading}</span>}
          {summary.error > 0 && (
            <span style={{ color: "var(--neg)" }}>
              Con error {summary.error}
            </span>
          )}
          {summary.uploading === 0 && summary.error === 0 && (
            <span style={{ color: "var(--pos)" }}>Listas</span>
          )}
        </div>
      </div>

      <div className="progress">
        <span
          className="progress-fill"
          style={{ transform: `scaleX(${summary.progressPercent / 100})` }}
        />
      </div>
    </div>
  );
}

function FileUploadField({
  file,
  uploadState,
  onChange,
}: {
  file?: File | null;
  uploadState?: UploadedFileState;
  onChange: (file: File | null) => void | Promise<void>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const status = uploadState?.status || "idle";
  const previewUrl = useObjectUrl(file);

  return (
    <div
      className="uploader"
      data-status={status}
      data-drag={isDragging}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void onChange(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <label className="uploader-pick">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            void onChange(e.target.files?.[0] ?? null);
          }}
        />
        <span className="uploader-btn">
          {file ? "Cambiar foto" : "Elegir foto"}
        </span>
        <span className="uploader-hint">
          {file ? file.name : "o arrastra la imagen aquí"}
        </span>
      </label>

      {file && (
        <div className="uploader-preview">
          <span className="uploader-thumb" data-status={status}>
            {/* blob: local del archivo elegido — next/image no puede optimizarlo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previewUrl && <img src={previewUrl} alt="" />}
          </span>

          <span className="uploader-meta">
            <span className="uploader-name">{file.name}</span>

            {status === "uploading" && (
              <span className="uploader-state" data-tone="uploading">
                <Spinner size={12} />
                Subiendo
              </span>
            )}

            {status === "uploaded" && (
              <span className="uploader-state" data-tone="uploaded">
                <CheckIcon size={13} tone="var(--pos)" />
                Subida
              </span>
            )}

            {status === "error" && (
              <span className="uploader-state" data-tone="error">
                <AlertIcon size={13} />
                {uploadState?.error || "No se pudo subir."}
              </span>
            )}

            {status === "uploaded" && uploadState?.url && (
              <a
                href={uploadState.url}
                target="_blank"
                rel="noopener noreferrer"
                className="uploader-link"
              >
                Ver imagen
              </a>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/** Miniatura local del archivo elegido. No toca la subida. */
function useObjectUrl(file?: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!url) return;

    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="spinner"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({
  size = 14,
  tone = "currentColor",
}: {
  size?: number;
  tone?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="check-path"
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke={tone}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 5.5v3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.2" r="0.9" fill="currentColor" />
      <circle
        cx="8"
        cy="8"
        r="6.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.55"
      />
    </svg>
  );
}

function InfoIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 7.4v3.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="8" cy="4.9" r="0.9" fill="currentColor" />
      <circle
        cx="8"
        cy="8"
        r="6.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.5"
      />
    </svg>
  );
}
