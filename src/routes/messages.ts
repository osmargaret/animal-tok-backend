import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { Server } from "socket.io";
import { MessageItem } from "../types";

export function createMessagesRouter(io: Server) {
  const router = Router();

  // Get chat thread messages
  router.get("/:threadId", async (req: Request, res: Response) => {
    try {
      const threadId = String(req.params.threadId);
      const db = await getDb();
      const messages = db.messages[threadId] || [];
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch thread messages" });
    }
  });

  // Send message to thread
  router.post("/send", async (req: Request, res: Response) => {
    try {
      const { threadId, senderId, text } = req.body;
      const db = await getDb();

      if (!threadId || !text) {
        return res.status(400).json({ error: "threadId and text are required" });
      }

      const user = db.users[senderId || "u_3"] || db.users["u_3"];

      const messageId = `m_${Date.now()}`;
      const newMessage: MessageItem = {
        id: messageId,
        threadId,
        senderId: user.id,
        senderName: user.name,
        senderAvatar: user.avatar,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (!db.messages[threadId]) db.messages[threadId] = [];
      db.messages[threadId].push(newMessage);

      await saveDb(db);

      // Realtime emit
      io.to(`thread_${threadId}`).emit("new_message", newMessage);
      io.emit("message_received", newMessage);

      res.status(201).json(newMessage);
    } catch (err) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  return router;
}
