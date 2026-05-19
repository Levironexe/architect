// BAD: pet detail page as server component that can't access auth (no middleware)
// BAD: fetches data directly in the server component without proper caching
// BAD: duplicates include logic from server/index.ts and api/pets/route.ts
// BAD: no loading state/suspense boundary

import { notFound } from "next/navigation";
import { PrismaClient } from "@prisma/client";

// BAD: 5th PrismaClient instantiation in the codebase
const prisma = new PrismaClient();

// BAD: inline type instead of importing from types/index.ts
interface PageProps {
  params: { id: string };
}

// BAD: no authentication — any user can view any pet by guessing the ID
async function getPet(id: string) {
  const pet = await prisma.pet.findUnique({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true, avatar: true } },
      healthRecords: { orderBy: { recordDate: "desc" }, take: 5 },
      vaccinations: { orderBy: { dateGiven: "desc" } },
      medications: { where: { isOngoing: true } },
      weightLogs: { orderBy: { loggedAt: "desc" }, take: 10 },
      appointments: {
        where: { scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        take: 3,
      },
    },
  });
  return pet;
}

export default async function PetDetailPage({ params }: PageProps) {
  const pet = await getPet(params.id);
  if (!pet) notFound();

  const nextAppointment = (pet as any).appointments[0] || null;
  const latestWeight = (pet as any).weightLogs[0] || null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* BAD: 3rd copy of navbar, slightly different from the other two */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" className="font-bold text-xl text-teal-600">🐾 PetCare Hub</a>
          <div className="flex gap-6 text-sm">
            <a href="/dashboard" className="text-gray-600 hover:text-teal-600">Dashboard</a>
            <a href="/pets" className="text-gray-600 hover:text-teal-600">My Pets</a>
            <a href="/shop" className="text-gray-600 hover:text-teal-600">Shop</a>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb — 4th manual implementation */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <a href="/dashboard" className="hover:text-teal-600">Dashboard</a>
          <span>/</span>
          <a href="/pets" className="hover:text-teal-600">My Pets</a>
          <span>/</span>
          <span className="text-gray-900">{pet.name}</span>
        </div>

        {/* Pet profile header */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex gap-6 items-start">
            {pet.imageUrl ? (
              // BAD: img instead of next/image (3rd occurrence)
              <img src={pet.imageUrl} alt={pet.name} className="w-32 h-32 rounded-2xl object-cover" />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-teal-100 to-blue-100 flex items-center justify-center text-6xl">
                {pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : pet.species === "bird" ? "🐦" : "🐾"}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{pet.name}</h1>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                  pet.status === "healthy" ? "bg-green-100 text-green-700" :
                  pet.status === "sick" ? "bg-red-100 text-red-700" :
                  pet.status === "recovering" ? "bg-blue-100 text-blue-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {pet.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-gray-600 mb-1">
                {pet.breed || pet.species.charAt(0).toUpperCase() + pet.species.slice(1)}
                {pet.age ? ` • ${pet.age} year${pet.age !== 1 ? "s" : ""} old` : ""}
                {pet.gender && pet.gender !== "unknown" ? ` • ${pet.gender}` : ""}
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                {pet.weight && <span>⚖️ {pet.weight} kg</span>}
                {pet.color && <span>🎨 {pet.color}</span>}
                {pet.isNeutered && <span>✂️ Neutered</span>}
                {pet.microchipId && <span>📡 Chip: {pet.microchipId}</span>}
              </div>
              {(pet as any).owner && (
                <p className="text-sm text-gray-400 mt-2">Owner: {(pet as any).owner.name}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <a href={`/pets/${pet.id}/edit`} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 text-center">Edit</a>
              <a href={`/pets/${pet.id}/book`} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 text-center">Book Appt</a>
            </div>
          </div>

          {pet.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">{pet.notes}</p>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{(pet as any).healthRecords.length}</p>
            <p className="text-sm text-gray-500 mt-1">Health Records</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{(pet as any).vaccinations.length}</p>
            <p className="text-sm text-gray-500 mt-1">Vaccinations</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{(pet as any).medications.length}</p>
            <p className="text-sm text-gray-500 mt-1">Active Meds</p>
          </div>
        </div>

        {/* Upcoming appointment */}
        {nextAppointment && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-teal-800 mb-1">Next Appointment</h3>
            <p className="text-teal-700">{nextAppointment.title}</p>
            <p className="text-sm text-teal-600">
              {new Date(nextAppointment.scheduledAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {nextAppointment.vetName ? ` • Dr. ${nextAppointment.vetName}` : ""}
            </p>
          </div>
        )}

        {/* Recent health records */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Health Records</h2>
            <a href={`/pets/${pet.id}/health`} className="text-sm text-teal-600 hover:underline">View all</a>
          </div>
          {(pet as any).healthRecords.length === 0 ? (
            <p className="text-gray-500 text-sm">No health records yet.</p>
          ) : (
            <div className="space-y-3">
              {(pet as any).healthRecords.map((record: any) => (
                <div key={record.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900 text-sm">{record.title}</span>
                      <span className="text-xs text-gray-400">{new Date(record.recordDate).toLocaleDateString()}</span>
                    </div>
                    {record.description && <p className="text-xs text-gray-600 mt-1">{record.description}</p>}
                    {record.vetName && <p className="text-xs text-gray-400 mt-1">Dr. {record.vetName}{record.clinicName ? ` — ${record.clinicName}` : ""}</p>}
                    {record.cost && <p className="text-xs text-gray-500 mt-1">Cost: ${record.cost.toFixed(2)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vaccinations */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vaccination History</h2>
          {(pet as any).vaccinations.length === 0 ? (
            <p className="text-gray-500 text-sm">No vaccination records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b">
                    <th className="pb-2 font-medium">Vaccine</th>
                    <th className="pb-2 font-medium">Date Given</th>
                    <th className="pb-2 font-medium">Next Due</th>
                    <th className="pb-2 font-medium">Vet</th>
                  </tr>
                </thead>
                <tbody>
                  {(pet as any).vaccinations.map((v: any) => (
                    <tr key={v.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-900">{v.vaccineName}</td>
                      <td className="py-2 text-gray-600">{new Date(v.dateGiven).toLocaleDateString()}</td>
                      <td className="py-2">
                        {v.dueDate ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${new Date(v.dueDate) < new Date() ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {new Date(v.dueDate).toLocaleDateString()}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2 text-gray-500">{v.vetName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Weight history — BAD: shows raw numbers, no chart */}
        {(pet as any).weightLogs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Weight History</h2>
            <div className="space-y-2">
              {(pet as any).weightLogs.map((log: any) => (
                <div key={log.id} className="flex justify-between text-sm">
                  <span className="text-gray-500">{new Date(log.loggedAt).toLocaleDateString()}</span>
                  <span className="font-medium text-gray-900">{log.weight} {log.unit}</span>
                </div>
              ))}
            </div>
            {latestWeight && (
              <div className="mt-3 pt-3 border-t text-sm text-gray-500">
                Current weight: <span className="font-semibold text-gray-900">{latestWeight.weight} {latestWeight.unit}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
