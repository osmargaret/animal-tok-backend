import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { Server } from "socket.io";
import { MessageItem, NotificationItem } from "../types";
import { sendExpoPushNotification } from "../lib/pushNotifications";

export function createMessagesRouter(io: Server) {
  const router = Router();

  // Get conversation inbox / threads list for a user
  router.get("/threads", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || "u_3";
      const db = await getDb();

      // Gather all threads where the user has participated or is the recipient
      const userThreads: Record<string, {
        threadId: string;
        lastMessage: MessageItem;
        participant: {
          id: string;
          name: string;
          avatar: string;
          role?: string;
        };
        unreadCount: number;
      }> = {};

      for (const [threadId, msgs] of Object.entries(db.messages)) {
        if (!Array.isArray(msgs) || msgs.length === 0) continue;

        // Check if user is part of this thread
        const isParticipant = msgs.some(
          (m) => m.senderId === userId || m.recipientId === userId
        ) || threadId.includes(userId);

        if (!isParticipant) continue;

        const lastMsg = msgs[msgs.length - 1];

        // Find the other participant
        let otherUserId = "";
        let otherUserName = "";
        let otherUserAvatar = "";

        const otherMsg = msgs.find((m) => m.senderId && m.senderId !== userId);
        if (otherMsg) {
          otherUserId = otherMsg.senderId;
          otherUserName = otherMsg.senderName || "";
          otherUserAvatar = otherMsg.senderAvatar || "";
        }

        // If not found yet, check any message that has recipientName
        if (!otherUserName) {
          const msgWithRecipient = msgs.find((m) => m.recipientName);
          if (msgWithRecipient) {
            otherUserName = msgWithRecipient.recipientName!;
            otherUserAvatar = msgWithRecipient.recipientAvatar || otherUserAvatar;
          }
        }

        // Check threadMeta
        if (!otherUserName && db.threadMeta && db.threadMeta[threadId]) {
          otherUserName = db.threadMeta[threadId].recipientName || "";
          otherUserAvatar = db.threadMeta[threadId].recipientAvatar || otherUserAvatar;
          if (!otherUserId) otherUserId = db.threadMeta[threadId].recipientId || "";
        }

        // Check if lastMsg has recipientId
        if (!otherUserName && lastMsg.recipientId && lastMsg.recipientId !== userId) {
          otherUserId = lastMsg.recipientId;
          const u = db.users[otherUserId];
          if (u) {
            otherUserName = u.businessName || u.clinicName || u.name;
            otherUserAvatar = u.avatar;
          }
        }

        // If threadId is trade_... or booking_...
        if (!otherUserName && threadId.startsWith("trade_")) {
          const raw = threadId.replace(/^trade_/, "").replace(/_/g, " ");
          otherUserName = raw.replace(/\b\w/g, (c) => c.toUpperCase());
          const prod = Object.values(db.products || {}).find(
            (p) => p.sellerName?.toLowerCase() === otherUserName.toLowerCase()
          );
          if (prod) {
            otherUserAvatar = prod.sellerAvatar || prod.image;
          } else {
            otherUserAvatar = "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&fit=crop";
          }
        } else if (!otherUserName && threadId.startsWith("booking_")) {
          const raw = threadId.replace(/^booking_/, "").replace(/_/g, " ");
          otherUserName = raw.replace(/\b\w/g, (c) => c.toUpperCase());
          const serv = Object.values(db.services || {}).find(
            (s) => s.providerName?.toLowerCase() === otherUserName.toLowerCase()
          );
          if (serv) {
            otherUserAvatar = serv.providerAvatar || serv.image;
          } else {
            otherUserAvatar = "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400&fit=crop";
          }
        } else if (
          !otherUserName &&
          (threadId.startsWith("t_animal_") || threadId.startsWith("animal_") || db.animals[threadId])
        ) {
          const animalKey = threadId.replace(/^t_animal_/, "").replace(/^animal_/, "").split("_")[0];
          const animal = db.animals[animalKey] || db.animals[threadId];
          if (animal) {
            otherUserId = animal.handlerId || animal.id;
            otherUserName = animal.handlerName || `${animal.name}'s Handler`;
            otherUserAvatar = animal.avatar || (animal.photos && animal.photos[0]) || "";
          }
        }

        if (!otherUserName) {
          otherUserName = "Pet Partner";
          otherUserAvatar = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200&fit=crop";
        }

        userThreads[threadId] = {
          threadId,
          lastMessage: lastMsg,
          participant: {
            id: otherUserId || "unknown",
            name: otherUserName,
            avatar: otherUserAvatar,
          },
          unreadCount: 0,
        };
      }

      // Convert to array and sort by latest message
      const threadsList = Object.values(userThreads).sort((a, b) => {
        const timeA = new Date(a.lastMessage.timestamp || 0).getTime() || 0;
        const timeB = new Date(b.lastMessage.timestamp || 0).getTime() || 0;
        return timeB - timeA;
      });

      res.json(threadsList);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
      res.status(500).json({ error: "Failed to fetch inbox threads" });
    }
  });

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
      const {
        threadId,
        senderId,
        recipientId,
        text,
        senderName,
        senderAvatar,
        recipientName,
        recipientAvatar,
      } = req.body;
      const db = await getDb();

      if (!threadId || !text) {
        return res.status(400).json({ error: "threadId and text are required" });
      }

      const user = db.users[senderId] || (senderId ? { id: senderId, name: senderName || "User", avatar: senderAvatar || "👤" } : db.users["u_3"] || { id: "u_3", name: "User", avatar: "👤" });

      const finalSenderId = user.id || senderId || "u_3";
      const finalSenderName = senderName || user.name || "User";
      const finalSenderAvatar = senderAvatar || user.avatar || "👤";

      const messageId = `m_${Date.now()}`;
      const newMessage: MessageItem = {
        id: messageId,
        threadId,
        senderId: finalSenderId,
        recipientId: recipientId || undefined,
        recipientName: recipientName || undefined,
        recipientAvatar: recipientAvatar || undefined,
        senderName: finalSenderName,
        senderAvatar: finalSenderAvatar,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (!db.messages[threadId]) db.messages[threadId] = [];
      db.messages[threadId].push(newMessage);

      if (!db.threadMeta) db.threadMeta = {};
      if (recipientName || recipientAvatar || recipientId) {
        db.threadMeta[threadId] = {
          recipientId: recipientId || db.threadMeta[threadId]?.recipientId,
          recipientName: recipientName || db.threadMeta[threadId]?.recipientName,
          recipientAvatar: recipientAvatar || db.threadMeta[threadId]?.recipientAvatar,
        };
      }

      // Create a notification for the recipient if recipientId exists and is different from sender
      let notif: NotificationItem | null = null;
      if (recipientId && recipientId !== finalSenderId) {
        notif = {
          id: `n_${Date.now()}`,
          userId: recipientId,
          type: "message",
          title: `Message from ${finalSenderName}`,
          message: text.length > 50 ? `${text.slice(0, 47)}...` : text,
          timestamp: "Just now",
          read: false,
          threadId,
        };

        if (!db.notifications[recipientId]) db.notifications[recipientId] = [];
        db.notifications[recipientId].unshift(notif);
      }

      // Realtime emit to thread room immediately (for viewers in this chat screen)
      io.to(`thread_${threadId}`).emit("new_message", newMessage);

      // Realtime emit to recipient's personal room immediately (for inbox badges / active alert)
      if (recipientId) {
        io.to(`user_${recipientId}`).emit("new_message_alert", {
          threadId,
          message: newMessage,
        });

        if (notif) {
          io.to(`user_${recipientId}`).emit("new_notification", notif);
        }

        // Send background push notification if recipient has registered a device push token
        const recipientUser = db.users[recipientId];
        if (recipientUser?.pushToken) {
          sendExpoPushNotification(
            recipientUser.pushToken,
            `🐾 Message from ${finalSenderName}`,
            text.length > 80 ? `${text.slice(0, 77)}...` : text,
            { threadId, recipientId, senderId: finalSenderId }
          ).catch((e) => console.warn("Failed background push:", e));
        }
      }

      // Legacy fallback emit
      io.emit("message_received", newMessage);

      res.status(201).json(newMessage);

      // Persist to database in background
      saveDb(db).catch((e) => console.error("Async saveDb error on message:", e));
    } catch (err) {
      console.error("Failed to send message:", err);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  return router;
}
