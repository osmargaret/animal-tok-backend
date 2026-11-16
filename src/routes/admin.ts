import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { AuditLog } from "../types";

export const adminRouter = Router();

// Helper to log admin actions
async function addAuditLog(adminName: string, action: string, details: string) {
  const db = await getDb();
  if (!db.auditLogs) db.auditLogs = [];
  const log: AuditLog = {
    id: `log_${Date.now()}`,
    adminName,
    action,
    details,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  db.auditLogs.unshift(log);
  await saveDb(db);
}

// In-memory / DB state for team members & admin settings
const initialTeamMembers = [
  { id: "team_1", name: "System Admin", email: "admin@animaltok.com", role: "Super Admin", status: "active", invitedAt: "2024-01-01" },
  { id: "team_2", name: "Sarah Moderator", email: "moderator@animaltok.com", role: "Moderator", status: "active", invitedAt: "2024-03-15" }
];

// Admin Dashboard stats
adminRouter.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const db = await getDb();

    const animalsList = Object.values(db.animals);
    const usersList = Object.values(db.users);
    const postsList = Object.values(db.posts);
    const productsList = Object.values(db.products);
    const servicesList = Object.values(db.services);
    const eventsList = Object.values(db.events);
    const reportsList = db.reports ? Object.values(db.reports) : [];
    const auditLogsList = db.auditLogs || [];

    const totalFollows = Object.keys(db.follows).length;
    const totalLikes = Object.keys(db.likes).length;

    const adsList = db.ads ? Object.values(db.ads) : [];
    const soundsList = db.sounds ? Object.values(db.sounds) : [];
    const totalAdImpressions = adsList.reduce((sum, a) => sum + (Number(a.impressions) || 0), 0);
    const totalAdClicks = adsList.reduce((sum, a) => sum + (Number(a.clicks) || 0), 0);
    const activeAdsCount = adsList.filter(a => a.status === 'active').length;

    res.json({
      stats: {
        totalAnimals: animalsList.length,
        totalUsers: usersList.length,
        totalPosts: postsList.length,
        totalProducts: productsList.length,
        totalServices: servicesList.length,
        totalEvents: eventsList.length,
        totalReports: reportsList.filter(r => r.status === 'pending').length,
        totalFollows,
        totalLikes,
        totalAds: adsList.length,
        activeAds: activeAdsCount,
        totalSounds: soundsList.length,
        totalAdImpressions,
        totalAdClicks
      },
      animals: animalsList,
      users: usersList,
      posts: postsList,
      products: productsList,
      services: servicesList,
      events: eventsList,
      reports: reportsList,
      auditLogs: auditLogsList,
      ads: adsList,
      sounds: soundsList,
      teamMembers: (db as any).teamMembers || initialTeamMembers
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin dashboard stats" });
  }
});

