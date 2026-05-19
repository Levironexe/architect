"use client";

// BAD: Pets list page is a client component — loses SSR
// BAD: All filtering done client-side even though we have server
// BAD: Duplicates pet fetching from dashboard/page.tsx and PetManager.tsx

import { useState, useEffect } from "react";
import PetManager from "@/components/PetManager";

// BAD: getting userId from localStorage instead of session cookie
function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.id || null;
  } catch {
    return null;
  }
}

export default function PetsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "detail" | "health" | "appointments" | "shop" | "form">("list");
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  useEffect(() => {
    const id = getUserId();
    setUserId(id);
    if (!id) {
      // BAD: redirect handled in useEffect — flash of content before redirect
      window.location.href = "/login";
    }
  }, []);

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* BAD: copy-pasted navbar instead of using a shared component */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" className="font-bold text-xl text-teal-600">🐾 PetCare Hub</a>
          <div className="flex gap-4 text-sm">
            <a href="/dashboard" className="text-gray-600 hover:text-teal-600">Dashboard</a>
            <a href="/pets" className="text-teal-600 font-medium">My Pets</a>
            <a href="/shop" className="text-gray-600 hover:text-teal-600">Shop</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* BAD: breadcrumb implemented manually, 3rd time in codebase */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <a href="/dashboard" className="hover:text-teal-600">Dashboard</a>
          <span>/</span>
          <span className="text-gray-900">My Pets</span>
          {mode === "detail" && (
            <>
              <span>/</span>
              <span className="text-gray-900">Pet Details</span>
            </>
          )}
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Pets</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your furry family members</p>
        </div>

        <PetManager
          userId={userId}
          mode={mode}
          selectedPetId={selectedPetId}
          onModeChange={(newMode: string, petId?: string) => {
            setMode(newMode as any);
            if (petId) setSelectedPetId(petId);
          }}
          showProductRecommendations={true}
          isPremium={false}
          maxPets={5}
        />
      </div>
    </div>
  );
}
