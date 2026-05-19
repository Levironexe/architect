"use client";

// BAD: entire landing page is client-rendered, losing all SSR/SSG benefits
// BAD: all data is hardcoded in this file, not fetched from CMS or DB
// BAD: 1300+ lines in one component — mixing nav, hero, features, pricing, FAQ, footer

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import _ from "lodash";
import moment from "moment";

// BAD: types defined inline instead of imported from @/types
interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  imageUrl: string;
  status: string;
  ownerId: string;
  createdAt: string;
}

interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
  icon: string;
  category: string;
  rating: number;
  reviewCount: number;
}

interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
  rating: number;
  avatar: string;
  petName: string;
}

interface PricingTier {
  name: string;
  price: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  notIncluded: string[];
  isPopular: boolean;
  ctaText: string;
}

interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  author: string;
  readTime: number;
  imageUrl: string;
  category: string;
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

// ============================================
// YAGNI: Observer pattern class. Built for "future analytics extensibility".
// Nothing subscribes to it. Nothing publishes to it.
// ============================================
interface Observer {
  update: (event: string, data: any) => void;
}

class EventBusObserverPattern {
  private static instance: EventBusObserverPattern;
  private observers: Map<string, Observer[]> = new Map();

  private constructor() {}

  static getInstance(): EventBusObserverPattern {
    if (!EventBusObserverPattern.instance) {
      EventBusObserverPattern.instance = new EventBusObserverPattern();
    }
    return EventBusObserverPattern.instance;
  }

  subscribe(event: string, observer: Observer): void {
    if (!this.observers.has(event)) {
      this.observers.set(event, []);
    }
    this.observers.get(event)!.push(observer);
  }

  unsubscribe(event: string, observer: Observer): void {
    const eventObservers = this.observers.get(event) || [];
    const index = eventObservers.indexOf(observer);
    if (index > -1) {
      eventObservers.splice(index, 1);
    }
  }

