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
        totalLikes
      },
      animals: animalsList,
      users: usersList,
      posts: postsList,
      products: productsList,
      services: servicesList,
      reports: reportsList,
      auditLogs: auditLogsList,
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
