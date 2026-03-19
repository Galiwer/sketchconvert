"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface Generation {
  id: number;
  sketch_b64: string;
  output_b64: string;
  prompt: string | null;
  style: string | null;
  inference_ms: number | null;
  created_at: string;
}

export default function GalleryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      fetchGenerations();
    }
  }, [status, session, router]);

  const fetchGenerations = async () => {
    try {
      const res = await fetch(`${API_BASE}/generations`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setGenerations(data.generations);
      }
    } catch (error) {
      console.error("Failed to fetch generations:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteGeneration = async (id: number) => {
    if (!confirm("Delete this generation?")) return;
    try {
      await fetch(`${API_BASE}/generations/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      setGenerations((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="w-full bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-gray-800">
            FaceSketch AI
          </Link>
          <div className="flex gap-4">
            <Link
              href="/canvas"
              className="px-4 py-2 text-purple-600 hover:text-purple-700 font-medium"
            >
              New Generation
            </Link>
            <Link
              href="/profile"
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Profile
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Your Gallery</h1>
        <p className="text-gray-600 mb-8">
          {generations.length} generation{generations.length !== 1 ? "s" : ""}
        </p>

        {generations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No generations yet</p>
            <Link
              href="/canvas"
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition"
            >
              Create Your First Generation
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generations.map((gen) => (
              <div
                key={gen.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition"
              >
                <div className="grid grid-cols-2 gap-2 p-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Sketch</p>
                    <img
                      src={gen.sketch_b64}
                      alt="Sketch"
                      className="w-full rounded border border-gray-200"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Generated</p>
                    <img
                      src={gen.output_b64}
                      alt="Generated"
                      className="w-full rounded border border-gray-200"
                    />
                  </div>
                </div>

                <div className="px-4 pb-4">
                  {gen.prompt && (
                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                      <span className="font-medium">Prompt:</span> {gen.prompt}
                    </p>
                  )}
                  {gen.style && (
                    <p className="text-xs text-gray-500 mb-2">
                      Style: {gen.style}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mb-3">
                    {new Date(gen.created_at).toLocaleDateString()}
                    {gen.inference_ms && ` • ${(gen.inference_ms / 1000).toFixed(1)}s`}
                  </p>

                  <div className="flex gap-2">
                    <a
                      href={gen.output_b64}
                      download={`generation-${gen.id}.png`}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition text-center"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => deleteGeneration(gen.id)}
                      className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
