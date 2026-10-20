export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  bio?: string;
  role: 'user' | 'business' | 'admin';
  status?: 'active' | 'suspended' | 'banned';
  subscriptionPlan: 'free' | 'basic' | 'enterprise';
  animals: string[]; // Animal IDs
  createdAt: string;
}

export interface AnimalProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  coverImage?: string;
  breed: string;
  age: string;
  location: string;
  bio: string;
  handlerId: string;
  handlerName: string;
  followersCount: number;
  followingCount: number;
  photos: string[];
  isVerified?: boolean;
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  user: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  animalId: string;
  animalName: string;
  animalAvatar: string;
  animalUsername: string;
  videoUrl?: string;
  imageUrl?: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  tags: string[];
  audioUrl?: string;
  audioName?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  image: string;
  rating: number;
  reviewsCount: number;
  description: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  inStock: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  tags: string[];
}

export interface Service {
  id: string;
  title: string;
  providerName: string;
  providerAvatar: string;
  category: string;
  rating: number;
  reviewsCount: number;
  price: string;
  image: string;
  description: string;
  location: string;
  contactEmail: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface EventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  image: string;
  attendeesCount: number;
  category: string;
  description: string;
  organizerName: string;
  isAttending?: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'event' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface MessageItem {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
}

export interface ReportItem {
  id: string;
  targetType: 'post' | 'comment' | 'user' | 'product';
  targetId: string;
  targetTitle: string;
  reason: string;
  reporterName: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface DatabaseSchema {
  users: Record<string, User>;
  animals: Record<string, AnimalProfile>;
  follows: Record<string, boolean>; // key: `${userId}_${animalId}`
  posts: Record<string, Post>;
  likes: Record<string, boolean>; // key: `${userId}_${postId}`
  comments: Record<string, PostComment[]>; // key: postId
  products: Record<string, Product>;
  services: Record<string, Service>;
  events: Record<string, EventItem>;
  notifications: Record<string, NotificationItem[]>; // key: userId
  messages: Record<string, MessageItem[]>; // key: threadId
  reports?: Record<string, ReportItem>;
  auditLogs?: AuditLog[];
}
