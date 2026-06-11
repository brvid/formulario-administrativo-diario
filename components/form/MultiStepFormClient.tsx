"use client";

import dynamic from "next/dynamic";

const MultiStepForm = dynamic(() => import("./MultiStepForm"), {
  ssr: false,
});

export default function MultiStepFormClient() {
  return <MultiStepForm />;
}