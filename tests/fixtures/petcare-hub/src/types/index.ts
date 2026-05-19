// BAD: god types file — all types for the entire app in one file
// BAD: many types are duplicated (inline) in page.tsx, dashboard/page.tsx, and hooks/useEverything.ts
// BAD: YAGNI types that are never used anywhere

// ============================================
// USER TYPES
// ============================================

export type UserRole = "owner" | "vet" | "admin" | "moderator" | "support";
export type SubscriptionTier = "free" | "basic" | "premium" | "enterprise";

export interface User {
  id: string;
  email: string;
  name: string;
  // BAD: 3 name fields for the same thing
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string | null;
  phone?: string | null;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  isPremium: boolean; // BAD: duplicates subscriptionTier check
  isActive: boolean;
  isVerified: boolean;
  bio?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  zipCode?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// BAD: CreateUserInput is a partial subset of User with different field names
export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: UserRole;
}

// BAD: UpdateUserInput duplicates CreateUserInput but all optional
export interface UpdateUserInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  website?: string;
  avatar?: string;
  address?: string;
  city?: string;
  country?: string;
}

// YAGNI: UserProfile duplicates User but without sensitive fields
// should just use Omit<User, "...">
export interface UserProfile {
  id: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  subscriptionTier: SubscriptionTier;
  isPremium: boolean;
  createdAt: string;
}

// ============================================
// PET TYPES
// ============================================

export type PetSpecies = "dog" | "cat" | "bird" | "fish" | "rabbit" | "hamster" | "reptile" | "other";
export type PetStatus = "healthy" | "sick" | "recovering" | "checkup_needed" | "critical" | "deceased";
export type PetGender = "male" | "female" | "unknown";

export interface Pet {
  id: string;
  name: string;
  species: PetSpecies;
  breed?: string | null;
  age?: number | null;
  weight?: number | null;
  color?: string | null;
  gender?: PetGender | null;
  status: PetStatus;
  imageUrl?: string | null;
  imageUrls?: string[];
  microchipId?: string | null;
  insuranceNumber?: string | null;
  isNeutered?: boolean;
  isAdopted?: boolean;
  dateOfBirth?: string | null;
  adoptionDate?: string | null;
  notes?: string | null;
  ownerId: string;
  owner?: UserProfile;
  healthRecords?: HealthRecord[];
  vaccinations?: Vaccination[];
  medications?: Medication[];
  weightLogs?: WeightLog[];
  appointments?: Appointment[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// BAD: PetSummary is just Pet with fewer fields — use Pick<Pet, ...> instead
export interface PetSummary {
  id: string;
  name: string;
  species: PetSpecies;
  breed?: string | null;
  age?: number | null;
  status: PetStatus;
  imageUrl?: string | null;
  ownerId: string;
}

export interface CreatePetInput {
  name: string;
  species: PetSpecies;
  breed?: string;
  age?: number;
  weight?: number;
  color?: string;
  gender?: PetGender;
  imageUrl?: string;
  microchipId?: string;
  isNeutered?: boolean;
  notes?: string;
}

// ============================================
// HEALTH RECORD TYPES
// ============================================

export type HealthRecordType = "general" | "checkup" | "emergency" | "surgery" | "dental" | "vaccination" | "prescription";

export interface HealthRecord {
  id: string;
  petId: string;
  recordDate: string;
  type: HealthRecordType;
  title: string;
  description?: string | null;
  vetName?: string | null;
  clinicName?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  followUpDate?: string | null;
  cost?: number | null;
  attachments?: string[];
  createdAt: string;
}

export interface Vaccination {
  id: string;
  petId: string;
  vaccineName: string;
  dateGiven: string;
  dueDate?: string | null;
  batchNumber?: string | null;
  vetName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Medication {
  id: string;
  petId: string;
  medicationName: string;
  dosage?: string | null;
  frequency?: string | null;
  startDate: string;
  endDate?: string | null;
  isOngoing: boolean;
  notes?: string | null;
  prescribedBy?: string | null;
  createdAt: string;
}

export interface WeightLog {
  id: string;
  petId: string;
  weight: number;
  unit: "kg" | "lbs";
  notes?: string | null;
  loggedAt: string;
}

// ============================================
// APPOINTMENT TYPES
// ============================================

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type AppointmentType = "checkup" | "vaccination" | "surgery" | "grooming" | "dental" | "emergency" | "consultation";

export interface Appointment {
  id: string;
  petId: string;
  pet?: PetSummary;
  userId: string;
  title: string;
  description?: string | null;
  type?: AppointmentType | null;
  status: AppointmentStatus;
  scheduledAt: string;
  duration?: number | null;
  vetName?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  cost?: number | null;
  notes?: string | null;
  reminderSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PRODUCT / E-COMMERCE TYPES
// ============================================

export type ProductCategory = "food" | "treats" | "toys" | "accessories" | "health" | "grooming" | "housing" | "training";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  sku?: string | null;
  category: ProductCategory;
  subcategory?: string | null;
  brand?: string | null;
  price: number;
  compareAtPrice?: number | null;
  discountPercent?: number;
  stock: number;
  imageUrl?: string | null;
  imageUrls?: string[];
  tags?: string[];
  petSpecies?: PetSpecies[];
  isActive: boolean;
  isFeatured: boolean;
  avgRating?: number | null;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress?: Address | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product?: Product;
  quantity: number;
  price: number;
  total: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType =
  | "appointment_reminder"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "vaccination_due"
  | "medication_reminder"
  | "weight_update"
  | "subscription_expiring"
  | "subscription_expired"
  | "new_message"
  | "order_confirmed"
  | "order_shipped"
  | "order_delivered"
  | "welcome"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// BAD: PaginatedResponse duplicates common pattern — should be generic utility
export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================
// YAGNI TYPES — never used anywhere
// ============================================

// YAGNI: WebSocketMessage type — WS not actually implemented server-side
export interface WebSocketMessage {
  type: string;
  data: any;
  userId?: string;
  timestamp: number;
  messageId: string;
}

// YAGNI: AnalyticsEvent — queue never flushed to a real service
export interface AnalyticsEvent {
  event: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  timestamp: number;
  source: "web" | "mobile" | "api";
}

// YAGNI: AIRecommendation — AI feature never built
export interface AIRecommendation {
  id: string;
  type: "food" | "supplement" | "activity" | "vet_visit";
  title: string;
  description: string;
  confidence: number;
  basedOn: string[];
  petId: string;
  createdAt: string;
}

// YAGNI: CommunityPost — social features never built
export interface CommunityPost {
  id: string;
  authorId: string;
  author?: UserProfile;
  title: string;
  content: string;
  tags?: string[];
  petId?: string;
  pet?: PetSummary;
  likes: number;
  comments: number;
  isLiked?: boolean;
  createdAt: string;
}

// YAGNI: VideoConsult — video consultation feature never built
export interface VideoConsult {
  id: string;
  userId: string;
  vetId: string;
  petId: string;
  sessionId: string; // Twilio/Zoom session ID
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledAt: string;
  duration?: number;
  cost: number;
  recordingUrl?: string | null;
  createdAt: string;
}
