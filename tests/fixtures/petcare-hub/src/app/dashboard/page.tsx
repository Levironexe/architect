"use client";

// BAD: entire dashboard is one giant client component — no RSC, no streaming, no Suspense
// BAD: all CRUD operations mixed into a single 600+ line file
// BAD: business logic, API calls, and UI rendering all in one place
// BAD: duplicates types from types/index.ts

import { useState, useEffect } from "react";
import axios from "axios";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import _ from "lodash";
import Link from "next/link";

// BAD: re-defining types that exist in types/index.ts
type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
  imageUrl: string;
  status: string; // should be union type or enum
  ownerId: string;
  createdAt: string;
  appointments?: any[];
  healthRecords?: any[];
};

type Appointment = {
  id: string;
  petId: string;
  petName?: string;
  type: string;
  status: string;
  scheduledAt: string;
  vetName: string;
  notes: string;
  cost: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
};

type DashboardStats = {
  totalPets: number;
  upcomingAppointments: number;
  medicationsDue: number;
  unreadNotifications: number;
  totalSpentThisMonth: number;
  activeMedications: number;
};

// BAD: config object defined inside the component file instead of constants/config
const PET_SPECIES = ["dog", "cat", "bird", "rabbit", "fish", "hamster", "reptile", "other"];
const PET_STATUS_COLORS: Record<string, string> = {
  healthy: "text-green-600 bg-green-50",
  sick: "text-red-600 bg-red-50",
  recovering: "text-yellow-600 bg-yellow-50",
  checkup_needed: "text-blue-600 bg-blue-50",
};

// YAGNI: CacheManager built with full TTL support but used only for one cache key
class DashboardCacheManager {
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttl || this.defaultTTL),
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

