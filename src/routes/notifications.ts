import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { Server } from "socket.io";
import { NotificationItem } from "../types";

export function createNotificationsRouter(io: Server) {
  const router = Router();

  // Get Notifications for User
  router.get("/", async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (!userId || userId === "null" || userId === "undefined") {
        return res.json([]);
      }
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
  router.post("/read-all", async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId as string;
      if (!userId || userId === "null" || userId === "undefined") {
        return res.json({ success: true });
      }
      const db = await getDb();

      if (db.notifications[userId]) {
        db.notifications[userId].forEach(n => { n.read = true; });
        await saveDb(db);
      }

      // Real-time emit to user room that notifications are read
      io.to(`user_${userId}`).emit("notifications_cleared", { userId });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  // Create & send notification directly
  router.post("/send", async (req: Request, res: Response) => {
    try {
      const { userId, type, title, message, threadId } = req.body;
      if (!userId || !title || !message) {
        return res.status(400).json({ error: "userId, title, and message are required" });
      }

      const db = await getDb();
      const newNotification: NotificationItem = {
        id: `n_${Date.now()}`,
        userId,
        type: type || "system",
        title,
        message,
        timestamp: "Just now",
        read: false,
        threadId,
      };

      if (!db.notifications[userId]) db.notifications[userId] = [];
      db.notifications[userId].unshift(newNotification);
      await saveDb(db);

      // Real-time broadcast to the user's personal socket room
      io.to(`user_${userId}`).emit("new_notification", newNotification);

      res.status(201).json(newNotification);
    } catch (err) {
      res.status(500).json({ error: "Failed to dispatch notification" });
    }
  });

  // Register push notification token for user
  router.post("/register-token", async (req: Request, res: Response): Promise<any> => {
    try {
      const { userId, pushToken } = req.body;
      if (!userId || !pushToken) {
        return res.status(400).json({ error: "userId and pushToken are required" });
      }

      const db = await getDb();
      if (db.users[userId]) {
        db.users[userId].pushToken = pushToken;
        await saveDb(db);
        console.log(`📱 Push token registered for user ${userId}: ${pushToken.slice(0, 24)}...`);
      }

      return res.json({ success: true, message: "Push token registered successfully" });
    } catch (err) {
      console.error("Failed to register push token:", err);
      return res.status(500).json({ error: "Failed to register push token" });
    }
  });

  return router;
}
