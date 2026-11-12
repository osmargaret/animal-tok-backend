import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import fs from "fs";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { getDb } from "./db";

import { authRouter } from "./routes/auth";
import { createAnimalsRouter } from "./routes/animals";
import { createFeedRouter } from "./routes/feed";
import { marketplaceRouter } from "./routes/marketplace";
import { eventsRouter } from "./routes/events";
import { createNotificationsRouter } from "./routes/notifications";
import { createMessagesRouter } from "./routes/messages";
import { adminRouter } from "./routes/admin";
import { uploadRouter } from "./routes/upload";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure uploads folder exists and serve it statically
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Initialize Database on launch
getDb().then(() => {
  console.log("⚡ Database initialized successfully.");
});

// Real-Time Socket.IO Handlers
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Room subscriptions
  socket.on("join_user", (userId: string) => {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined user_${userId}`);
  });

  socket.on("leave_user", (userId: string) => {
    socket.leave(`user_${userId}`);
  });

  socket.on("join_profile", (profileId: string) => {
    socket.join(`profile_${profileId}`);
    console.log(`Socket ${socket.id} joined profile_${profileId}`);
  });

  socket.on("join_thread", (threadId: string) => {
    socket.join(`thread_${threadId}`);
    console.log(`Socket ${socket.id} joined thread_${threadId}`);
  });

  socket.on("leave_thread", (threadId: string) => {
    socket.leave(`thread_${threadId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "AnimalTok Backend API",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Register Routers
app.use("/api/auth", authRouter);
app.use("/api/animals", createAnimalsRouter(io));
app.use("/api/follow", createAnimalsRouter(io)); // Support legacy /api/follow routes
app.use("/api/animal", createAnimalsRouter(io)); // Support legacy /api/animal/:id route
app.use("/api/feed", createFeedRouter(io));
app.use("/api/posts", createFeedRouter(io));
app.use("/api/marketplace", marketplaceRouter);
app.use("/api/events", eventsRouter);
app.use("/api/notifications", createNotificationsRouter(io));
app.use("/api/messages", createMessagesRouter(io));
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRouter);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 AnimalTok Server listening on port ${PORT}`);
});
