"use client";

import SketchCanvas from "../components/SketchCanvas";
import { useRouter } from "next/navigation";

export default function CanvasPage() {
  const router = useRouter();

  return (
    <SketchCanvas onBack={() => router.push("/")} />
  );
}
