"use client";

import { useRef, useState, useEffect } from "react";

const SketchCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [drawing, setDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  const canvasBgColor = "#ffffff";

 
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    setDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
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
  };

  return (
    <div className="flex flex-col items-center mt-10">
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="border border-gray-500"
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
      />

      <div className="mt-4 flex gap-3">

        <button
          onClick={() => setTool("pen")}
          className={`px-3 py-1 rounded ${tool === "pen" ? "bg-black text-white" : "bg-gray-200"}`}
        >
          Pen
        </button>

        <button
          onClick={() => setTool("eraser")}
          className={`px-3 py-1 rounded ${tool === "eraser" ? "bg-black text-white" : "bg-gray-200"}`}
        >
          Eraser
        </button>

        <button
          onClick={clearCanvas}
          className="px-3 py-1 bg-red-500 text-white rounded"
        >
          Clear
        </button>

      </div>

      <div className="mt-4 flex gap-4 items-center">
        <label className="flex gap-2 items-center">
          Color:
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
            disabled={tool === "eraser"}
          />
        </label>

        <label className="flex gap-2 items-center">
          Size:
          <input
            type="range"
            min={1}
            max={20}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
          {brushSize}px
        </label>
      </div>
    </div>
  );
};

export default SketchCanvas;