"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">FaceSketch AI</h1>
          <div className="flex gap-4">
            {session ? (
              <>
                <Link
                  href="/gallery"
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
                >
                  Gallery
                </Link>
                <Link
                  href="/profile"
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
                >
                  Profile
                </Link>
                <button
                  onClick={onGetStarted}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition"
                >
                  Create
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-6 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-4xl text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Turn your sketch into a{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              photorealistic face
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Draw freely, upload an image, or use AI prompts to generate stunning photorealistic portraits in seconds
          </p>

          <button
            onClick={onGetStarted}
            className="px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            Get Started
          </button>
        </div>

        {/* Features Section */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl">
          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Draw</h3>
            <p className="text-gray-600">
              Sketch freely with our advanced drawing tools including brush size, colors, and eraser
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Upload</h3>
            <p className="text-gray-600">
              Import existing sketches or reference images to enhance or transform
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Prompt</h3>
            <p className="text-gray-600">
              Add text prompts to guide AI generation for more specific results
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
            <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-pink-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Styles</h3>
            <p className="text-gray-600">
              Choose from preset styles like ID Photo, Anime, or Cinematic for different looks
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-gray-500 text-sm">
        © 2026 FaceSketch AI. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;
