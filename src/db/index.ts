/**
 * Neon Postgres-backed database layer.
 * Replaces the old JSON file-based getDb / saveDb.
 *
 * All routes that call getDb() / saveDb() will transparently use Neon now.
 * We reconstruct the same DatabaseSchema shape so existing routes need no changes.
 */
import { query } from "./postgres";
import { DatabaseSchema } from "../types";
import { initialDbData } from "./initialData";
import { runMigrations } from "./migrate";

let migrated = false;

/** Run migrations once on first call, then seed initial data if tables are empty. */
async function ensureReady() {
  if (migrated) return;
  migrated = true;
  await runMigrations();
  await seedIfEmpty();
}

async function seedIfEmpty() {
  const { rows } = await query("SELECT COUNT(*) as count FROM users");
  if (Number(rows[0].count) > 0) return; // already seeded
  console.log("🌱 Seeding Neon database with initial data...");
  await seedAll(initialDbData);
  console.log("✅ Seed complete.");
}

// ─── READ ─────────────────────────────────────────────────────────────────

export async function getDb(): Promise<DatabaseSchema> {
  await ensureReady();

  const [
    usersRes, animalsRes, followsRes, postsRes, likesRes, commentsRes,
    productsRes, servicesRes, eventsRes, notificationsRes, messagesRes,
    reportsRes, auditLogsRes
  ] = await Promise.all([
    query("SELECT * FROM users ORDER BY created_at"),
    query("SELECT * FROM animals ORDER BY created_at"),
    query("SELECT * FROM follows"),
    query("SELECT * FROM posts ORDER BY created_at DESC"),
    query("SELECT * FROM likes"),
    query("SELECT * FROM comments ORDER BY created_at"),
    query("SELECT * FROM products ORDER BY created_at DESC"),
    query("SELECT * FROM services ORDER BY created_at DESC"),
    query("SELECT * FROM events ORDER BY created_at"),
    query("SELECT * FROM notifications ORDER BY created_at DESC"),
    query("SELECT * FROM messages ORDER BY created_at"),
    query("SELECT * FROM reports ORDER BY created_at DESC"),
    query("SELECT * FROM audit_logs ORDER BY created_at DESC"),
  ]);

  // Reconstruct the users dict
  const users: DatabaseSchema["users"] = {};
  for (const u of usersRes.rows) {
    users[u.id] = {
      id: u.id, name: u.name, username: u.username, email: u.email,
      avatar: u.avatar, bio: u.bio, role: u.role, status: u.status,
      subscriptionPlan: u.subscription_plan,
      animals: u.animals || [],
      createdAt: u.created_at,
    };
  }

  // Animals dict
  const animals: DatabaseSchema["animals"] = {};
  for (const a of animalsRes.rows) {
    animals[a.id] = {
      id: a.id, name: a.name, username: a.username, avatar: a.avatar,
      coverImage: a.cover_image, breed: a.breed, age: a.age, location: a.location,
      bio: a.bio, handlerId: a.handler_id, handlerName: a.handler_name,
      followersCount: Number(a.followers_count), followingCount: Number(a.following_count),
      photos: a.photos || [], isVerified: a.is_verified,
      createdAt: a.created_at,
    };
  }

  // Follows dict
  const follows: DatabaseSchema["follows"] = {};
  for (const f of followsRes.rows) {
    follows[`${f.user_id}_${f.animal_id}`] = true;
  }

  // Posts dict
  const posts: DatabaseSchema["posts"] = {};
  for (const p of postsRes.rows) {
    posts[p.id] = {
      id: p.id, animalId: p.animal_id, animalName: p.animal_name,
      animalAvatar: p.animal_avatar, animalUsername: p.animal_username,
      videoUrl: p.video_url, imageUrl: p.image_url, caption: p.caption,
      likesCount: Number(p.likes_count), commentsCount: Number(p.comments_count),
      sharesCount: Number(p.shares_count), tags: p.tags || [],
      audioUrl: p.audio_url, audioName: p.audio_name, createdAt: p.created_at,
    };
  }

  // Likes dict
  const likes: DatabaseSchema["likes"] = {};
  for (const l of likesRes.rows) {
    likes[`${l.user_id}_${l.post_id}`] = true;
  }

  // Comments dict (grouped by post_id)
  const comments: DatabaseSchema["comments"] = {};
  for (const c of commentsRes.rows) {
    if (!comments[c.post_id]) comments[c.post_id] = [];
    comments[c.post_id].push({
      id: c.id, postId: c.post_id, user: c.user_handle,
      avatar: c.avatar, text: c.text, createdAt: c.created_at,
    });
  }

  // Products dict
  const products: DatabaseSchema["products"] = {};
  for (const p of productsRes.rows) {
    products[p.id] = {
      id: p.id, title: p.title, price: Number(p.price), currency: p.currency,
      category: p.category, image: p.image, rating: Number(p.rating),
      reviewsCount: Number(p.reviews_count), description: p.description,
      sellerId: p.seller_id, sellerName: p.seller_name, sellerAvatar: p.seller_avatar,
      inStock: p.in_stock, approvalStatus: p.approval_status, tags: p.tags || [],
    };
  }

  // Services dict
  const services: DatabaseSchema["services"] = {};
  for (const s of servicesRes.rows) {
    services[s.id] = {
      id: s.id, title: s.title, providerName: s.provider_name,
      providerAvatar: s.provider_avatar, category: s.category,
      rating: Number(s.rating), reviewsCount: Number(s.reviews_count),
      price: s.price, image: s.image, description: s.description,
      location: s.location, contactEmail: s.contact_email,
      approvalStatus: s.approval_status,
    };
  }

  // Events dict
  const events: DatabaseSchema["events"] = {};
  for (const e of eventsRes.rows) {
    events[e.id] = {
      id: e.id, title: e.title, date: e.date, time: e.time,
      location: e.location, image: e.image,
      attendeesCount: Number(e.attendees_count), category: e.category,
      description: e.description, organizerName: e.organizer_name,
    };
  }

  // Notifications dict (grouped by user_id)
  const notifications: DatabaseSchema["notifications"] = {};
  for (const n of notificationsRes.rows) {
    if (!notifications[n.user_id]) notifications[n.user_id] = [];
    notifications[n.user_id].push({
      id: n.id, userId: n.user_id, type: n.type, title: n.title,
      message: n.message, timestamp: n.timestamp, read: n.is_read,
    });
  }

  // Messages dict (grouped by thread_id)
  const messages: DatabaseSchema["messages"] = {};
  for (const m of messagesRes.rows) {
    if (!messages[m.thread_id]) messages[m.thread_id] = [];
    messages[m.thread_id].push({
      id: m.id, threadId: m.thread_id, senderId: m.sender_id,
      senderName: m.sender_name, senderAvatar: m.sender_avatar,
      text: m.text, timestamp: m.timestamp,
    });
  }

  // Reports dict
  const reports: DatabaseSchema["reports"] = {};
  for (const r of reportsRes.rows) {
    reports[r.id] = {
      id: r.id, targetType: r.target_type, targetId: r.target_id,
      targetTitle: r.target_title, reason: r.reason,
      reporterName: r.reporter_name, status: r.status,
      createdAt: r.created_at,
    };
  }

  // Audit logs array
  const auditLogs = auditLogsRes.rows.map(l => ({
    id: l.id, adminName: l.admin_name, action: l.action,
    details: l.details, timestamp: l.timestamp,
  }));

  return { users, animals, follows, posts, likes, comments, products, services, events, notifications, messages, reports, auditLogs };
}