// Invite Team Member (Admin / Moderator)
adminRouter.post("/team/invite", async (req: Request, res: Response) => {
  try {
    const { email, role, name } = req.body;
    if (!email || !role) return res.status(400).json({ error: "Email and role are required." });

    const db = await getDb() as any;
    if (!db.teamMembers) db.teamMembers = [...initialTeamMembers];

    const newMember = {
      id: `team_${Date.now()}`,
      name: name || email.split('@')[0],
      email,
      role: role === 'admin' ? 'Admin' : 'Moderator',
      status: 'pending',
      invitedAt: new Date().toISOString().split('T')[0]
    };

    db.teamMembers.push(newMember);
    await saveDb(db);

    await addAuditLog("System Admin", `Invited ${newMember.role}`, `Sent invitation to ${email}`);

    res.status(201).json({ success: true, member: newMember, teamMembers: db.teamMembers });
  } catch (err) {
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

// Update Admin Profile & Credentials
adminRouter.post("/profile/update", async (req: Request, res: Response) => {
  try {
    const { email, name, newPassword } = req.body;
    const db = await getDb();

    await addAuditLog("System Admin", "Updated Profile Settings", `Updated admin email/password credentials`);

    res.json({ success: true, message: "Admin profile credentials updated successfully.", email, name });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Toggle verification status of animal
adminRouter.post("/animals/:id/verify", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    const animal = db.animals[id];
    if (!animal) return res.status(404).json({ error: "Animal not found" });

    animal.isVerified = !animal.isVerified;
    await saveDb(db);

    await addAuditLog("System Admin", animal.isVerified ? "Verified Pet Profile" : "Revoked Verification", `Profile @${animal.username}`);

    res.json({ success: true, animal });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle verification" });
  }
});

// Delete post (Admin moderation)
adminRouter.delete("/posts/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    const post = db.posts[id];
    if (!post) return res.status(404).json({ error: "Post not found" });

    delete db.posts[id];
    delete db.comments[id];
    await saveDb(db);

    await addAuditLog("System Admin", "Deleted Post", `Removed post ${id} by ${post.animalUsername}`);

    res.json({ success: true, message: "Post deleted by admin." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// User Status Management (Ban / Suspend / Reinstate)
adminRouter.post("/users/:id/status", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    const db = await getDb();
    const user = db.users[id];
    if (!user) return res.status(404).json({ error: "User not found" });

    user.status = status || "active";
    await saveDb(db);

    await addAuditLog("System Admin", `Updated User Status to ${status.toUpperCase()}`, `User ${user.name} (@${user.username})`);

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// User Subscription Management
adminRouter.post("/users/:id/subscription", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { subscriptionPlan } = req.body;
    const db = await getDb();
    const user = db.users[id];
    if (!user) return res.status(404).json({ error: "User not found" });

    user.subscriptionPlan = subscriptionPlan || "free";
    await saveDb(db);

    await addAuditLog("System Admin", `Changed Subscription Plan`, `User ${user.name} upgraded/changed to ${subscriptionPlan}`);

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// Moderation Reports Handler (Resolve / Dismiss)
adminRouter.post("/reports/:id/action", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { action } = req.body;
    const db = await getDb();
    if (!db.reports || !db.reports[id]) return res.status(404).json({ error: "Report not found" });

    const report = db.reports[id];
    report.status = action || "resolved";

    await saveDb(db);
    await addAuditLog("System Admin", `Report Action: ${action}`, `Target: ${report.targetTitle}`);

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: "Failed to process report action" });
  }
});

// Marketplace Product / Service Approval Handler
adminRouter.post("/marketplace/:type/:id/approval", async (req: Request, res: Response) => {
  try {
    const type = String(req.params.type);
    const id = String(req.params.id);
    const { status } = req.body;
    const db = await getDb();

    if (type === "product") {
      const prod = db.products[id];
      if (!prod) return res.status(404).json({ error: "Product not found" });
      prod.approvalStatus = status;
      await saveDb(db);
      await addAuditLog("System Admin", `Product ${status.toUpperCase()}`, `${prod.title}`);
      return res.json({ success: true, item: prod });
    } else if (type === "service") {
      const serv = db.services[id];
      if (!serv) return res.status(404).json({ error: "Service not found" });
      serv.approvalStatus = status;
      await saveDb(db);
      await addAuditLog("System Admin", `Service ${status.toUpperCase()}`, `${serv.title}`);
      return res.json({ success: true, item: serv });
    }

    res.status(400).json({ error: "Invalid marketplace item type" });
  } catch (err) {
    res.status(500).json({ error: "Failed to set approval status" });
  }
});

// ─── ADS & PROMOTIONS MANAGEMENT ──────────────────────────────────────────

// Get all ads
adminRouter.get("/ads", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const adsList = db.ads ? Object.values(db.ads) : [];
    res.json(adsList);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ads" });
  }
});

// Create new Ad Campaign (Companies, Vets, Hospitals, Brands)
adminRouter.post("/ads", async (req: Request, res: Response) => {
  try {
    const {
      title,
      advertiserName,
      advertiserAvatar,
      adType,
      mediaUrl,
      caption,
      category,
      sponsorBadge,
      ctaText,
      ctaUrl,
      targetType,
      targetId,
    } = req.body;

    if (!title || !advertiserName || !mediaUrl) {
      return res.status(400).json({ error: "Title, advertiserName, and mediaUrl are required." });
    }

    const db = await getDb();
    if (!db.ads) db.ads = {};

    const newAd = {
      id: `ad_${Date.now()}`,
      title: title.trim(),
      advertiserName: advertiserName.trim(),
      advertiserAvatar: advertiserAvatar || "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=150&auto=format&fit=crop&q=80",
      adType: adType || "video",
      mediaUrl: mediaUrl.trim(),
      caption: caption || "",
      category: category || "Vet Care",
      sponsorBadge: sponsorBadge || "Sponsored",
      ctaText: ctaText || "Learn More",
      ctaUrl: ctaUrl || "https://animandler.app",
      status: "active" as const,
      targetType: (targetType || "external") as any,
      targetId: targetId || undefined,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };

    db.ads[newAd.id] = newAd;
    await saveDb(db);

    await addAuditLog("System Admin", `Created ${newAd.adType.toUpperCase()} Ad Campaign`, `"${newAd.title}" for ${newAd.advertiserName}`);

    res.status(201).json({ success: true, ad: newAd });
  } catch (err) {
    res.status(500).json({ error: "Failed to create ad campaign" });
  }
});

// Quick-Promote an in-app Post, Event, or Service into an Ad
adminRouter.post("/ads/promote", async (req: Request, res: Response) => {
  try {
    const { targetType, targetId, customCtaText, sponsorBadge } = req.body;
    if (!targetType || !targetId) {
      return res.status(400).json({ error: "targetType and targetId are required." });
    }

    const db = await getDb();
    if (!db.ads) db.ads = {};

    let title = "";
    let advertiserName = "";
    let advertiserAvatar = "";
    let adType: "video" | "image" | "audio" = "video";
    let mediaUrl = "";
    let caption = "";
    let category = "Promoted";
    let ctaText = customCtaText || "View on Animandler";
    let ctaUrl = `https://animandler.app/${targetType}/${targetId}`;

    if (targetType === "post") {
      const post = db.posts[targetId];
      if (!post) return res.status(404).json({ error: "Post not found" });
      title = `Promoted Video: ${post.animalName}`;
      advertiserName = post.animalName || post.animalUsername;
      advertiserAvatar = post.animalAvatar;
      adType = post.videoUrl ? "video" : "image";
      mediaUrl = post.videoUrl || post.imageUrl || "";
      caption = post.caption;
      category = "Pet Video";
      ctaText = customCtaText || "Follow Pet 🐾";
    } else if (targetType === "service") {
      const serv = db.services[targetId];
      if (!serv) return res.status(404).json({ error: "Service not found" });
      title = serv.title;
      advertiserName = serv.providerName;
      advertiserAvatar = serv.providerAvatar;
      adType = "image";
      mediaUrl = serv.image;
      caption = serv.description;
      category = serv.category || "Pet Service";
      ctaText = customCtaText || `Book Service (${serv.price}) 🩺`;
    } else if (targetType === "event") {
      const ev = db.events[targetId];
      if (!ev) return res.status(404).json({ error: "Event not found" });
      title = ev.title;
      advertiserName = ev.organizerName;
      advertiserAvatar = ev.image;
      adType = "image";
      mediaUrl = ev.image;
      caption = `${ev.date} @ ${ev.location} - ${ev.description}`;
      category = ev.category || "Pet Event";
      ctaText = customCtaText || "Join Event 📅";
    }

    const newAd = {
      id: `ad_promo_${Date.now()}`,
      title,
      advertiserName,
      advertiserAvatar,
      adType,
      mediaUrl,
      caption,
      category,
      sponsorBadge: sponsorBadge || "Promoted",
      ctaText,
      ctaUrl,
      status: "active" as const,
      targetType: targetType as any,
      targetId,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };

    db.ads[newAd.id] = newAd;
    await saveDb(db);

    await addAuditLog("System Admin", `Promoted ${targetType.toUpperCase()}`, `Boosted "${title}" to feed ads`);

    res.status(201).json({ success: true, ad: newAd });
  } catch (err) {
    res.status(500).json({ error: "Failed to promote item" });
  }
});

// Update Ad Campaign (status, details)
adminRouter.put("/ads/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    if (!db.ads || !db.ads[id]) return res.status(404).json({ error: "Ad not found" });

    const ad = db.ads[id];
    const allowed = ["title", "advertiserName", "advertiserAvatar", "adType", "mediaUrl", "caption", "category", "sponsorBadge", "ctaText", "ctaUrl", "status"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (ad as any)[key] = req.body[key];
      }
    }

    await saveDb(db);
    await addAuditLog("System Admin", `Updated Ad`, `Modified ad "${ad.title}"`);
    res.json({ success: true, ad });
  } catch (err) {
    res.status(500).json({ error: "Failed to update ad" });
  }
});

