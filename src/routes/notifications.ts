import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";

export const notificationsRouter = Router();

// Get Notifications for User
notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || "u_3";
    const db = await getDb();
    const notifications = db.notifications[userId] || [
      {
        id: "n_default",
        userId,
        type: "system",
        title: "Welcome to AnimalTok!",
        message: "Explore pet videos, connect with handlers, and enjoy pet events!",
        timestamp: "1h ago",
        read: false
      }
    ];

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark Notifications as read
notificationsRouter.post("/read-all", async (req: Request, res: Response) => {
  try {
    const userId = (req.body.userId as string) || "u_3";
    const db = await getDb();

    if (db.notifications[userId]) {
      db.notifications[userId].forEach(n => { n.read = true; });
      await saveDb(db);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});