// ─── WRITE ────────────────────────────────────────────────────────────────
// Instead of replacing the whole DB, each route mutates specific rows.
// saveDb reconstructs diffs and upserts changed rows.

export async function saveDb(data: DatabaseSchema): Promise<void> {
  await ensureReady();

  // Upsert users
  for (const u of Object.values(data.users)) {
    await query(`
      INSERT INTO users (id, name, username, email, avatar, bio, role, status, subscription_plan, animals, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, username=EXCLUDED.username, email=EXCLUDED.email,
        avatar=EXCLUDED.avatar, bio=EXCLUDED.bio, role=EXCLUDED.role,
        status=EXCLUDED.status, subscription_plan=EXCLUDED.subscription_plan,
        animals=EXCLUDED.animals
    `, [u.id, u.name, u.username, u.email, u.avatar, u.bio, u.role, u.status,
        u.subscriptionPlan, u.animals, u.createdAt]);
  }

  // Upsert animals
  for (const a of Object.values(data.animals)) {
    await query(`
      INSERT INTO animals (id, name, username, avatar, cover_image, breed, age, location, bio,
        handler_id, handler_name, followers_count, following_count, photos, is_verified, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, username=EXCLUDED.username, avatar=EXCLUDED.avatar,
        cover_image=EXCLUDED.cover_image, breed=EXCLUDED.breed, age=EXCLUDED.age,
        location=EXCLUDED.location, bio=EXCLUDED.bio, handler_id=EXCLUDED.handler_id,
        handler_name=EXCLUDED.handler_name, followers_count=EXCLUDED.followers_count,
        following_count=EXCLUDED.following_count, photos=EXCLUDED.photos,
        is_verified=EXCLUDED.is_verified
    `, [a.id, a.name, a.username, a.avatar, a.coverImage, a.breed, a.age, a.location,
        a.bio, a.handlerId, a.handlerName, a.followersCount, a.followingCount,
        a.photos, a.isVerified, a.createdAt]);
  }

  // Upsert posts
  for (const p of Object.values(data.posts)) {
    await query(`
      INSERT INTO posts (id, animal_id, animal_name, animal_avatar, animal_username,
        video_url, image_url, caption, likes_count, comments_count, shares_count, tags,
        audio_url, audio_name, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        caption=EXCLUDED.caption, likes_count=EXCLUDED.likes_count,
        comments_count=EXCLUDED.comments_count, shares_count=EXCLUDED.shares_count,
        tags=EXCLUDED.tags, video_url=EXCLUDED.video_url, image_url=EXCLUDED.image_url,
        audio_url=EXCLUDED.audio_url, audio_name=EXCLUDED.audio_name
    `, [p.id, p.animalId, p.animalName, p.animalAvatar, p.animalUsername,
        p.videoUrl, p.imageUrl, p.caption, p.likesCount, p.commentsCount, p.sharesCount,
        p.tags, p.audioUrl, p.audioName, p.createdAt]);
  }

  // Upsert products
  for (const p of Object.values(data.products)) {
    await query(`
      INSERT INTO products (id, title, price, currency, category, image, rating, reviews_count,
        description, seller_id, seller_name, seller_avatar, in_stock, approval_status, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title, price=EXCLUDED.price, category=EXCLUDED.category,
        image=EXCLUDED.image, rating=EXCLUDED.rating, reviews_count=EXCLUDED.reviews_count,
        description=EXCLUDED.description, seller_id=EXCLUDED.seller_id,
        seller_name=EXCLUDED.seller_name, seller_avatar=EXCLUDED.seller_avatar,
        in_stock=EXCLUDED.in_stock, approval_status=EXCLUDED.approval_status, tags=EXCLUDED.tags
    `, [p.id, p.title, p.price, p.currency, p.category, p.image, p.rating, p.reviewsCount,
        p.description, p.sellerId, p.sellerName, p.sellerAvatar, p.inStock,
        p.approvalStatus || 'pending', p.tags]);
  }

  // Upsert services
  for (const s of Object.values(data.services)) {
    await query(`
      INSERT INTO services (id, title, provider_name, provider_avatar, category, rating,
        reviews_count, price, image, description, location, contact_email, approval_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title, provider_name=EXCLUDED.provider_name,
        provider_avatar=EXCLUDED.provider_avatar, category=EXCLUDED.category,
        rating=EXCLUDED.rating, reviews_count=EXCLUDED.reviews_count, price=EXCLUDED.price,
        image=EXCLUDED.image, description=EXCLUDED.description, location=EXCLUDED.location,
        contact_email=EXCLUDED.contact_email, approval_status=EXCLUDED.approval_status
    `, [s.id, s.title, s.providerName, s.providerAvatar, s.category, s.rating,
        s.reviewsCount, s.price, s.image, s.description, s.location,
        s.contactEmail, s.approvalStatus || 'pending']);
  }

  // Upsert events
  for (const e of Object.values(data.events)) {
    await query(`
      INSERT INTO events (id, title, date, time, location, image, attendees_count,
        category, description, organizer_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title, date=EXCLUDED.date, time=EXCLUDED.time,
        location=EXCLUDED.location, image=EXCLUDED.image,
        attendees_count=EXCLUDED.attendees_count, category=EXCLUDED.category,
        description=EXCLUDED.description, organizer_name=EXCLUDED.organizer_name
    `, [e.id, e.title, e.date, e.time, e.location, e.image,
        e.attendeesCount, e.category, e.description, e.organizerName]);
  }

  // Upsert notifications (flat)
  for (const userNotifs of Object.values(data.notifications || {})) {
    for (const n of userNotifs) {
      await query(`
        INSERT INTO notifications (id, user_id, type, title, message, timestamp, is_read)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET is_read=EXCLUDED.is_read, message=EXCLUDED.message
      `, [n.id, n.userId, n.type, n.title, n.message, n.timestamp, n.read]);
    }
  }

  // Upsert messages (flat)
  for (const threadMsgs of Object.values(data.messages || {})) {
    for (const m of threadMsgs) {
      await query(`
        INSERT INTO messages (id, thread_id, sender_id, sender_name, sender_avatar, text, timestamp)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO NOTHING
      `, [m.id, m.threadId, m.senderId, m.senderName, m.senderAvatar, m.text, m.timestamp]);
    }
  }

  // Upsert reports
  for (const r of Object.values(data.reports || {})) {
    await query(`
      INSERT INTO reports (id, target_type, target_id, target_title, reason, reporter_name, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status
    `, [r.id, r.targetType, r.targetId, r.targetTitle, r.reason, r.reporterName, r.status]);
  }

  // Upsert audit logs
  for (const l of (data.auditLogs || [])) {
    await query(`
      INSERT INTO audit_logs (id, admin_name, action, details, timestamp)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO NOTHING
    `, [l.id, l.adminName, l.action, l.details, l.timestamp]);
  }

  // Sync follows table from in-memory follows dict
  // (individual follow/unfollow ops are handled directly in the animals route)
}

