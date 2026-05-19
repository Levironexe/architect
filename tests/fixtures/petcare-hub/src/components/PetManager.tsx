"use client";

// BAD: PetManager is a 700+ line god component doing EVERYTHING
// BAD: Should be split into PetCard, PetForm, AppointmentForm, HealthTimeline, MedicationList, etc.
// BAD: Props list is enormous — 15+ props
// BAD: duplicates API calls already made by dashboard/page.tsx
// BAD: business logic in UI component
// BAD: giant switch statement for "mode" instead of separate components
// BAD: duplicated form validation (4th occurrence in codebase)

import { useState, useEffect, useCallback } from "react";

// BAD: types defined inline instead of importing from types/index.ts
interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  color: string | null;
  gender: string | null;
  status: string;
  imageUrl: string | null;
  isNeutered: boolean;
  microchipId: string | null;
  notes: string | null;
  ownerId: string;
  createdAt: string;
  healthRecords?: any[];
  vaccinations?: any[];
  medications?: any[];
}

interface Appointment {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  petId: string;
  cost: number | null;
  vetName: string | null;
  clinicName: string | null;
  notes: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  category: string;
  stock: number;
}

// BAD: 15 props instead of proper composition
interface PetManagerProps {
  userId: string;
  mode: "list" | "detail" | "health" | "appointments" | "shop" | "form";
  selectedPetId?: string | null;
  onModeChange?: (mode: string, petId?: string) => void;
  onPetCreated?: (pet: Pet) => void;
  onPetUpdated?: (pet: Pet) => void;
  onPetDeleted?: (petId: string) => void;
  onAppointmentBooked?: (appointment: Appointment) => void;
  initialPets?: Pet[];
  showProductRecommendations?: boolean;
  maxPets?: number;
  isPremium?: boolean;
  compact?: boolean;
  className?: string;
  onError?: (error: string) => void;
}

// YAGNI: RenderStrategyFactory — complex factory pattern for rendering that's
// only ever used for one simple conditional
class RenderStrategyFactory {
  private static strategies: Record<string, (data: any) => string> = {
    compact: (data) => `${data.name} (${data.species})`,
    full: (data) => `${data.name} - ${data.breed || data.species} - ${data.age || "?"}y`,
    minimal: (data) => data.name,
  };

  static getStrategy(type: string): (data: any) => string {
    return this.strategies[type] || this.strategies.full;
  }
}