// Only used once — complete overkill
const dashboardCache = new DashboardCacheManager();

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
export default function DashboardPage() {
  // Way too many useState hooks — should use useReducer or a state manager
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "pets" | "appointments" | "shop" | "records">("overview");
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("all");
  const [sortField, setSortField] = useState<"name" | "age" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // New pet form state — should be a separate component with react-hook-form
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("dog");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetAge, setNewPetAge] = useState("");
  const [newPetWeight, setNewPetWeight] = useState("");
  const [newPetNotes, setNewPetNotes] = useState("");
  const [newPetImageFile, setNewPetImageFile] = useState<File | null>(null);

  // New appointment form state — same problem
  const [apptPetId, setApptPetId] = useState("");
  const [apptType, setApptType] = useState("checkup");
  const [apptVetName, setApptVetName] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [apptCost, setApptCost] = useState("");

  // Fetch everything at once — N+1 waiting to happen, no parallel fetching
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // BAD: sequential awaits instead of Promise.all
        const petsRes = await axios.get("/api/pets");
        setPets(petsRes.data.pets || []);

        const apptRes = await axios.get("/api/appointments?upcoming=true&limit=5");
        setAppointments(apptRes.data.appointments || []);

        const productsRes = await axios.get("/api/products?featured=true&limit=8");
        setProducts(productsRes.data.products || []);

        // BAD: deriving stats client-side instead of getting from a /api/dashboard/stats endpoint
        const allPets = petsRes.data.pets || [];
        const allAppts = apptRes.data.appointments || [];
        setStats({
          totalPets: allPets.length,
          upcomingAppointments: allAppts.filter((a: Appointment) => a.status === "confirmed" || a.status === "pending").length,
          medicationsDue: 0, // TODO: actually fetch this
          unreadNotifications: 0, // TODO: actually fetch this
          totalSpentThisMonth: _.sumBy(allAppts, (a: Appointment) => a.cost || 0),
          activeMedications: 0, // TODO: actually fetch this
        });
      } catch (err: any) {
        setError("Failed to load dashboard: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Auto-clear success message — timeout not cleaned up on unmount (memory leak)
  useEffect(() => {
    if (successMessage) {
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  }, [successMessage]);

  // BAD: inline validation duplicated from server-side and utils.ts
  const validatePetForm = () => {
    if (!newPetName.trim()) return "Pet name is required";
    if (newPetName.length < 2) return "Pet name must be at least 2 characters";
    if (newPetName.length > 50) return "Pet name too long";
    if (!newPetSpecies) return "Species is required";
    if (newPetAge && (isNaN(Number(newPetAge)) || Number(newPetAge) < 0 || Number(newPetAge) > 30)) {
      return "Age must be between 0 and 30";
    }
    if (newPetWeight && (isNaN(Number(newPetWeight)) || Number(newPetWeight) <= 0)) {
      return "Weight must be a positive number";
    }
    return null;
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePetForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl = "";

      // BAD: image upload logic inline in form handler
      if (newPetImageFile) {
        const formData = new FormData();
        formData.append("file", newPetImageFile);
        formData.append("folder", "pets");
        // BAD: upload endpoint not defined anywhere yet
        const uploadRes = await axios.post("/api/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        imageUrl = uploadRes.data.url;
      }

      const petData = {
        id: uuidv4(), // BAD: generating ID client-side
        name: newPetName.trim(),
        species: newPetSpecies,
        breed: newPetBreed.trim() || undefined,
        age: newPetAge ? Number(newPetAge) : undefined,
        weight: newPetWeight ? Number(newPetWeight) : undefined,
        notes: newPetNotes.trim() || undefined,
        imageUrl: imageUrl || undefined,
        status: "healthy",
      };

      const res = await axios.post("/api/pets", petData);
      setPets((prev) => [res.data.pet, ...prev]);

      // Reset form — manually resetting each field instead of using form.reset()
      setNewPetName("");
      setNewPetSpecies("dog");
      setNewPetBreed("");
      setNewPetAge("");
      setNewPetWeight("");
      setNewPetNotes("");
      setNewPetImageFile(null);
      setShowAddPetModal(false);
      setSuccessMessage(`${petData.name} has been added!`);
      dashboardCache.invalidate("pets");
    } catch (err: any) {
      setError("Failed to add pet: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePet = async (petId: string, updates: Partial<Pet>) => {
    try {
      const res = await axios.put(`/api/pets/${petId}`, updates);
      setPets((prev) => prev.map((p) => (p.id === petId ? { ...p, ...res.data.pet } : p)));
      setEditingPet(null);
      setSuccessMessage("Pet updated successfully!");
    } catch (err: any) {
      setError("Update failed: " + err.message);
    }
  };

  const handleDeletePet = async (petId: string) => {
    // BAD: using window.confirm instead of a proper modal
    if (!window.confirm("Are you sure you want to delete this pet? This action cannot be undone.")) {
      return;
    }

    setDeletingPetId(petId);
    try {
      await axios.delete(`/api/pets/${petId}`);
      setPets((prev) => prev.filter((p) => p.id !== petId));
      setSuccessMessage("Pet deleted.");
      if (selectedPet?.id === petId) setSelectedPet(null);
    } catch (err: any) {
      setError("Delete failed: " + err.message);
    } finally {
      setDeletingPetId(null);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    // BAD: duplicated validation logic
    if (!apptPetId) { setError("Please select a pet"); return; }
    if (!apptVetName.trim()) { setError("Vet name is required"); return; }
    if (!apptDate) { setError("Date is required"); return; }
    if (!apptTime) { setError("Time is required"); return; }

    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${apptDate}T${apptTime}`).toISOString();
      const res = await axios.post("/api/appointments", {
        petId: apptPetId,
        type: apptType,
        vetName: apptVetName.trim(),
        scheduledAt,
        notes: apptNotes.trim() || undefined,
        cost: apptCost ? Number(apptCost) : undefined,
      });
      setAppointments((prev) => [res.data.appointment, ...prev]);
      setApptPetId("");
      setApptType("checkup");
      setApptVetName("");
      setApptDate("");
      setApptTime("");
      setApptNotes("");
      setApptCost("");
      setShowAddAppointmentModal(false);
      setSuccessMessage("Appointment booked!");
    } catch (err: any) {
      setError("Booking failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = async (apptId: string) => {
    if (!window.confirm("Cancel this appointment?")) return;
    try {
      await axios.patch(`/api/appointments/${apptId}`, { status: "cancelled" });
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: "cancelled" } : a))
      );
      setSuccessMessage("Appointment cancelled.");
    } catch (err: any) {
      setError("Cancellation failed: " + err.message);
    }
  };

  // BAD: filtering done client-side with no memoization
  const filteredPets = pets
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.breed?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecies = filterSpecies === "all" || p.species === filterSpecies;
      return matchesSearch && matchesSpecies;
    })
    .sort((a, b) => {
      const aVal = a[sortField] as any;
      const bVal = b[sortField] as any;
      // BAD: using moment for simple date comparison
      if (sortField === "createdAt") {
        return sortDir === "asc"
          ? moment(aVal).valueOf() - moment(bVal).valueOf()
          : moment(bVal).valueOf() - moment(aVal).valueOf();
      }
      return sortDir === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard header — should be a component */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-black text-gray-900">PetCare<span className="text-purple-600">Hub</span></span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600 text-sm font-medium">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              🔔
              {stats && stats.unreadNotifications > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {stats.unreadNotifications}
                </span>
              )}
            </button>
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-sm">
              U {/* BAD: hardcoded user initial */}
            </div>
          </div>
        </div>

        {/* Tab navigation — hardcoded, should be data-driven */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {(["overview", "pets", "appointments", "shop", "records"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-purple-600 text-purple-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "overview" && "📊 "}
                {tab === "pets" && "🐾 "}
                {tab === "appointments" && "📅 "}
                {tab === "shop" && "🛒 "}
                {tab === "records" && "📋 "}
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Global messages — inline instead of toast library */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center justify-between">
            <span>✅ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}

        {/* ============ OVERVIEW TAB ============ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stats && [
                { label: "My Pets", value: stats.totalPets, icon: "🐾", color: "purple" },
                { label: "Upcoming Appts", value: stats.upcomingAppointments, icon: "📅", color: "blue" },
                { label: "Meds Due", value: stats.medicationsDue, icon: "💊", color: "red" },
                { label: "Notifications", value: stats.unreadNotifications, icon: "🔔", color: "yellow" },
                { label: "Spent This Month", value: `$${stats.totalSpentThisMonth.toFixed(0)}`, icon: "💳", color: "green" },
                { label: "Active Meds", value: stats.activeMedications, icon: "🏥", color: "indigo" },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <div className="text-xl font-black text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recent pets + upcoming appointments side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recent pets */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">My Pets</h2>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                  >
                    + Add Pet
                  </button>
                </div>
                {pets.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-4xl mb-3">🐾</div>
                    <p className="text-sm">No pets yet. Add your first pet!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {pets.slice(0, 4).map((pet) => (
                      <div key={pet.id} className="p-4 flex items-center gap-3 hover:bg-gray-50">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg flex-shrink-0">
                          {pet.imageUrl ? (
                            <img src={pet.imageUrl} alt={pet.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900">{pet.name}</p>
                          <p className="text-xs text-gray-500">{pet.breed || pet.species} • {pet.age ? `${pet.age}y` : "Age unknown"}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PET_STATUS_COLORS[pet.status] || "text-gray-600 bg-gray-100"}`}>
                          {pet.status}
                        </span>
                        <button
                          onClick={() => { setEditingPet(pet); setActiveTab("pets"); }}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          ✎
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {pets.length > 4 && (
                  <div className="p-3 border-t border-gray-100 text-center">
                    <button onClick={() => setActiveTab("pets")} className="text-xs text-purple-600 font-medium hover:underline">
                      View all {pets.length} pets →
                    </button>
                  </div>
                )}
              </div>

              {/* Upcoming appointments */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Upcoming Appointments</h2>
                  <button
                    onClick={() => setShowAddAppointmentModal(true)}
                    className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                  >
                    + Book
                  </button>
                </div>
                {appointments.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-4xl mb-3">📅</div>
                    <p className="text-sm">No upcoming appointments.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {appointments.slice(0, 4).map((appt) => (
                      <div key={appt.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm text-gray-900 capitalize">{appt.type} — {appt.petName || "Unknown Pet"}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {/* BAD: using moment for display, should use date-fns or Intl */}
                              {moment(appt.scheduledAt).format("MMM D, YYYY [at] h:mm A")} • {appt.vetName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              appt.status === "confirmed" ? "bg-green-50 text-green-700" :
                              appt.status === "pending" ? "bg-yellow-50 text-yellow-700" :
                              appt.status === "cancelled" ? "bg-red-50 text-red-700 line-through" :
                              "bg-gray-50 text-gray-600"
                            }`}>
                              {appt.status}
                            </span>
                            {appt.status !== "cancelled" && (
                              <button
                                onClick={() => handleCancelAppointment(appt.id)}
                                className="text-xs text-red-400 hover:text-red-600"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                        {appt.notes && <p className="text-xs text-gray-400 mt-1 italic">{appt.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ PETS TAB ============ */}
        {activeTab === "pets" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 flex flex-wrap gap-3 items-center">
              <input
                type="search"
                placeholder="Search pets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[180px] px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
              />
              <select
                value={filterSpecies}
                onChange={(e) => setFilterSpecies(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
              >
                <option value="all">All Species</option>
                {PET_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={`${sortField}-${sortDir}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split("-");
                  setSortField(field as any);
                  setSortDir(dir as any);
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="age-asc">Youngest First</option>
                <option value="age-desc">Oldest First</option>
              </select>
              <button
                onClick={() => setShowAddPetModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                + Add New Pet
              </button>
            </div>

            {/* Pet grid */}
            {filteredPets.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
                <div className="text-6xl mb-4">🐾</div>
                <p className="text-gray-500 font-medium">No pets found</p>
                <button onClick={() => setShowAddPetModal(true)} className="mt-4 text-purple-600 text-sm font-medium hover:underline">
                  Add your first pet →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPets.map((pet) => (
                  <div
                    key={pet.id}
                    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all ${
                      selectedPet?.id === pet.id ? "ring-2 ring-purple-500" : ""
                    }`}
                    onClick={() => setSelectedPet(pet)}
                  >
                    <div className="h-36 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-6xl relative">
                      {pet.imageUrl ? (
                        <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾"}</span>
                      )}
                      <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${PET_STATUS_COLORS[pet.status] || "bg-gray-100 text-gray-600"}`}>
                        {pet.status}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900">{pet.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{pet.breed || pet.species} • {pet.age ? `${pet.age} years old` : "Age unknown"}</p>
                      {pet.weight && <p className="text-xs text-gray-400 mt-0.5">{pet.weight} kg</p>}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingPet(pet); setShowAddPetModal(true); }}
                          className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePet(pet.id); }}
                          disabled={deletingPetId === pet.id}
                          className="flex-1 py-1.5 text-xs border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingPetId === pet.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ SHOP TAB ============ */}
        {activeTab === "shop" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <div className="text-5xl mb-4">🛒</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pet Shop</h2>
              <p className="text-gray-500 text-sm mb-6">Premium pet food, accessories, and health products delivered to your door.</p>
              {products.length === 0 ? (
                <p className="text-gray-400 text-sm">No products available right now. Check back soon!</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left mt-6">
                  {products.map((product) => (
                    <div key={product.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all">
                      <div className="h-28 bg-gray-50 flex items-center justify-center text-4xl">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : "📦"}
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-sm text-gray-900 line-clamp-1">{product.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{product.category}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-black text-purple-700">${product.price}</span>
                          <button className="text-xs px-2 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ RECORDS TAB ============ */}
        {activeTab === "records" && (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Health Records</h2>
            <p className="text-gray-500 text-sm">
              {/* TODO: implement health records view */}
              Health records viewer coming soon. Select a pet to view their complete medical history.
            </p>
            {pets.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {pets.map((pet) => (
                  <Link
                    key={pet.id}
                    href={`/pets/${pet.id}`}
                    className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors"
                  >
                    {pet.name}'s Records
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================
          ADD/EDIT PET MODAL — should be a separate component
          ====================================================== */}
      {showAddPetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowAddPetModal(false); setEditingPet(null); } }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black text-gray-900">
                {editingPet ? `Edit ${editingPet.name}` : "Add New Pet"}
              </h2>
              <button onClick={() => { setShowAddPetModal(false); setEditingPet(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* BAD: form with manual state instead of react-hook-form */}
            <form onSubmit={editingPet ? (e) => { e.preventDefault(); handleUpdatePet(editingPet.id, { name: newPetName, species: newPetSpecies, breed: newPetBreed, age: Number(newPetAge), weight: Number(newPetWeight) }); } : handleAddPet} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Pet Name *</label>
                <input
                  type="text"
                  value={newPetName || editingPet?.name || ""}
                  onChange={(e) => setNewPetName(e.target.value)}
                  placeholder="e.g. Buddy"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Species *</label>
                  <select
                    value={newPetSpecies}
                    onChange={(e) => setNewPetSpecies(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                  >
                    {PET_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Breed</label>
                  <input
                    type="text"
                    value={newPetBreed}
                    onChange={(e) => setNewPetBreed(e.target.value)}
                    placeholder="e.g. Golden Retriever"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Age (years)</label>
                  <input
                    type="number"
                    value={newPetAge}
                    onChange={(e) => setNewPetAge(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="30"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Weight (kg)</label>
                  <input
                    type="number"
                    value={newPetWeight}
                    onChange={(e) => setNewPetWeight(e.target.value)}
                    placeholder="0.0"
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <textarea
                  value={newPetNotes}
                  onChange={(e) => setNewPetNotes(e.target.value)}
                  rows={3}
                  placeholder="Any special notes about your pet..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewPetImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddPetModal(false); setEditingPet(null); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingPet ? "Save Changes" : "Add Pet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          BOOK APPOINTMENT MODAL — also should be its own component
          ====================================================== */}
      {showAddAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddAppointmentModal(false); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-black text-gray-900">Book Appointment</h2>
              <button onClick={() => setShowAddAppointmentModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Pet *</label>
                <select value={apptPetId} onChange={(e) => setApptPetId(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none">
                  <option value="">Select a pet</option>
                  {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Type</label>
                  <select value={apptType} onChange={(e) => setApptType(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none">
                    {["checkup", "vaccination", "grooming", "surgery", "dental", "emergency", "training"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Vet Name *</label>
                  <input type="text" value={apptVetName} onChange={(e) => setApptVetName(e.target.value)} placeholder="Dr. Smith" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Date *</label>
                  <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Time *</label>
                  <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Estimated Cost ($)</label>
                <input type="number" value={apptCost} onChange={(e) => setApptCost(e.target.value)} placeholder="0.00" min="0" step="0.01" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <textarea value={apptNotes} onChange={(e) => setApptNotes(e.target.value)} rows={2} placeholder="Any additional notes..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none resize-none" />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddAppointmentModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                  {isSubmitting ? "Booking..." : "Book Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
