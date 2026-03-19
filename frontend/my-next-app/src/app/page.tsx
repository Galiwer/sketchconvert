"use client";

import { useState } from "react";
import LandingPage from "./components/LandingPage";
import SketchCanvas from "./components/SketchCanvas";

export default function Page() {
  const [showCanvas, setShowCanvas] = useState(false);

  return (
    <main className="min-h-screen">
      {showCanvas ? (
        <SketchCanvas onBack={() => setShowCanvas(false)} />
      ) : (
        <LandingPage onGetStarted={() => setShowCanvas(true)} />
      )}
    </main>
  );
}