export default function PetManager({
  userId,
  mode,
  selectedPetId,
  onModeChange,
  onPetCreated,
  onPetUpdated,
  onPetDeleted,
  onAppointmentBooked,
  initialPets = [],
  showProductRecommendations = false,
  maxPets = 10,
  isPremium = false,
  compact = false,
  className = "",
  onError,
}: PetManagerProps) {
  // BAD: 20+ useState hooks — should use useReducer
  const [pets, setPets] = useState<Pet[]>(initialPets);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [petsLoading, setPetsLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirming, setDeleteConfirming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"health" | "vaccinations" | "medications" | "weight">("health");
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [sortField, setSortField] = useState<"name" | "species" | "age" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pet form state — BAD: should be a separate FormPet component
  const [petForm, setPetForm] = useState({
    name: "",
    species: "dog",
    breed: "",
    age: "",
    weight: "",
    color: "",
    gender: "unknown",
    imageUrl: "",
    microchipId: "",
    isNeutered: false,
    notes: "",
  });

  // Appointment form state — BAD: another inline form
  const [apptForm, setApptForm] = useState({
    title: "",
    type: "checkup",
    scheduledAt: "",
    vetName: "",
    clinicName: "",
    notes: "",
    cost: "",
  });

  // BAD: fetches all pets even if initialPets was provided
  useEffect(() => {
    fetchPets();
  }, [userId]);

  useEffect(() => {
    if (selectedPetId) {
      fetchPetDetail(selectedPetId);
    }
  }, [selectedPetId]);

  useEffect(() => {
    if (mode === "shop" && showProductRecommendations) {
      fetchRecommendedProducts();
    }
  }, [mode, showProductRecommendations]);

  // BAD: duplicated from dashboard/page.tsx (2nd occurrence)
  const fetchPets = async () => {
    setPetsLoading(true);
    try {
      const res = await fetch(`/api/pets?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch pets");
      const data = await res.json();
      setPets(data.pets || []);
    } catch (err: any) {
      setError(err.message);
      onError?.(err.message);
    } finally {
      setPetsLoading(false);
    }
  };

  const fetchPetDetail = async (petId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pets?id=${petId}`);
      if (!res.ok) throw new Error("Pet not found");
      const data = await res.json();
      setSelectedPet(data.pet);
      // BAD: also fetches appointments here (duplicated from dashboard)
      fetchPetAppointments(petId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPetAppointments = async (petId: string) => {
    setAppointmentsLoading(true);
    try {
      const res = await fetch(`/api/appointments?petId=${petId}`);
      if (!res.ok) throw new Error("Failed to fetch appointments");
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const fetchRecommendedProducts = async () => {
    if (!selectedPet) return;
    setProductsLoading(true);
    try {
      const res = await fetch(`/api/products?species=${selectedPet.species}&limit=6`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      // silently fail
    } finally {
      setProductsLoading(false);
    }
  };

  // BAD: validation duplicated (4th occurrence in codebase)
  const validatePetForm = () => {
    const errors: Record<string, string> = {};
    if (!petForm.name.trim()) errors.name = "Name is required";
    if (petForm.name.length > 50) errors.name = "Name too long";
    if (!petForm.species) errors.species = "Species is required";
    if (petForm.age && (isNaN(Number(petForm.age)) || Number(petForm.age) < 0 || Number(petForm.age) > 30)) {
      errors.age = "Age must be between 0 and 30";
    }
    if (petForm.weight && (isNaN(Number(petForm.weight)) || Number(petForm.weight) <= 0)) {
      errors.weight = "Weight must be positive";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePetForm()) return;
    if (pets.length >= maxPets && !isPremium) {
      setError(`Free plan limited to ${maxPets} pets. Upgrade to add more.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...petForm,
          age: petForm.age ? Number(petForm.age) : null,
          weight: petForm.weight ? Number(petForm.weight) : null,
          userId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create pet");
      }
      const data = await res.json();
      setPets((prev) => [data.pet, ...prev]);
      setSuccessMsg(`${data.pet.name} has been added!`);
      setShowForm(false);
      resetPetForm();
      onPetCreated?.(data.pet);
      // BAD: success message not cleared on unmount
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPet || !validatePetForm()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/pets?id=${editingPet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...petForm,
          age: petForm.age ? Number(petForm.age) : null,
          weight: petForm.weight ? Number(petForm.weight) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update pet");
      const data = await res.json();
      setPets((prev) => prev.map((p) => (p.id === editingPet.id ? data.pet : p)));
      if (selectedPet?.id === editingPet.id) setSelectedPet(data.pet);
      setSuccessMsg("Pet updated successfully");
      setEditingPet(null);
      setShowForm(false);
      onPetUpdated?.(data.pet);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePet = async (petId: string) => {
    // BAD: window.confirm again instead of modal
    if (!window.confirm("Are you sure you want to remove this pet?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/pets?id=${petId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete pet");
      setPets((prev) => prev.filter((p) => p.id !== petId));
      if (selectedPet?.id === petId) setSelectedPet(null);
      setSuccessMsg("Pet removed");
      onPetDeleted?.(petId);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setDeleteConfirming(null);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet) return;
    if (!apptForm.title.trim()) { setError("Appointment title is required"); return; }
    if (!apptForm.scheduledAt) { setError("Please select a date and time"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...apptForm,
          petId: selectedPet.id,
          userId,
          cost: apptForm.cost ? Number(apptForm.cost) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to book appointment");
      const data = await res.json();
      setAppointments((prev) => [data.appointment, ...prev]);
      setShowAppointmentForm(false);
      setApptForm({ title: "", type: "checkup", scheduledAt: "", vetName: "", clinicName: "", notes: "", cost: "" });
      setSuccessMsg("Appointment booked!");
      onAppointmentBooked?.(data.appointment);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPetForm = () => {
    setPetForm({ name: "", species: "dog", breed: "", age: "", weight: "", color: "", gender: "unknown", imageUrl: "", microchipId: "", isNeutered: false, notes: "" });
    setFormErrors({});
  };

  const startEdit = (pet: Pet) => {
    setEditingPet(pet);
    setPetForm({
      name: pet.name,
      species: pet.species,
      breed: pet.breed || "",
      age: pet.age?.toString() || "",
      weight: pet.weight?.toString() || "",
      color: pet.color || "",
      gender: pet.gender || "unknown",
      imageUrl: pet.imageUrl || "",
      microchipId: pet.microchipId || "",
      isNeutered: pet.isNeutered,
      notes: pet.notes || "",
    });
    setShowForm(true);
  };

  // BAD: client-side filtering after fetching ALL pets — should use API filters
  const filteredPets = pets
    .filter((p) => speciesFilter === "all" || p.species === speciesFilter)
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (aVal === null) aVal = "";
      if (bVal === null) bVal = "";
      if (sortDir === "asc") return aVal < bVal ? -1 : 1;
      return aVal > bVal ? -1 : 1;
    });

  const renderStrategy = RenderStrategyFactory.getStrategy(compact ? "compact" : "full");

  // BAD: giant switch statement for rendering different modes
  // Each case should be its own component
  const renderContent = () => {
    switch (mode) {
      case "list":
        return (
          <div className={`pet-manager-list ${className}`}>
            {/* Filter controls */}
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                placeholder="Search pets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm"
              />
              <select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
                <option value="all">All Species</option>
                <option value="dog">Dogs</option>
                <option value="cat">Cats</option>
                <option value="bird">Birds</option>
                <option value="rabbit">Rabbits</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
                <option value="all">All Status</option>
                <option value="healthy">Healthy</option>
                <option value="sick">Sick</option>
                <option value="checkup_needed">Checkup Needed</option>
              </select>
              <select value={`${sortField}-${sortDir}`} onChange={(e) => { const [f, d] = e.target.value.split("-"); setSortField(f as any); setSortDir(d as any); }} className="border rounded px-3 py-1.5 text-sm">
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="age-asc">Youngest First</option>
                <option value="age-desc">Oldest First</option>
                <option value="status-asc">Status</option>
              </select>
            </div>

            {/* Add pet button */}
            <button
              onClick={() => { resetPetForm(); setEditingPet(null); setShowForm(true); }}
              className="mb-4 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm"
            >
              + Add Pet
            </button>

            {petsLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent" />
              </div>
            ) : filteredPets.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                {pets.length === 0 ? "No pets yet. Add your first pet!" : "No pets match your filters."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPets.map((pet) => (
                  <div key={pet.id} className="bg-white rounded-xl shadow border hover:shadow-md transition-shadow">
                    <div className="p-4">
                      {pet.imageUrl ? (
                        // BAD: img instead of next/image
                        <img src={pet.imageUrl} alt={pet.name} className="w-full h-36 object-cover rounded-lg mb-3" />
                      ) : (
                        <div className="w-full h-36 bg-gradient-to-br from-teal-100 to-blue-100 rounded-lg mb-3 flex items-center justify-center text-4xl">
                          {pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾"}
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                          <p className="text-sm text-gray-500">{renderStrategy(pet)}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${pet.status === "healthy" ? "bg-green-100 text-green-700" : pet.status === "sick" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {pet.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="border-t px-4 py-2 flex gap-2">
                      <button onClick={() => { setSelectedPet(pet); onModeChange?.("detail", pet.id); }} className="flex-1 text-xs text-teal-600 hover:text-teal-800 py-1">View</button>
                      <button onClick={() => startEdit(pet)} className="flex-1 text-xs text-blue-600 hover:text-blue-800 py-1">Edit</button>
                      <button onClick={() => handleDeletePet(pet.id)} className="flex-1 text-xs text-red-600 hover:text-red-800 py-1">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "detail":
        if (!selectedPet && !loading) return <div className="text-center py-10 text-gray-500">Select a pet to view details</div>;
        if (loading) return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent" /></div>;
        return (
          <div className={`pet-detail ${className}`}>
            <button onClick={() => onModeChange?.("list")} className="mb-4 text-sm text-teal-600 hover:underline">← Back to pets</button>
            {selectedPet && (
              <div>
                <div className="flex gap-6 mb-6">
                  {selectedPet.imageUrl ? (
                    <img src={selectedPet.imageUrl} alt={selectedPet.name} className="w-32 h-32 rounded-full object-cover" />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-teal-100 flex items-center justify-center text-5xl">
                      {selectedPet.species === "dog" ? "🐕" : selectedPet.species === "cat" ? "🐈" : "🐾"}
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedPet.name}</h2>
                    <p className="text-gray-600">{selectedPet.breed || selectedPet.species} • {selectedPet.age ? `${selectedPet.age} years` : "Age unknown"}</p>
                    <p className="text-gray-600">{selectedPet.weight ? `${selectedPet.weight} kg` : ""} {selectedPet.gender !== "unknown" ? `• ${selectedPet.gender}` : ""}</p>
                    <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${selectedPet.status === "healthy" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {selectedPet.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Tabs — duplicated from dashboard */}
                <div className="flex border-b mb-4">
                  {(["health", "vaccinations", "medications", "weight"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab ? "border-teal-600 text-teal-600" : "border-transparent text-gray-500"}`}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {activeTab === "health" && (
                  <div>
                    {(selectedPet.healthRecords || []).length === 0 ? (
                      <p className="text-gray-500 text-sm">No health records yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {(selectedPet.healthRecords || []).map((record: any) => (
                          <div key={record.id} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between">
                              <span className="font-medium text-gray-900">{record.title}</span>
                              <span className="text-xs text-gray-500">{new Date(record.recordDate).toLocaleDateString()}</span>
                            </div>
                            {record.description && <p className="text-sm text-gray-600 mt-1">{record.description}</p>}
                            {record.vetName && <p className="text-xs text-gray-500 mt-1">Dr. {record.vetName}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "vaccinations" && (
                  <div className="space-y-3">
                    {(selectedPet.vaccinations || []).length === 0 ? (
                      <p className="text-gray-500 text-sm">No vaccination records.</p>
                    ) : (selectedPet.vaccinations || []).map((v: any) => (
                      <div key={v.id} className="bg-gray-50 rounded-lg p-4 flex justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{v.vaccineName}</p>
                          <p className="text-xs text-gray-500">Given: {new Date(v.dateGiven).toLocaleDateString()}</p>
                        </div>
                        {v.dueDate && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Due: {new Date(v.dueDate).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "medications" && (
                  <div className="space-y-3">
                    {(selectedPet.medications || []).filter((m: any) => m.isOngoing).length === 0 ? (
                      <p className="text-gray-500 text-sm">No active medications.</p>
                    ) : (selectedPet.medications || []).filter((m: any) => m.isOngoing).map((m: any) => (
                      <div key={m.id} className="bg-blue-50 rounded-lg p-4">
                        <p className="font-medium text-gray-900">{m.medicationName}</p>
                        <p className="text-sm text-gray-600">{m.dosage} • {m.frequency}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "weight" && (
                  <div>
                    {/* BAD: no chart — should use recharts */}
                    <p className="text-gray-500 text-sm">Current weight: {selectedPet.weight ? `${selectedPet.weight} kg` : "Not recorded"}</p>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button onClick={() => startEdit(selectedPet)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Edit Pet</button>
                  <button onClick={() => { setShowAppointmentForm(true); onModeChange?.("appointments"); }} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700">Book Appointment</button>
                  {showProductRecommendations && (
                    <button onClick={() => onModeChange?.("shop", selectedPet.id)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">Shop for {selectedPet.name}</button>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "appointments":
        return (
          <div className={`pet-appointments ${className}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Appointments</h3>
              <button onClick={() => setShowAppointmentForm(true)} className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-sm">+ Book</button>
            </div>
            {appointmentsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-600 border-t-transparent" /></div>
            ) : appointments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No appointments scheduled.</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div key={appt.id} className="bg-white rounded-lg border p-4">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{appt.title}</p>
                        <p className="text-sm text-gray-500">{new Date(appt.scheduledAt).toLocaleString()}</p>
                        {appt.vetName && <p className="text-xs text-gray-500">Dr. {appt.vetName} • {appt.clinicName}</p>}
                      </div>
                      <span className={`text-xs h-fit px-2 py-1 rounded-full ${appt.status === "confirmed" ? "bg-green-100 text-green-700" : appt.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}>
                        {appt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "shop":
        return (
          <div className={`pet-shop ${className}`}>
            <h3 className="font-semibold text-gray-900 mb-4">
              {selectedPet ? `Products for ${selectedPet.name}` : "Pet Shop"}
            </h3>
            {productsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-600 border-t-transparent" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="bg-white rounded-xl border hover:shadow-md transition-shadow p-4">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-28 object-contain mb-3" />
                    ) : (
                      <div className="w-full h-28 bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400">No image</div>
                    )}
                    <p className="font-medium text-sm text-gray-900 line-clamp-2">{product.name}</p>
                    <p className="text-teal-600 font-semibold mt-1">${product.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
                    <button className="w-full mt-3 bg-teal-600 text-white text-xs py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-50" disabled={product.stock === 0}>
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pet-manager">
      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex justify-between items-center">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Success banner */}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-600 text-sm">{successMsg}</p>
        </div>
      )}

      {renderContent()}

      {/* Pet form modal — BAD: inline modal instead of a Modal component */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">{editingPet ? "Edit Pet" : "Add New Pet"}</h2>
            <form onSubmit={editingPet ? handleUpdatePet : handleCreatePet} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={petForm.name} onChange={(e) => setPetForm((p) => ({ ...p, name: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${formErrors.name ? "border-red-500" : ""}`} placeholder="Pet name" />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Species *</label>
                  <select value={petForm.species} onChange={(e) => setPetForm((p) => ({ ...p, species: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="rabbit">Rabbit</option>
                    <option value="fish">Fish</option>
                    <option value="hamster">Hamster</option>
                    <option value="reptile">Reptile</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={petForm.gender} onChange={(e) => setPetForm((p) => ({ ...p, gender: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="unknown">Unknown</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Breed</label>
                <input value={petForm.breed} onChange={(e) => setPetForm((p) => ({ ...p, breed: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Golden Retriever" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age (years)</label>
                  <input type="number" value={petForm.age} onChange={(e) => setPetForm((p) => ({ ...p, age: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${formErrors.age ? "border-red-500" : ""}`} placeholder="0" min="0" max="30" />
                  {formErrors.age && <p className="text-red-500 text-xs mt-1">{formErrors.age}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                  <input type="number" value={petForm.weight} onChange={(e) => setPetForm((p) => ({ ...p, weight: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm ${formErrors.weight ? "border-red-500" : ""}`} placeholder="0.0" min="0" step="0.1" />
                  {formErrors.weight && <p className="text-red-500 text-xs mt-1">{formErrors.weight}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input value={petForm.imageUrl} onChange={(e) => setPetForm((p) => ({ ...p, imageUrl: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={petForm.notes} onChange={(e) => setPetForm((p) => ({ ...p, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Any additional notes..." />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={petForm.isNeutered} onChange={(e) => setPetForm((p) => ({ ...p, isNeutered: e.target.checked }))} />
                Neutered / Spayed
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
                  {loading ? "Saving..." : editingPet ? "Update Pet" : "Add Pet"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingPet(null); resetPetForm(); }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment form modal */}
      {showAppointmentForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Book Appointment</h2>
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={apptForm.title} onChange={(e) => setApptForm((p) => ({ ...p, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Annual Checkup" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={apptForm.type} onChange={(e) => setApptForm((p) => ({ ...p, type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="checkup">Checkup</option>
                  <option value="vaccination">Vaccination</option>
                  <option value="surgery">Surgery</option>
                  <option value="grooming">Grooming</option>
                  <option value="dental">Dental</option>
                  <option value="emergency">Emergency</option>
                  <option value="consultation">Consultation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                <input type="datetime-local" value={apptForm.scheduledAt} onChange={(e) => setApptForm((p) => ({ ...p, scheduledAt: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vet Name</label>
                  <input value={apptForm.vetName} onChange={(e) => setApptForm((p) => ({ ...p, vetName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Dr. Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clinic</label>
                  <input value={apptForm.clinicName} onChange={(e) => setApptForm((p) => ({ ...p, clinicName: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="City Vet Clinic" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost ($)</label>
                <input type="number" value={apptForm.cost} onChange={(e) => setApptForm((p) => ({ ...p, cost: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 bg-teal-600 text-white py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
                  {loading ? "Booking..." : "Book Appointment"}
                </button>
                <button type="button" onClick={() => setShowAppointmentForm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
