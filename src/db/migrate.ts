/**
 * AnimalTok — Neon Postgres Schema Migration
 * Run once to create all tables, or re-run safely (IF NOT EXISTS).
 */
import { query } from "./postgres";

export async function runMigrations() {
  console.log("🐘 Running Neon Postgres migrations...");

  // Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      avatar TEXT,
      bio TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      subscription_plan TEXT NOT NULL DEFAULT 'free',
      animals TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Animal profiles table
  await query(`
    CREATE TABLE IF NOT EXISTS animals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      avatar TEXT,
      cover_image TEXT,
      breed TEXT,
      age TEXT,
      location TEXT,
      bio TEXT,
      handler_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      handler_name TEXT,
      followers_count INTEGER NOT NULL DEFAULT 0,
      following_count INTEGER NOT NULL DEFAULT 0,
      photos TEXT[] DEFAULT '{}',
      is_verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Follows table
  await query(`
    CREATE TABLE IF NOT EXISTS follows (
      user_id TEXT NOT NULL,
      animal_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, animal_id)
    )
  `);

  // Posts table
  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      animal_id TEXT NOT NULL,
      animal_name TEXT,
      animal_avatar TEXT,
      animal_username TEXT,
      video_url TEXT,
      image_url TEXT,
      caption TEXT,
      likes_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      shares_count INTEGER NOT NULL DEFAULT 0,
      tags TEXT[] DEFAULT '{}',
      audio_url TEXT,
      audio_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Post likes table
  await query(`
    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, post_id)
    )
  `);

  // Post comments table
  await query(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_handle TEXT,
      avatar TEXT,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Products table
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      price NUMERIC NOT NULL DEFAULT 0,
      currency TEXT DEFAULT '$',
      category TEXT,
      image TEXT,
      rating NUMERIC NOT NULL DEFAULT 5.0,
      reviews_count INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      seller_id TEXT,
      seller_name TEXT,
      seller_avatar TEXT,
      in_stock BOOLEAN NOT NULL DEFAULT true,
      approval_status TEXT DEFAULT 'pending',
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Services table
  await query(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      provider_name TEXT,
      provider_avatar TEXT,
      category TEXT,
      rating NUMERIC NOT NULL DEFAULT 5.0,
      reviews_count INTEGER NOT NULL DEFAULT 0,
      price TEXT,
      image TEXT,
      description TEXT,
      location TEXT,
      contact_email TEXT,
      approval_status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Events table
  await query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT,
      time TEXT,
      location TEXT,
      image TEXT,
      attendees_count INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      description TEXT,
      organizer_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Notifications table
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT,
      title TEXT,
      message TEXT,
      timestamp TEXT,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Messages table
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      sender_id TEXT,
      sender_name TEXT,
      sender_avatar TEXT,
      text TEXT NOT NULL,
      timestamp TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Reports table
  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      target_type TEXT,
      target_id TEXT,
      target_title TEXT,
      reason TEXT,
      reporter_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Audit logs table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_name TEXT,
      action TEXT,
      details TEXT,
      timestamp TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("✅ Neon Postgres migrations complete.");
}
