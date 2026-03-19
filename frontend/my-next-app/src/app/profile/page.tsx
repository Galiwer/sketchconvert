"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [defaultStyle, setDefaultStyle] = useState("photorealistic");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
      });
      const data = await res.json();
      setFullName(data.full_name || "");
      setDefaultStyle(data.default_style || "photorealistic");
      setDefaultPrompt(data.default_prompt || "");
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          default_style: defaultStyle,
          default_prompt: defaultPrompt,
        }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
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
              Canvas
            </Link>
            <Link
              href="/gallery"
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Gallery
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Profile Settings</h1>
          <p className="text-gray-600 mb-6">
            Manage your account and default preferences
          </p>

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              Profile updated successfully!
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={session?.user?.email || ""}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Style
              </label>
              <select
                value={defaultStyle}
                onChange={(e) => setDefaultStyle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="photorealistic">Photorealistic</option>
                <option value="id-photo">ID Photo</option>
                <option value="anime">Anime</option>
                <option value="cinematic">Cinematic</option>
                <option value="artistic">Artistic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Prompt
              </label>
              <textarea
                value={defaultPrompt}
                onChange={(e) => setDefaultPrompt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Optional default prompt that will be used when generating"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition"
              >
                Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