  publish(event: string, data: any): void {
    const eventObservers = this.observers.get(event) || [];
    eventObservers.forEach((observer) => observer.update(event, data));
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _eventBus = EventBusObserverPattern.getInstance();

// ============================================
// YAGNI: Generic strategy factory for "flexible rendering strategies"
// Only one strategy exists. Pattern completely unnecessary for this use case.
// ============================================
abstract class RenderStrategy<T> {
  abstract render(items: T[]): T[];
}

class DefaultRenderStrategy<T> extends RenderStrategy<T> {
  render(items: T[]): T[] {
    return items;
  }
}

class FilteredRenderStrategy<T extends { isActive?: boolean }> extends RenderStrategy<T> {
  render(items: T[]): T[] {
    return items.filter((i) => i.isActive !== false);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class RenderStrategyFactory {
  static create<T>(type: "default" | "filtered"): RenderStrategy<T> {
    if (type === "filtered") return new FilteredRenderStrategy<any>();
    return new DefaultRenderStrategy<T>();
  }
}

// ============================================
// HARDCODED DATA — should be in CMS/DB/API
// ============================================

const SERVICES_DATA: Service[] = [
  {
    id: 1,
    name: "Veterinary Consultations",
    description: "Connect with certified vets for in-person or virtual consultations. Get expert advice 24/7 for all your pet's health concerns and emergencies.",
    price: 49,
    duration: 30,
    icon: "🩺",
    category: "health",
    rating: 4.9,
    reviewCount: 2847,
  },
  {
    id: 2,
    name: "Professional Grooming",
    description: "Full grooming services: bath, haircut, nail trimming, ear cleaning, and teeth brushing. Mobile groomers come to your door.",
    price: 65,
    duration: 90,
    icon: "✂️",
    category: "grooming",
    rating: 4.8,
    reviewCount: 1923,
  },
  {
    id: 3,
    name: "Pet Boarding",
    description: "Safe, comfortable boarding facilities for your pets. Daily photos, walks, and playtime. Climate-controlled rooms with 24/7 supervision.",
    price: 45,
    duration: 1440,
    icon: "🏠",
    category: "boarding",
    rating: 4.7,
    reviewCount: 3156,
  },
  {
    id: 4,
    name: "Dog Training",
    description: "Expert training for dogs of all ages and breeds. Puppy basics, obedience, agility, and behavior correction by certified trainers.",
    price: 80,
    duration: 60,
    icon: "🎓",
    category: "training",
    rating: 4.9,
    reviewCount: 1567,
  },
  {
    id: 5,
    name: "In-Home Pet Sitting",
    description: "Trusted, background-checked sitters come to your home. Your pet stays comfortable in their own environment while you're away.",
    price: 35,
    duration: 240,
    icon: "🏡",
    category: "sitting",
    rating: 4.8,
    reviewCount: 4201,
  },
  {
    id: 6,
    name: "24/7 Emergency Care",
    description: "Round-the-clock emergency veterinary access. Fast response, triage support, and connections to nearest emergency vet clinics.",
    price: 150,
    duration: 60,
    icon: "🚨",
    category: "emergency",
    rating: 4.9,
    reviewCount: 892,
  },
];

const TESTIMONIALS_DATA: Testimonial[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "Dog Owner • Premium Member",
    content: "PetCare Hub has completely transformed how I manage Buddy's health. The appointment reminders saved us from missing his annual vaccinations twice now. Can't imagine life without it!",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=1",
    petName: "Buddy",
  },
  {
    id: 2,
    name: "Mike Chen",
    role: "Cat Parent • Basic Member",
    content: "I was skeptical at first, but PetCare Hub is genuinely life-changing. My cat Luna's health records are organized, my vet loves the share feature. The AI health tips are spot on.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=8",
    petName: "Luna",
  },
  {
    id: 3,
    name: "Emma Williams",
    role: "Multi-Pet Household • Premium",
    content: "Managing 3 dogs, 2 cats, and a rabbit was overwhelming. PetCare Hub keeps everything organized. The family sharing feature means my husband and I always stay in sync.",
    rating: 5,
    avatar: "https://i.pravatar.cc/150?img=5",
    petName: "The Whole Gang",
  },
  {
    id: 4,
    name: "Robert Davis",
    role: "Senior Pet Owner • Basic Member",
    content: "I'm not super tech-savvy but PetCare Hub is incredibly easy to use. Customer support is fantastic — they walked me through everything step by step. My Max is in great hands.",
    rating: 4,
    avatar: "https://i.pravatar.cc/150?img=12",
    petName: "Max",
  },
];

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: 0,
    yearlyPrice: 0,
    description: "Perfect for first-time pet owners",
    features: ["1 pet profile", "Basic health records", "5 vet consultations/year", "Email support", "Mobile app"],
    notIncluded: ["Priority booking", "Emergency care", "Multiple pets", "Analytics", "API access"],
    isPopular: false,
    ctaText: "Get Started Free",
  },
  {
    name: "Basic",
    price: 29,
    yearlyPrice: 290,
    description: "For dedicated pet parents",
    features: ["Up to 3 pets", "Complete health records", "Unlimited consultations", "Priority booking", "24/7 chat support", "Vaccination reminders", "Monthly health reports"],
    notIncluded: ["Emergency priority", "API access", "Custom integrations"],
    isPopular: false,
    ctaText: "Start Basic Plan",
  },
  {
    name: "Premium",
    price: 79,
    yearlyPrice: 790,
    description: "The ultimate pet care experience",
    features: ["Unlimited pets", "Complete health records", "Unlimited consultations", "Emergency priority", "24/7 phone support", "Advanced analytics", "Medication tracking", "Diet planning", "Training modules", "Family sharing (5 users)"],
    notIncluded: ["API access", "White-label"],
    isPopular: true,
    ctaText: "Go Premium",
  },
  {
    name: "Enterprise",
    price: 299,
    yearlyPrice: 2990,
    description: "For vet clinics & pet businesses",
    features: ["Unlimited everything", "API access", "Custom integrations", "White-label options", "Dedicated account manager", "SLA guarantee", "Staff management", "Billing & invoicing", "Multi-location", "Custom reporting"],
    notIncluded: [],
    isPopular: false,
    ctaText: "Contact Sales",
  },
];

const FAQ_DATA: FAQItem[] = [
  { id: 1, question: "How do I register my pet?", answer: "Go to Dashboard → Add New Pet, fill in your pet's details and upload a photo. Takes less than 2 minutes!" },
  { id: 2, question: "What types of pets are supported?", answer: "Dogs, cats, birds, rabbits, fish, reptiles, hamsters, guinea pigs, and exotic pets. We support all pets!" },
  { id: 3, question: "How do I book a vet consultation?", answer: "Go to Appointments → New Appointment, choose your pet, select consultation type, pick a time slot, and confirm. You'll get a reminder 24 hours before." },
  { id: 4, question: "Is my pet's data secure?", answer: "Absolutely. All data is encrypted in transit and at rest. We comply with GDPR, CCPA, and HIPAA-adjacent standards. Your data is never sold." },
  { id: 5, question: "Can I cancel my subscription?", answer: "Yes, cancel anytime from Account Settings. No cancellation fees. You keep premium access until the end of your billing period." },
  { id: 6, question: "Is there a mobile app?", answer: "Yes! Available on iOS and Android. Full feature parity with web, plus push notifications and offline health record access." },
  { id: 7, question: "How do I share records with my vet?", answer: "Pet profile → Share Records → enter your vet's email or generate a secure link. You control which records are shared and when the link expires." },
  { id: 8, question: "What payment methods do you accept?", answer: "Visa, MasterCard, Amex, Discover, PayPal, Apple Pay, and Google Pay. Enterprise plans support bank transfers. Powered by Stripe." },
];

const BLOG_POSTS: BlogPost[] = [
  { id: 1, title: "10 Signs Your Dog Needs a Vet Visit", excerpt: "Understanding your dog's health signals can save their life. Learn the warning signs.", author: "Dr. Sarah Mitchell", readTime: 8, imageUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800", category: "Health" },
  { id: 2, title: "The Ultimate Guide to Cat Nutrition", excerpt: "Proper nutrition is the foundation of your cat's health. A comprehensive guide.", author: "Dr. James Park", readTime: 12, imageUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800", category: "Nutrition" },
  { id: 3, title: "Training Your Puppy: Step-by-Step", excerpt: "Start training early with these proven techniques for a well-behaved, happy puppy.", author: "Mike Thompson", readTime: 15, imageUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800", category: "Training" },
];

// ============================================
// YAGNI: NotificationBell defined here but NEVER rendered anywhere in this file
// Should be in components/ if it were used at all
// ============================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NotificationBell = ({ userId }: { userId: string }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // TODO: implement notifications fetch
    // fetch(`/api/notifications?userId=${userId}`).then(r => r.json()).then(setNotifications)
  }, [userId]);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>🔔 {notifications.length}</button>
      {isOpen && <div>{notifications.map((n, i) => <p key={i}>{n.message}</p>)}</div>}
    </div>
  );
};

