"use client";

import { useRef, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface SketchCanvasProps {
  onBack?: () => void;
}

const SketchCanvas = ({ onBack }: SketchCanvasProps) => {
  const { data: session } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const [drawing, setDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  // Undo/Redo functionality
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Prompt and style
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("photorealistic");

  // Loading and error states
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasBgColor = "#ffffff";

  // Save canvas state to history
  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataURL);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  // Undo action
  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      restoreFromHistory(historyStep - 1);
    }
  };

  // Redo action
  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      restoreFromHistory(historyStep + 1);
    }
  };

  // Restore canvas from history
  const restoreFromHistory = (step: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = history[step];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save initial state
    const dataURL = canvas.toDataURL();
    setHistory([dataURL]);
    setHistoryStep(0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === "pen" ? brushColor : canvasBgColor;
  }, [brushColor, brushSize, tool]);

  const startDrawing = (e: React.MouseEvent) => {
    setDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (drawing) {
      setDrawing(false);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      
      // Save to history after drawing completes
      saveToHistory();
    }
  };

  const draw = (e: React.MouseEvent) => {
    if (!drawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    
    // Save to history after clearing
    saveToHistory();
  };

  // ========= Export PNG =========
  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = dataURL;
    link.click();
  };

  // ========= Upload Image =========
  const importImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear canvas first
      ctx.fillStyle = canvasBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw uploaded image scaled to canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      setCanvasReady(true);
      saveToHistory(); // Save to history after import
    };

    img.src = URL.createObjectURL(file);
  };

  // ... (keep the rest of your imports and states)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const saveGenerationToBackend = async (
  sketchB64: string,
  outputB64: string,
  prompt: string | null,
  style: string,
  inferenceMs: number,
  accessToken: string | undefined
) => {
  if (!accessToken) {
    console.warn("No access token - skipping save to gallery");
    return;
  }
  try {
    console.log("Saving generation to backend...");
    const res = await fetch(`${API_BASE}/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        sketch_b64: sketchB64,
        output_b64: outputB64,
        prompt: prompt || null,
        style: style,
        inference_ms: inferenceMs,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log("✓ Generation saved to gallery", data.generation_id);
    } else {
      console.error("Failed to save generation:", data);
    }
  } catch (error) {
    console.error("Failed to save generation:", error);
  }
};

const pollJob = async (jobId: string, onProgress?: (state: string) => void) => {
  const start = Date.now();
  const timeoutMs = 120000; // 2 minutes
  const intervalMs = 1500;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE}/status/${jobId}`);
      const data = await res.json();
      if (onProgress) onProgress(data.state);
      if (data.state === "SUCCESS" && data.success && data.output) {
        return data.output as string;
      }
      if (data.state === "FAILURE") {
        throw new Error(data.error || "Job failed");
      }
    } catch (err) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timeout waiting for job result");
};

const sendToBackend = async () => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  setIsGenerating(true);
  setError(null);

  const base64 = canvas.toDataURL("image/png");

  if (!base64 || base64.length < 100) {
    setError("Canvas is empty. Please draw or upload an image first.");
    setIsGenerating(false);
    return;
  }

  const payload = { 
    image: base64,
    prompt: prompt || undefined,
    style: selectedStyle 
  };

  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.success) {
      if (data.queued && data.job_id) {
        // Poll for job status
        try {
          const output = await pollJob(data.job_id, (state) => {
            // optional: could set a spinner state text
          });
          setAiImage(output);
          setError(null);
          // Save to user history if logged in
          await saveGenerationToBackend(
            base64,
            output,
            prompt || null,
            selectedStyle,
            data.inference_ms || 0,
            (session as any)?.accessToken
          );
        } catch (pollErr: any) {
          setError(pollErr?.message || "Failed while polling job status");
        }
      } else if (data.output) {
        setAiImage(data.output);
        setError(null);
        // Save to user history if logged in
        await saveGenerationToBackend(
          base64,
          data.output,
          prompt || null,
          selectedStyle,
          data.inference_ms || 0,
          (session as any)?.accessToken
        );
      } else {
        setError("Unexpected response from backend");
      }
    } else {
      setError(data.error || "AI failed to generate image");
    }
  } catch (err) {
    setError("Failed to connect to backend. Is it running?");
    console.error("Network error:", err);
  } finally {
    setIsGenerating(false);
  }
};

const downloadAIImage = (base64: string) => {
  const link = document.createElement("a");
  link.href = base64;
  link.download = "ai_output.png";
  link.click();
};

  const styles = [
    { value: "photorealistic", label: "Photorealistic" },
    { value: "id-photo", label: "ID Photo" },
    { value: "anime", label: "Anime" },
    { value: "cinematic", label: "Cinematic" },
    { value: "artistic", label: "Artistic" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="w-full bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">FaceSketch AI</h1>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
            >
              ← Back to Home
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Canvas and Tools */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Drawing Canvas</h2>

            {/* Canvas */}
            <div className="flex justify-center mb-6">
              <canvas
                ref={canvasRef}
                width={512}
                height={512}
                className="border-2 border-gray-300 rounded-lg shadow-inner cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onMouseMove={draw}
              />
            </div>

            {/* Tool Controls */}
            <div className="space-y-4">
              {/* Tool Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tool
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTool("pen")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                      tool === "pen"
                        ? "bg-purple-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    ✏️ Pen
                  </button>
                  <button
                    onClick={() => setTool("eraser")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                      tool === "eraser"
                        ? "bg-purple-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    🧹 Eraser
                  </button>
                </div>
              </div>

              {/* Brush Controls */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brush Color
                  </label>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    disabled={tool === "eraser"}
                    className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brush Size: {brushSize}px
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-10 cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={undo}
                  disabled={historyStep <= 0}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ↶ Undo
                </button>
                <button
                  onClick={redo}
                  disabled={historyStep >= history.length - 1}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ↷ Redo
                </button>
                <button
                  onClick={clearCanvas}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  🗑️ Clear
                </button>
                <label className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition cursor-pointer text-center">
                  📤 Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={importImage}
                  />
                </label>
              </div>

              <button
                onClick={exportPNG}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                💾 Export Drawing
              </button>
            </div>
          </div>

          {/* Right Column - Prompt and Generation */}
          <div className="space-y-6">
            {/* Prompt Input */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">AI Generation</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt (Optional)
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., 'young woman with blue eyes and long hair'"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-700"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Style Preset
                  </label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-700"
                  >
                    {styles.map((style) => (
                      <option key={style.value} value={style.value}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={sendToBackend}
                  disabled={isGenerating}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    "✨ Generate Photorealistic Face"
                  )}
                </button>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm">
                      <span className="font-semibold">Error:</span> {error}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Image */}
            {aiImage && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Generated Result</h3>
                <img
                  src={aiImage}
                  alt="AI Generated"
                  className="w-full rounded-lg shadow-md mb-4"
                />
                <button
                  onClick={() => downloadAIImage(aiImage)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition"
                >
                  ⬇️ Download AI Image
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SketchCanvas;