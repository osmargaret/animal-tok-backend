import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { Server } from "socket.io";
import { Post, PostComment } from "../types";
import { uploadUrlOrBase64ToCloudinary } from "../lib/cloudinary";

export function createFeedRouter(io: Server) {
  const router = Router();

  // Get Video Feed
  router.get("/", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const posts = Object.values(db.posts).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(posts);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch feed" });
    }
  });

  // Create new Post
  router.post("/", async (req: Request, res: Response) => {
    try {
      let { animalId, caption, videoUrl, imageUrl, tags, audioUrl, audioName } = req.body;
      const db = await getDb();

      // If media is base64, automatically upload to Cloudinary
      if (videoUrl && videoUrl.startsWith("data:")) {
        try {
          const up = await uploadUrlOrBase64ToCloudinary(videoUrl, "animaltok/posts", "video");
          videoUrl = up.secure_url;
          if (!imageUrl) imageUrl = up.secure_url;
        } catch (err) {
          console.warn("Cloudinary video base64 upload error:", err);
        }
      }

      if (imageUrl && imageUrl.startsWith("data:")) {
        try {
          const up = await uploadUrlOrBase64ToCloudinary(imageUrl, "animaltok/posts", "image");
          imageUrl = up.secure_url;
        } catch (err) {
          console.warn("Cloudinary image base64 upload error:", err);
        }
      }
      
      const animal = db.animals[animalId || "1"] || {
        id: animalId || "1",
        name: "Bailey",
        username: "@bailey.thelab",
        avatar: "🐕",
        photos: ["https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&auto=format&fit=crop&q=80"]
      };

      const postId = `post_${Date.now()}`;
      const newPost: Post = {
        id: postId,
        animalId: animal.id,
        animalName: animal.name,
        animalAvatar: animal.avatar,
        animalUsername: animal.username,
        videoUrl: videoUrl || "https://cdn.pixabay.com/video/2020/05/25/40130-424930032_large.mp4",
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
      await saveDb(db);

      // Realtime broadcast
      io.emit("post_created", newPost);

      res.status(201).json(newPost);
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

      await saveDb(db);

      // Broadcast
      io.emit("post_stats_updated", { postId, likes: post.likesCount, isLiked });

      res.json({ isLiked, likesCount: post.likesCount });
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

      await saveDb(db);

      // Broadcast
      io.emit("new_comment", { postId, comment: newComment, totalComments: post.commentsCount });

      res.json({ success: true, comment: newComment, totalComments: post.commentsCount });
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
      await saveDb(db);

      io.emit("post_shared", { postId, shares: post.sharesCount });

      res.json({ success: true, sharesCount: post.sharesCount });
    } catch (err) {
      res.status(500).json({ error: "Failed to share post" });
    }
  });

  return router;
}
