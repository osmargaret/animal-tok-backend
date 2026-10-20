import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { Server } from "socket.io";

export function createAnimalsRouter(io: Server) {
  const router = Router();

  // List all animals
  router.get("/", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      res.json(Object.values(db.animals));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch animals" });
    }
  });

  // Get animal by ID
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const db = await getDb();
      const animal = db.animals[id];
      if (!animal) return res.status(404).json({ error: "Animal profile not found" });

      res.json(animal);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch animal profile" });
    }
  });

  // Check follow status
  router.get("/follow/check", async (req: Request, res: Response) => {
    const { animalId, userId } = req.query as { animalId: string; userId: string };
    if (!animalId || !userId) return res.json({ isFollowing: false });

    try {
      const db = await getDb();
      const followKey = `${userId}_${animalId}`;
      res.json({ isFollowing: !!db.follows[followKey] });
    } catch (err) {
      res.json({ isFollowing: false });
    }
  });

  // Toggle Follow / Unfollow
  router.post("/follow", async (req: Request, res: Response) => {
    const { animalId, userId } = req.body;
    if (!animalId || !userId) return res.status(400).json({ error: "animalId and userId are required" });

    try {
      const db = await getDb();
      const animal = db.animals[animalId];
      if (!animal) return res.status(404).json({ error: "Animal not found" });

      const followKey = `${userId}_${animalId}`;
      let isFollowing = false;

      if (db.follows[followKey]) {
        delete db.follows[followKey];
        animal.followersCount = Math.max(0, animal.followersCount - 1);
      } else {
        db.follows[followKey] = true;
        animal.followersCount += 1;
        isFollowing = true;

        if (animal.handlerId) {
          if (!db.notifications[animal.handlerId]) db.notifications[animal.handlerId] = [];
          db.notifications[animal.handlerId].unshift({
            id: `n_${Date.now()}`,
            userId: animal.handlerId,
            type: "follow",
            title: "New Follower",
            message: `Someone started following ${animal.name}!`,
            timestamp: "Just now",
            read: false
          });
        }
      }

      await saveDb(db);

      // Realtime Broadcast
      io.to(`profile_${animalId}`).emit("followers_updated", { followerCount: animal.followersCount });
      io.emit("animal_updated", animal);

      res.json({ isFollowing, followerCount: animal.followersCount });
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle follow state" });
    }
  });

  return router;
}
