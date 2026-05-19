// BAD: God hook — fetches everything for the entire app in one hook
// BAD: WebSocket setup that is never connected from the server side
// BAD: mixes data fetching, caching, WebSocket, notifications, and analytics
// BAD: uses polling AND WebSocket simultaneously
// BAD: no abort controller for fetch calls

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// BAD: types inline in the hook instead of importing from types/index.ts
interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  status: string;
  imageUrl: string | null;
}

interface Appointment {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  petId: string;
  petName: string;
  cost: number | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl: string | null;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface DashboardStats {
  totalPets: number;
  upcomingAppointments: number;
  totalSpent: number;
  activeOrders: number;
}

// BAD: YAGNI analytics event tracking in the hook
interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
}

interface UseEverythingReturn {
  // Pets
  pets: Pet[];
  petsLoading: boolean;
  petsError: string | null;
  refetchPets: () => Promise<void>;

  // Appointments
  appointments: Appointment[];
  appointmentsLoading: boolean;
  appointmentsError: string | null;
  refetchAppointments: () => Promise<void>;

  // Products
  products: Product[];
  productsLoading: boolean;
  productsError: string | null;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Stats
  stats: DashboardStats | null;

  // YAGNI: WebSocket status
  wsStatus: "connecting" | "connected" | "disconnected" | "error";

  // YAGNI: analytics queue
  trackEvent: (event: string, properties?: Record<string, any>) => void;

  // General
  isAnyLoading: boolean;
  refetchAll: () => Promise<void>;
}

// BAD: hook is so large it should be split into 5+ separate hooks
export function useEverything(userId: string | null): UseEverythingReturn {
  // Pets state
  const [pets, setPets] = useState<Pet[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [petsError, setPetsError] = useState<string | null>(null);

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Stats state
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // YAGNI: WebSocket state — never actually connected server-side
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);

  // YAGNI: analytics queue — events are queued but never flushed to a service
  const [analyticsQueue, setAnalyticsQueue] = useState<AnalyticsEvent[]>([]);
  const analyticsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling interval ref — BAD: uses polling AND WebSocket
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPets = useCallback(async () => {
    if (!userId) return;
    setPetsLoading(true);
    setPetsError(null);
    try {
      // BAD: no auth header — relies on cookie (but token is in localStorage in the app)
      const res = await fetch(`/api/pets?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch pets");
      const data = await res.json();
      setPets(data.pets || []);
    } catch (err: any) {
      setPetsError(err.message);
    } finally {
      setPetsLoading(false);
    }
  }, [userId]);

  const fetchAppointments = useCallback(async () => {
    if (!userId) return;
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const res = await fetch(`/api/appointments?userId=${userId}&upcoming=true`);
      if (!res.ok) throw new Error("Failed to fetch appointments");
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (err: any) {
      setAppointmentsError(err.message);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [userId]);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await fetch("/api/products?featured=true&limit=8");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err: any) {
      setProductsError(err.message);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setNotificationsLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err: any) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setNotificationsLoading(false);
    }
  }, [userId]);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    try {
      // BAD: computing stats client-side by calling pets and appointments separately
      const [petsData, apptData] = await Promise.all([
        fetch(`/api/pets?userId=${userId}`).then((r) => r.json()),
        fetch(`/api/appointments?userId=${userId}&status=upcoming`).then((r) => r.json()),
      ]);
      setStats({
        totalPets: petsData.pets?.length || 0,
        upcomingAppointments: apptData.appointments?.length || 0,
        totalSpent: 0, // BAD: always 0 because no orders API call
        activeOrders: 0,
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [userId]);

  const refetchAll = useCallback(async () => {
    // BAD: sequential awaits instead of Promise.all
    await fetchPets();
    await fetchAppointments();
    await fetchProducts();
    await fetchNotifications();
    await fetchStats();
  }, [fetchPets, fetchAppointments, fetchProducts, fetchNotifications, fetchStats]);

  // YAGNI: WebSocket setup — server never emits WS events
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3001`;
    setWsStatus("connecting");

    try {
      const ws = new WebSocket(`${wsUrl}?userId=${userId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("connected");
        ws.send(JSON.stringify({ type: "subscribe", userId }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // BAD: giant switch statement for WS messages
          switch (message.type) {
            case "appointment_update":
              setAppointments((prev) =>
                prev.map((a) => (a.id === message.data.id ? { ...a, ...message.data } : a))
              );
              break;
            case "new_notification":
              setNotifications((prev) => [message.data, ...prev]);
              break;
            case "pet_update":
              setPets((prev) => prev.map((p) => (p.id === message.data.id ? { ...p, ...message.data } : p)));
              break;
            default:
              console.log("Unknown WS message type:", message.type);
          }
        } catch {
          console.error("Failed to parse WS message");
        }
      };

      ws.onerror = () => setWsStatus("error");
      ws.onclose = () => setWsStatus("disconnected");
    } catch {
      setWsStatus("error");
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId]);

  // BAD: polling in addition to WebSocket — doubles the load
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    refetchAll();

    // Poll every 30 seconds — even though WS should handle updates
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
      fetchAppointments();
    }, 30000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [userId, refetchAll, fetchNotifications, fetchAppointments]);

  // YAGNI: analytics event batching — events queued but never sent to any service
  useEffect(() => {
    analyticsIntervalRef.current = setInterval(() => {
      if (analyticsQueue.length > 0) {
        // TODO: flush to analytics service
        console.debug("[Analytics] Would flush events:", analyticsQueue.length);
        setAnalyticsQueue([]);
      }
    }, 10000);

    return () => {
      if (analyticsIntervalRef.current) {
        clearInterval(analyticsIntervalRef.current);
      }
    };
  }, [analyticsQueue]);

  const trackEvent = useCallback((event: string, properties: Record<string, any> = {}) => {
    setAnalyticsQueue((prev) => [
      ...prev,
      { event, properties: { ...properties, userId }, timestamp: Date.now() },
    ]);
  }, [userId]);

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead: true }) });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const isAnyLoading = petsLoading || appointmentsLoading || productsLoading || notificationsLoading;

  return {
    pets,
    petsLoading,
    petsError,
    refetchPets: fetchPets,
    appointments,
    appointmentsLoading,
    appointmentsError,
    refetchAppointments: fetchAppointments,
    products,
    productsLoading,
    productsError,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    stats,
    wsStatus,
    trackEvent,
    isAnyLoading,
    refetchAll,
  };
}