// ============================================
// MAIN COMPONENT — does EVERYTHING
// ============================================
export default function HomePage() {
  // BAD: 20+ useState in one component — no grouping, no reducer
  const [featuredPets, setFeaturedPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasAnimatedStats, setHasAnimatedStats] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<boolean | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [animatedPets, setAnimatedPets] = useState(0);
  const [animatedAppointments, setAnimatedAppointments] = useState(0);
  const [animatedVets, setAnimatedVets] = useState(0);
  const [animatedOwners, setAnimatedOwners] = useState(0);

  // YAGNI: comprehensive analytics state that is set but NEVER READ anywhere
  const [_analyticsData, setAnalyticsData] = useState({
    pageViews: 0,
    timeOnPage: 0,
    scrollDepth: 0,
    clickedCTA: false,
    viewedPricing: false,
    sessionId: uuidv4(),
    startTime: Date.now(),
    userAgent: "",
    screenResolution: "",
    referrer: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    heatmapData: [] as Array<{ x: number; y: number; ts: number }>,
  });

  const statsRef = useRef<HTMLDivElement>(null);

  // BAD: fetch in useEffect inside client component instead of server component / RSC
  useEffect(() => {
    const fetchFeaturedPets = async () => {
      try {
        setIsLoading(true);
        // BAD: no abort controller — memory leak if component unmounts
        const response = await axios.get("/api/pets?featured=true&limit=6");
        setFeaturedPets(response.data.pets || []);
      } catch (err: any) {
        setError(err.message || "Failed to load pets");
        setFeaturedPets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedPets();

    // BAD: initialize analytics on mount — this entire block is YAGNI
    setAnalyticsData((prev) => ({
      ...prev,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      referrer: document.referrer,
      utmSource: new URLSearchParams(window.location.search).get("utm_source") || "",
      utmMedium: new URLSearchParams(window.location.search).get("utm_medium") || "",
      utmCampaign: new URLSearchParams(window.location.search).get("utm_campaign") || "",
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // BAD: unthrottled scroll listener — fires on every pixel scrolled
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Stat counter animation — logic in scroll handler is wrong approach
      if (statsRef.current && !hasAnimatedStats) {
        const rect = statsRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          setHasAnimatedStats(true);
          const duration = 2000;
          const steps = 60;
          let step = 0;

          // BAD: multiple setInterval calls, not cleaned up if component unmounts mid-animation
          const t1 = setInterval(() => { step++; setAnimatedPets(Math.floor(287650 * step / steps)); if (step >= steps) clearInterval(t1); }, duration / steps);
          const t2 = setInterval(() => { setAnimatedAppointments(Math.floor(1893420 * step / steps)); if (step >= steps) clearInterval(t2); }, duration / steps);
          const t3 = setInterval(() => { setAnimatedVets(Math.floor(4200 * step / steps)); if (step >= steps) clearInterval(t3); }, duration / steps);
          const t4 = setInterval(() => { setAnimatedOwners(Math.floor(185000 * step / steps)); if (step >= steps) clearInterval(t4); }, duration / steps);
        }
      }

      // YAGNI: tracking scroll depth for analytics nobody reads
      setAnalyticsData((prev) => ({
        ...prev,
        scrollDepth: Math.max(
          prev.scrollDepth,
          Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100)
        ),
      }));
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasAnimatedStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // Testimonial auto-rotate
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS_DATA.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Cookie consent check
  useEffect(() => {
    try {
      const consent = localStorage.getItem("cookieConsent");
      if (consent !== null) setCookieConsent(consent === "true");
    } catch {
      // localStorage not available (SSR? but we're already client-only...)
    }
  }, []);

  // BAD: inline validation duplicated from server-side validation and utils.ts
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@") || email.length < 5) {
      alert("Please enter a valid email");
      return;
    }
    try {
      await axios.post("/api/newsletter/subscribe", { email });
      setEmailSubmitted(true);
      setEmail("");
      setAnalyticsData((prev) => ({ ...prev, clickedCTA: true })); // tracking that does nothing
    } catch (err: any) {
      alert("Failed: " + err.message);
    }
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setIsServiceModalOpen(true);
  };

  // BAD: should use Intl.NumberFormat — custom logic duplicated in utils.ts
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return Math.floor(num / 1000) + "K";
    return num.toString();
  };

  // BAD: useMemo with wrong deps — recalculates when unrelated state changes
  const filteredServices = useMemo(() => {
    return selectedCategory === "all"
      ? SERVICES_DATA
      : SERVICES_DATA.filter((s) => s.category === selectedCategory);
  }, [selectedCategory, isScrolled]); // isScrolled is not a dep of this computation

  // BAD: useCallback that doesn't actually need to be memoized
  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setAnimatedPets((prev) => prev); // pointless state touch
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ======================================================
          NAVBAR — should be its own component file
          ====================================================== */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/95 shadow-md py-3" : "bg-transparent py-5"
        }`}
        style={{ backdropFilter: "blur(12px)" }} // mixing inline style with tailwind
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">🐾</span>
            <span className={`text-2xl font-black ${isScrolled ? "text-gray-900" : "text-white"}`}>
              PetCare<span className="text-purple-500">Hub</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Services", href: "#services" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Pricing", href: "#pricing" },
              { label: "Blog", href: "/blog" },
              { label: "About", href: "/about" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`font-medium hover:text-purple-500 transition-colors text-sm ${
                  isScrolled ? "text-gray-600" : "text-white/90"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isScrolled ? "text-gray-700 hover:bg-gray-100" : "text-white hover:bg-white/10"
              }`}
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* BAD: Hamburger built with raw divs instead of icon library or accessible button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsNavOpen(!isNavOpen)}
            aria-label="Toggle menu"
          >
            <div className={`w-5 h-0.5 mb-1 transition-all ${isScrolled ? "bg-gray-900" : "bg-white"}`} />
            <div className={`w-5 h-0.5 mb-1 transition-all ${isScrolled ? "bg-gray-900" : "bg-white"}`} />
            <div className={`w-5 h-0.5 transition-all ${isScrolled ? "bg-gray-900" : "bg-white"}`} />
          </button>
        </div>

        {isNavOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t shadow-lg p-4">
            {["Services", "Pricing", "Blog", "About"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="block py-2.5 text-gray-700 font-medium border-b border-gray-50"
                onClick={() => setIsNavOpen(false)}
              >
                {item}
              </a>
            ))}
            <div className="flex gap-3 mt-4 pt-2">
              <Link href="/login" className="flex-1 text-center py-2.5 border border-gray-200 rounded-lg text-sm font-medium">Log In</Link>
              <Link href="/register" className="flex-1 text-center py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium">Sign Up Free</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ======================================================
          HERO
          ====================================================== */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
        style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)" }}
      >
        {/* decorative blobs — inline styles not extracted to CSS */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "rgba(255,165,0,0.4)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5 blur-3xl" style={{ background: "rgba(255,255,255,0.8)" }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-white text-sm font-medium mb-6">
            <span>🎉</span>
            <span>New: AI-powered health predictions now available!</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] mb-6 tracking-tight">
            The All-in-One Platform<br />for{" "}
            <span
              style={{
                background: "linear-gradient(to right, #ffd700, #ff8c00)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Pet Care
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
            Health records, vet appointments, grooming, boarding, and AI health insights — all in one beautiful app loved by 185K+ pet owners.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <Link
              href="/register"
              className="px-8 py-4 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-yellow-50 transition-all shadow-2xl"
            >
              Start Free Today →
            </Link>
            <button
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border border-white/30 rounded-xl font-bold text-lg hover:bg-white/20 transition-all"
              onClick={() => {
                // BAD: direct DOM query instead of ref
                document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              ▶ Watch Demo
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-white/70 text-sm mb-16">
            {["✓ No credit card required", "✓ Free 14-day trial", "✓ Cancel anytime", "✓ GDPR compliant"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          {/* App mockup placeholder */}
          <div
            className="mx-auto max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.2)", minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div className="text-white/50 text-center p-20">
              <div className="text-8xl mb-4">🐶🐱🐰🦜</div>
              <p className="text-lg font-medium">App Screenshot</p>
              {/* TODO: replace with actual screenshot before launch */}
              <p className="text-sm mt-1 opacity-60">TODO: Add actual app screenshot here</p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          ANIMATED STATS BAR
          ====================================================== */}
      <div ref={statsRef} className="bg-gray-900 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Pets Registered", value: animatedPets },
              { label: "Appointments Booked", value: animatedAppointments },
              { label: "Vet Partners", value: animatedVets },
              { label: "Happy Owners", value: animatedOwners },
            ].map((stat) => (
              <div key={stat.label} className="text-white">
                <div className="text-3xl md:text-4xl font-black text-purple-400">{formatNumber(stat.value)}+</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================
          FEATURES — 9 feature cards, all hardcoded
          ====================================================== */}
      <section className="py-24 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">Features</span>
            <h2 className="text-4xl font-black text-gray-900 mt-2">Everything Your Pet Needs</h2>
            <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
              One platform to manage your pet's entire health journey — from first vaccinations to senior care.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "📋", title: "Complete Health Records", desc: "Store and organize medical history, vaccinations, medications, allergies, and treatments in one secure place.", color: "bg-blue-50 text-blue-600" },
              { icon: "📅", title: "Smart Appointment Booking", desc: "Book with vets, groomers, and trainers instantly. Smart scheduling prevents double-booking and sends reminders.", color: "bg-green-50 text-green-600" },
              { icon: "🤖", title: "AI Health Insights", desc: "Personalized health insights and early warning alerts powered by AI trained on millions of pet health records.", color: "bg-purple-50 text-purple-600" },
              { icon: "🔔", title: "Automated Reminders", desc: "Never miss a vaccination, medication dose, or grooming appointment. Reminders via push, SMS, and email.", color: "bg-yellow-50 text-yellow-600" },
              { icon: "💊", title: "Medication Tracking", desc: "Track prescriptions, dosages, schedules, and refills. Integrated with major pet pharmacies for easy ordering.", color: "bg-red-50 text-red-600" },
              { icon: "📊", title: "Growth & Weight Tracking", desc: "Monitor weight changes and physical development with interactive charts and trend analysis over time.", color: "bg-indigo-50 text-indigo-600" },
              { icon: "🌍", title: "Find Nearby Services", desc: "Discover top-rated vets, groomers, trainers, and sitters near you. Real reviews from real pet owners.", color: "bg-teal-50 text-teal-600" },
              { icon: "📱", title: "Mobile App", desc: "iOS and Android apps with all features. Works offline for emergency access to your pet's records.", color: "bg-pink-50 text-pink-600" },
              { icon: "🔒", title: "Secure Record Sharing", desc: "Share records with vets or family members securely. Full control over access and expiration.", color: "bg-orange-50 text-orange-600" },
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group cursor-default">
                <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center text-2xl mb-4`}>{f.icon}</div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          HOW IT WORKS
          ====================================================== */}
      <section className="py-24 bg-gray-50" id="how-it-works">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">Process</span>
            <h2 className="text-4xl font-black text-gray-900 mt-2">Get Started in 5 Minutes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: 1, icon: "👤", title: "Create Account", desc: "Sign up free in 60 seconds. No credit card required." },
              { step: 2, icon: "🐾", title: "Add Your Pets", desc: "Create detailed profiles for each pet with photos and health info." },
              { step: 3, icon: "🔍", title: "Find Services", desc: "Discover and book trusted vets, groomers, and sitters nearby." },
              { step: 4, icon: "✅", title: "Stay Organized", desc: "Manage everything from one dashboard with reminders and AI insights." },
            ].map((step) => (
              <div key={step.step} className="flex flex-col items-center text-center relative">
                <div className="w-20 h-20 bg-white rounded-full shadow-md flex items-center justify-center text-4xl mb-4 border-2 border-purple-100 relative z-10">
                  {step.icon}
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {step.step}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          FEATURED PETS — fetched client-side
          ====================================================== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">Community</span>
            <h2 className="text-4xl font-black text-gray-900 mt-2">Meet Our Community Pets</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">Join 185,000+ pet owners who trust PetCare Hub with their animals' health.</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : featuredPets.length === 0 ? (
            // Emoji placeholders shown when API fails or returns empty
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 max-w-3xl mx-auto">
              {["🐕", "🐈", "🐰", "🦜", "🐠", "🐹"].map((emoji, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center text-5xl border border-purple-100 hover:scale-105 transition-transform cursor-pointer">
                  {emoji}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 max-w-4xl mx-auto">
              {featuredPets.map((pet) => (
                <Link key={pet.id} href={`/pets/${pet.id}`}>
                  <div className="aspect-square rounded-2xl overflow-hidden relative group">
                    {pet.imageUrl ? (
                      // BAD: using <img> instead of next/image
                      <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-4xl">
                        {pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾"}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <p className="text-white text-xs font-bold">{pet.name}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ======================================================
          SERVICES
          ====================================================== */}
      <section className="py-24 bg-gray-50" id="services">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">Services</span>
            <h2 className="text-4xl font-black text-gray-900 mt-2">Complete Pet Care Services</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">From routine checkups to emergency care — every aspect of your pet's wellbeing covered.</p>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {["all", "health", "grooming", "boarding", "training", "sitting", "emergency"].map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-all ${
                  selectedCategory === cat ? "bg-purple-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:bg-purple-50"
                }`}
              >
                {cat === "all" ? "All Services" : cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 cursor-pointer"
                onClick={() => handleServiceClick(service)}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-4xl">{service.icon}</span>
                  <span className="text-xs font-medium text-gray-400 capitalize bg-gray-50 px-2.5 py-1 rounded-full">{service.category}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{service.name}</h3>
                <p className="text-gray-500 text-sm mb-4 leading-relaxed line-clamp-2">{service.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black text-gray-900">${service.price}</span>
                    <span className="text-gray-400 text-xs ml-1">/session</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-yellow-500">★</span>
                    <span className="font-semibold">{service.rating}</span>
                    <span className="text-gray-400 text-xs">({service.reviewCount.toLocaleString()})</span>
                  </div>
                </div>
                <button className="mt-4 w-full py-2.5 bg-purple-50 text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-100 transition-colors">
                  Book Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          PRICING
          ====================================================== */}
      <section className="py-24 bg-white" id="pricing">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">Pricing</span>
            <h2 className="text-4xl font-black text-gray-900 mt-2">Simple, Transparent Pricing</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">Choose your plan. Upgrade or downgrade anytime. All plans include a 14-day free trial.</p>
          </div>

          {/* Billing toggle — inline implementation */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <span className={`font-medium text-sm ${billingPeriod === "monthly" ? "text-gray-900" : "text-gray-400"}`}>Monthly</span>
            <button
              onClick={() => setBillingPeriod((p) => (p === "monthly" ? "yearly" : "monthly"))}
              className={`relative w-12 h-6 rounded-full transition-colors ${billingPeriod === "yearly" ? "bg-purple-600" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${billingPeriod === "yearly" ? "translate-x-6" : ""}`} />
            </button>
            <span className={`font-medium text-sm ${billingPeriod === "yearly" ? "text-gray-900" : "text-gray-400"}`}>
              Yearly <span className="text-green-600 font-bold">Save 17%</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-6 ${
                  tier.isPopular ? "bg-purple-600 text-white shadow-2xl shadow-purple-500/30 scale-105" : "bg-white border border-gray-200"
                }`}
              >
                {tier.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <h3 className={`font-bold mb-1 ${tier.isPopular ? "text-white" : "text-gray-900"}`}>{tier.name}</h3>
                <p className={`text-xs mb-4 ${tier.isPopular ? "text-purple-200" : "text-gray-500"}`}>{tier.description}</p>
                <div className="mb-5">
                  <span className={`text-4xl font-black ${tier.isPopular ? "text-white" : "text-gray-900"}`}>
                    ${billingPeriod === "monthly" ? tier.price : Math.round(tier.yearlyPrice / 12)}
                  </span>
                  <span className={`text-xs ml-1 ${tier.isPopular ? "text-purple-200" : "text-gray-400"}`}>/mo</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {tier.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs ${tier.isPopular ? "text-purple-100" : "text-gray-600"}`}>
                      <span className={tier.isPopular ? "text-green-300" : "text-green-500"}>✓</span>
                      {f}
                    </li>
                  ))}
                  {tier.notIncluded.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs opacity-40`}>
                      <span>✗</span>
                      <span className={tier.isPopular ? "text-purple-200" : "text-gray-400"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.name === "Enterprise" ? "/contact" : "/register"}
                  className={`block text-center py-2.5 rounded-xl text-sm font-bold transition-all ${
                    tier.isPopular ? "bg-white text-purple-700 hover:bg-yellow-50" : "bg-purple-600 text-white hover:bg-purple-700"
                  }`}
                >
                  {tier.ctaText}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          TESTIMONIALS
          ====================================================== */}
      <section className="py-24 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">Testimonials</span>
            <h2 className="text-4xl font-black text-gray-900 mt-2">Loved by Pet Owners Everywhere</h2>
          </div>

          {/* Featured rotating testimonial */}
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <p className="text-xl text-gray-700 italic leading-relaxed mb-5">
              "{TESTIMONIALS_DATA[currentTestimonial].content}"
            </p>
            <div className="flex items-center justify-center gap-3">
              {/* BAD: using <img> instead of next/image */}
              <img src={TESTIMONIALS_DATA[currentTestimonial].avatar} alt={TESTIMONIALS_DATA[currentTestimonial].name} className="w-10 h-10 rounded-full" />
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900">{TESTIMONIALS_DATA[currentTestimonial].name}</p>
                <p className="text-xs text-gray-500">{TESTIMONIALS_DATA[currentTestimonial].role}</p>
              </div>
              <div className="text-yellow-400 text-sm ml-2">{"★".repeat(TESTIMONIALS_DATA[currentTestimonial].rating)}</div>
            </div>
          </div>

          {/* Dot nav */}
          <div className="flex justify-center gap-2 mb-12">
            {TESTIMONIALS_DATA.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonial(i)}
                className={`h-2 rounded-full transition-all ${i === currentTestimonial ? "w-8 bg-purple-600" : "w-2 bg-gray-300"}`}
              />
            ))}
          </div>

          {/* Grid of all testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TESTIMONIALS_DATA.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex text-yellow-400 text-sm mb-3">{"★".repeat(t.rating)}</div>
                <p className="text-gray-600 text-sm italic mb-4">"{t.content}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-9 h-9 rounded-full" />
                  <div>
                    <p className="font-bold text-sm text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          FAQ
          ====================================================== */}
      <section className="py-24 bg-white" id="faq">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">FAQ</span>
            <h2 className="text-4xl font-black text-gray-900 mt-2">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-2">
            {FAQ_DATA.map((faq) => (
              <div key={faq.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 text-sm">{faq.question}</span>
                  <span className={`text-gray-400 text-xs transition-transform ${openFaqId === faq.id ? "rotate-180" : ""}`}>▼</span>
                </button>
                {openFaqId === faq.id && (
                  <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-gray-500 text-sm mb-4">Still have questions?</p>
            <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors">
              Contact Support →
            </Link>
          </div>
        </div>
      </section>

      {/* ======================================================
          BLOG PREVIEW
          ====================================================== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-purple-600 font-semibold text-xs uppercase tracking-widest">Blog</span>
              <h2 className="text-4xl font-black text-gray-900 mt-1">Pet Care Tips & Insights</h2>
            </div>
            <Link href="/blog" className="text-purple-600 text-sm font-medium hover:text-purple-700 hidden md:block">
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BLOG_POSTS.map((post) => (
              <Link key={post.id} href={`/blog/${post.id}`}>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className="h-44 relative overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
                    <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute top-3 left-3 bg-white rounded-full px-2.5 py-1 text-xs font-bold text-purple-600">{post.category}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 mb-2 text-sm group-hover:text-purple-600 transition-colors line-clamp-2">{post.title}</h3>
                    <p className="text-gray-500 text-xs line-clamp-2 mb-4">{post.excerpt}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{post.author}</span>
                      <span>{post.readTime} min read</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          EMAIL CTA
          ====================================================== */}
      <section className="py-24" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className="text-6xl mb-5">🐾</div>
          <h2 className="text-4xl font-black text-white mb-4">Give Your Pet the Care They Deserve</h2>
          <p className="text-purple-200 mb-8">Join 185,000+ pet owners. Start your free trial today — no credit card needed.</p>

          {emailSubmitted ? (
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-white text-xl font-bold">You're on the list!</p>
              <p className="text-purple-200 mt-2">We'll send you pet care tips and exclusive offers.</p>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 px-5 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-purple-300 focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-white text-purple-700 rounded-xl font-bold hover:bg-yellow-50 transition-colors whitespace-nowrap"
              >
                Get Early Access
              </button>
            </form>
          )}
          <p className="text-purple-300 text-xs mt-4">By subscribing you agree to our Privacy Policy. Unsubscribe anytime.</p>
        </div>
      </section>

      {/* ======================================================
          FOOTER — should be its own component
          ====================================================== */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🐾</span>
                <span className="text-white font-black">PetCare<span className="text-purple-400">Hub</span></span>
              </div>
              <p className="text-xs leading-relaxed mb-4">The all-in-one platform for pet owners who want the best for their animals.</p>
              <div className="flex gap-2">
                {["T", "F", "I", "Y"].map((s, i) => (
                  <a key={i} href="#" className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-xs hover:bg-purple-600 transition-colors">
                    {s}
                  </a>
                ))}
              </div>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap", "API Docs"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Press", "Partners"] },
              { title: "Support", links: ["Help Center", "Community", "Status", "Contact", "Feedback"] },
              { title: "Legal", links: ["Privacy", "Terms", "Cookies", "GDPR", "Security"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-bold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href={`/${link.toLowerCase().replace(/ /g, "-")}`} className="text-xs hover:text-purple-400 transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <p>© {new Date().getFullYear()} PetCare Hub, Inc. All rights reserved.</p>
            <p>Made with ❤️ for pets everywhere 🐾</p>
          </div>
        </div>
      </footer>

      {/* ======================================================
          SERVICE MODAL — should be its own component
          ====================================================== */}
      {isServiceModalOpen && selectedService && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsServiceModalOpen(false); }}
        >
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-start mb-5">
              <div>
                <span className="text-4xl">{selectedService.icon}</span>
                <h3 className="text-xl font-black text-gray-900 mt-2">{selectedService.name}</h3>
              </div>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <p className="text-gray-600 text-sm mb-5">{selectedService.description}</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
              {[
                ["Price", `$${selectedService.price}/session`],
                ["Duration", `${selectedService.duration} min`],
                ["Rating", `⭐ ${selectedService.rating} (${selectedService.reviewCount.toLocaleString()} reviews)`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-bold text-gray-900">{v}</span>
                </div>
              ))}
            </div>
            <Link href="/register" className="block w-full text-center py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors text-sm" onClick={() => setIsServiceModalOpen(false)}>
              Book {selectedService.name} →
            </Link>
          </div>
        </div>
      )}

      {/* ======================================================
          COOKIE BANNER
          ====================================================== */}
      {cookieConsent === null && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-xs bg-gray-900 text-white rounded-2xl p-5 shadow-2xl z-40">
          <p className="text-xs mb-4 leading-relaxed">
            We use cookies to improve your experience. See our{" "}
            <a href="/cookies" className="underline text-purple-300">Cookie Policy</a>.
          </p>
          <div className="flex gap-2">
            <button onClick={() => { localStorage.setItem("cookieConsent", "true"); setCookieConsent(true); }} className="flex-1 py-2 bg-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-700">Accept</button>
            <button onClick={() => { localStorage.setItem("cookieConsent", "false"); setCookieConsent(false); }} className="flex-1 py-2 bg-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-600">Decline</button>
          </div>
        </div>
      )}
    </div>
  );
}