// Delete Ad Campaign
adminRouter.delete("/ads/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    if (!db.ads || !db.ads[id]) return res.status(404).json({ error: "Ad not found" });

    const title = db.ads[id].title;
    delete db.ads[id];
    await saveDb(db);

    await addAuditLog("System Admin", `Deleted Ad Campaign`, `Removed "${title}"`);
    res.json({ success: true, message: "Ad deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete ad" });
  }
});

// ─── PROMOTED SOUNDS & ARTIST TRACKS ──────────────────────────────────────

// Get all sounds (for admin)
adminRouter.get("/sounds", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const soundsList = db.sounds ? Object.values(db.sounds) : [];
    res.json(soundsList);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sounds" });
  }
});

// Add Promoted Artist Track
adminRouter.post("/sounds", async (req: Request, res: Response) => {
  try {
    const { title, artist, previewUrl, coverUrl, category, duration, sponsorBadge, externalUrl } = req.body;
    if (!title || !artist || !previewUrl) {
      return res.status(400).json({ error: "Title, artist, and previewUrl are required." });
    }

    const db = await getDb();
    if (!db.sounds) db.sounds = {};

    const newSound = {
      id: `sound_${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      previewUrl: previewUrl.trim(),
      coverUrl: coverUrl || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80",
      category: category || "Promoted",
      duration: duration || "0:30",
      isPromoted: true,
      sponsorBadge: sponsorBadge || "Artist Spotlight",
      usageCount: "Active Track",
      externalUrl: externalUrl || undefined,
      status: "active" as const,
      createdAt: new Date().toISOString()
    };

    db.sounds[newSound.id] = newSound as any;
    await saveDb(db);

    await addAuditLog("System Admin", `Added Promoted Song`, `"${newSound.title}" by ${newSound.artist}`);

    res.status(201).json({ success: true, sound: newSound });
  } catch (err) {
    res.status(500).json({ error: "Failed to add promoted sound" });
  }
});

// Delete or archive Sound
adminRouter.delete("/sounds/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    if (!db.sounds || !db.sounds[id]) return res.status(404).json({ error: "Sound not found" });

    const track = db.sounds[id].title;
    delete db.sounds[id];
    await saveDb(db);

    await addAuditLog("System Admin", `Removed Sound`, `Deleted track "${track}"`);
    res.json({ success: true, message: "Sound removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete sound" });
  }
});