// ─── SEED ─────────────────────────────────────────────────────────────────

async function seedAll(data: DatabaseSchema) {
  // Insert in dependency order: users → animals → posts → products → services → events → …
  for (const u of Object.values(data.users)) {
    await query(`
      INSERT INTO users (id, name, username, email, avatar, bio, role, status, subscription_plan, animals, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO NOTHING
    `, [u.id, u.name, u.username, u.email, u.avatar, u.bio, u.role, u.status,
        u.subscriptionPlan, u.animals, u.createdAt]);
  }

  for (const a of Object.values(data.animals)) {
    await query(`
      INSERT INTO animals (id, name, username, avatar, cover_image, breed, age, location, bio,
        handler_id, handler_name, followers_count, following_count, photos, is_verified, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO NOTHING
    `, [a.id, a.name, a.username, a.avatar, a.coverImage, a.breed, a.age, a.location,
        a.bio, a.handlerId, a.handlerName, a.followersCount, a.followingCount,
        a.photos, a.isVerified, a.createdAt]);
  }

  for (const p of Object.values(data.posts)) {
    await query(`
      INSERT INTO posts (id, animal_id, animal_name, animal_avatar, animal_username,
        video_url, image_url, caption, likes_count, comments_count, shares_count, tags, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO NOTHING
    `, [p.id, p.animalId, p.animalName, p.animalAvatar, p.animalUsername,
        p.videoUrl, p.imageUrl, p.caption, p.likesCount, p.commentsCount, p.sharesCount,
        p.tags, p.createdAt]);
  }

  for (const p of Object.values(data.products)) {
    await query(`
      INSERT INTO products (id, title, price, currency, category, image, rating, reviews_count,
        description, seller_id, seller_name, seller_avatar, in_stock, approval_status, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO NOTHING
    `, [p.id, p.title, p.price, p.currency, p.category, p.image, p.rating, p.reviewsCount,
        p.description, p.sellerId, p.sellerName, p.sellerAvatar, p.inStock,
        p.approvalStatus || 'approved', p.tags]);
  }

  for (const s of Object.values(data.services)) {
    await query(`
      INSERT INTO services (id, title, provider_name, provider_avatar, category, rating,
        reviews_count, price, image, description, location, contact_email, approval_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO NOTHING
    `, [s.id, s.title, s.providerName, s.providerAvatar, s.category, s.rating,
        s.reviewsCount, s.price, s.image, s.description, s.location,
        s.contactEmail, s.approvalStatus || 'approved']);
  }

  for (const e of Object.values(data.events)) {
    await query(`
      INSERT INTO events (id, title, date, time, location, image, attendees_count, category, description, organizer_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO NOTHING
    `, [e.id, e.title, e.date, e.time, e.location, e.image,
        e.attendeesCount, e.category, e.description, e.organizerName]);
  }

  for (const notifs of Object.values(data.notifications || {})) {
    for (const n of notifs) {
      await query(`
        INSERT INTO notifications (id, user_id, type, title, message, timestamp, is_read)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING
      `, [n.id, n.userId, n.type, n.title, n.message, n.timestamp, n.read]);
    }
  }

  for (const msgs of Object.values(data.messages || {})) {
    for (const m of msgs) {
      await query(`
        INSERT INTO messages (id, thread_id, sender_id, sender_name, sender_avatar, text, timestamp)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING
      `, [m.id, m.threadId, m.senderId, m.senderName, m.senderAvatar, m.text, m.timestamp]);
    }
  }

  for (const r of Object.values(data.reports || {})) {
    await query(`
      INSERT INTO reports (id, target_type, target_id, target_title, reason, reporter_name, status, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING
    `, [r.id, r.targetType, r.targetId, r.targetTitle, r.reason, r.reporterName, r.status, r.createdAt]);
  }

  for (const l of (data.auditLogs || [])) {
    await query(`
      INSERT INTO audit_logs (id, admin_name, action, details, timestamp)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING
    `, [l.id, l.adminName, l.action, l.details, l.timestamp]);
  }
}
