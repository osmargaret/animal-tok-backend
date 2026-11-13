import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { getDb, saveDb } from "../db";
import { Server } from "socket.io";
import { Post, PostComment } from "../types";
import { uploadUrlOrBase64ToCloudinary } from "../lib/cloudinary";

const uploadsDir = path.join(__dirname, "../../uploads");

function saveBase64Locally(data: string): string {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let ext = ".jpg";
  let buffer: Buffer;

  if (matches && matches.length === 3) {
    const mime = matches[1];
    if (mime.includes("video")) ext = ".mp4";
    else if (mime.includes("png")) ext = ".png";
    else if (mime.includes("gif")) ext = ".gif";
    else if (mime.includes("audio")) ext = ".mp3";
    buffer = Buffer.from(matches[2], "base64");
  } else {
    buffer = Buffer.from(data, "base64");
  }

  const filename = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

export function createFeedRouter(io: Server) {
  const router = Router();

  // Get Video Feed with pagination support
  router.get("/", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const allPosts = Object.values(db.posts).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
      const startIndex = (page - 1) * limit;
      const paginatedPosts = allPosts.slice(startIndex, startIndex + limit);
      const hasMore = startIndex + limit < allPosts.length;

      res.setHeader("X-Total-Count", allPosts.length);
      res.setHeader("X-Page", page);
      res.setHeader("X-Has-More", String(hasMore));

      res.json(paginatedPosts);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch feed" });
    }
  });

  // Create new Post
  router.post("/", async (req: Request, res: Response) => {
    try {
      let { animalId, animalName, animalUsername, animalAvatar, caption, videoUrl, imageUrl, tags, audioUrl, audioName } = req.body;
      const db = await getDb();

      const hostUrl = `${req.protocol}://${req.get("host")}`;

      // If media is base64, try Cloudinary with 2.5s timeout, then fall back to local disk
      if (videoUrl && videoUrl.startsWith("data:")) {
        try {
          const up = await Promise.race([
            uploadUrlOrBase64ToCloudinary(videoUrl, "animaltok/posts", "video"),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Cloudinary timeout")), 2500))
          ]);
          videoUrl = up.secure_url;
          if (!imageUrl) imageUrl = up.secure_url;
        } catch (err) {
          console.warn("Cloudinary video base64 upload failed, saving to local disk:", err);
          const localPath = saveBase64Locally(videoUrl);
          videoUrl = `${hostUrl}${localPath}`;
          if (!imageUrl) imageUrl = videoUrl;
        }
      }

      if (imageUrl && imageUrl.startsWith("data:")) {
        try {
          const up = await Promise.race([
            uploadUrlOrBase64ToCloudinary(imageUrl, "animaltok/posts", "image"),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Cloudinary timeout")), 2500))
          ]);
          imageUrl = up.secure_url;
        } catch (err) {
          console.warn("Cloudinary image base64 upload failed, saving to local disk:", err);
          const localPath = saveBase64Locally(imageUrl);
          imageUrl = `${hostUrl}${localPath}`;
        }
      }
      
      let animal = db.animals[animalId || ""];
      if (!animal && animalName) {
        animal = Object.values(db.animals).find(
          (a) => a.name.toLowerCase() === animalName.toLowerCase()
        );
      }
      if (!animal) {
        const newAnimalId = animalId || `a_${Date.now()}`;
        animal = {
          id: newAnimalId,
          name: animalName || "Pet",
          username: animalUsername || `@${(animalName || "pet").toLowerCase().replace(/\s+/g, "")}.pet`,
          avatar: animalAvatar || "🐾",
          coverImage: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&auto=format&fit=crop&q=80",
          photos: imageUrl ? [imageUrl] : [],
          breed: "Pet",
          age: "1 yr",
          location: "Global",
          bio: "",
          handlerId: "u_1",
          handlerName: "Handler",
          followersCount: 0,
          followingCount: 0,
          isVerified: true,
          createdAt: new Date().toISOString(),
        };
        db.animals[newAnimalId] = animal;
      } else if (animalName) {
        // Sync any updated pet details
        animal.name = animalName;
        if (animalUsername) animal.username = animalUsername;
        if (animalAvatar) animal.avatar = animalAvatar;
      }

      if (imageUrl && Array.isArray(animal.photos) && !animal.photos.includes(imageUrl)) {
        animal.photos.unshift(imageUrl);
      }

      const postId = `post_${Date.now()}`;
      const newPost: Post = {
        id: postId,
        animalId: animal.id,
        animalName: animalName || animal.name,
        animalAvatar: animalAvatar || animal.avatar,
        animalUsername: animalUsername || animal.username,
        videoUrl: videoUrl || "",
        imageUrl: imageUrl || (animal.photos && animal.photos[0]) || "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=700&fit=crop",
        caption: caption || "Check out my new video! 🐾",
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        tags: tags || ["AnimalTok"],
        audioUrl,
        audioName,
        createdAt: new Date().toISOString()
      };

      db.posts[postId] = newPost;

      // Realtime broadcast instantly
      io.emit("post_created", newPost);

      res.status(201).json(newPost);

      // Persist to Neon PostgreSQL asynchronously in background
      saveDb(db).catch((e) => console.error("Async saveDb error on post_created:", e));
    } catch (err) {
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Toggle Like on Post
  router.post("/:postId/like", async (req: Request, res: Response) => {
    const postId = String(req.params.postId);
    const { userId } = req.body;

    try {
      const db = await getDb();
      const post = db.posts[postId];
      if (!post) return res.status(404).json({ error: "Post not found" });

      const likeKey = `${userId || 'guest'}_${postId}`;
      let isLiked = false;

      if (db.likes[likeKey]) {
        delete db.likes[likeKey];
        post.likesCount = Math.max(0, post.likesCount - 1);
      } else {
        db.likes[likeKey] = true;
        post.likesCount += 1;
        isLiked = true;
      }

      // Realtime broadcast instantly
      io.emit("post_stats_updated", { postId, likes: post.likesCount, isLiked });

      res.json({ isLiked, likesCount: post.likesCount });

      // Persist to DB in background
      saveDb(db).catch((e) => console.error("Async saveDb error on like:", e));
    } catch (err) {
      res.status(500).json({ error: "Failed to process like" });
    }
  });

  // Get Comments for a Post
  router.get("/:postId/comments", async (req: Request, res: Response) => {
    try {
      const postId = String(req.params.postId);
      const db = await getDb();
      const comments = db.comments[postId] || [];
      res.json(comments);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Add Comment to Post
  router.post("/:postId/comment", async (req: Request, res: Response) => {
    const postId = String(req.params.postId);
    const { user, avatar, text } = req.body;

    try {
      const db = await getDb();
      const post = db.posts[postId];
      if (!post) return res.status(404).json({ error: "Post not found" });

      if (!db.comments[postId]) db.comments[postId] = [];

      const newComment: PostComment = {
        id: `c_${Date.now()}`,
        postId,
        user: typeof user === "string" ? user : "@guest",
        avatar: typeof avatar === "string" ? avatar : "🐾",
        text: typeof text === "string" ? text : "Awesome!",
        createdAt: new Date().toISOString()
      };

      db.comments[postId].push(newComment);
      post.commentsCount += 1;

      // Realtime broadcast instantly
      io.emit("new_comment", { postId, comment: newComment, totalComments: post.commentsCount });

      res.json({ success: true, comment: newComment, totalComments: post.commentsCount });

      // Persist in background
      saveDb(db).catch((e) => console.error("Async saveDb error on comment:", e));
    } catch (err) {
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // Share Post
  router.post("/:postId/share", async (req: Request, res: Response) => {
    const postId = String(req.params.postId);
    try {
      const db = await getDb();
      const post = db.posts[postId];
      if (!post) return res.status(404).json({ error: "Post not found" });

      post.sharesCount += 1;

      // Realtime broadcast instantly
      io.emit("post_shared", { postId, shares: post.sharesCount });

      res.json({ success: true, sharesCount: post.sharesCount });

      // Persist in background
      saveDb(db).catch((e) => console.error("Async saveDb error on share:", e));
    } catch (err) {
      res.status(500).json({ error: "Failed to share post" });
    }
  });

  // Delete Post
  router.delete("/:postId", async (req: Request, res: Response) => {
    const postId = String(req.params.postId);
    try {
      const db = await getDb();
      if (!db.posts[postId]) {
        // Also check if any post ID matches without prefix
        const matchKey = Object.keys(db.posts).find(k => k === postId || String(k).replace(/^p_/, "") === postId);
        if (!matchKey) {
          return res.status(404).json({ error: "Post not found" });
        }
        delete db.posts[matchKey];
        delete db.comments[matchKey];
      } else {
        delete db.posts[postId];
        delete db.comments[postId];
      }

      // Realtime broadcast deletion
      io.emit("post_deleted", { postId });

      res.json({ success: true, message: "Post deleted successfully" });

      // Persist deletion
      saveDb(db).catch((e) => console.error("Async saveDb error on delete post:", e));
    } catch (err) {
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  return router;
}
