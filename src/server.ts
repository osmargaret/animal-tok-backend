import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { getDb } from "./db";

import { authRouter } from "./routes/auth";
import { createAnimalsRouter } from "./routes/animals";
import { createFeedRouter } from "./routes/feed";
import { marketplaceRouter } from "./routes/marketplace";
import { eventsRouter } from "./routes/events";
import { notificationsRouter } from "./routes/notifications";
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
app.use(express.json());

// Initialize Database on launch
getDb().then(() => {
  console.log("⚡ Database initialized successfully.");
});

// Real-Time Socket.IO Handlers
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Room subscriptions
  socket.on("join_profile", (profileId: string) => {
    socket.join(`profile_${profileId}`);
    console.log(`Socket ${socket.id} joined profile_${profileId}`);
  });

  socket.on("join_thread", (threadId: string) => {
    socket.join(`thread_${threadId}`);
    console.log(`Socket ${socket.id} joined thread_${threadId}`);
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
app.use("/api/notifications", notificationsRouter);
app.use("/api/messages", createMessagesRouter(io));
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRouter);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 AnimalTok Server listening on port ${PORT}`);
});
