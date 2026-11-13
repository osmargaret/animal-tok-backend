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

  // Get animal by ID (or name / username)
  router.get("/:id", async (req: Request, res: Response): Promise<any> => {
    try {
      const id = String(req.params.id);
      const db = await getDb();
      let animal = db.animals[id];
      if (!animal) {
        animal = Object.values(db.animals).find(
          (a) =>
            a.id.toLowerCase() === id.toLowerCase() ||
            a.name.toLowerCase() === id.toLowerCase() ||
            a.username.toLowerCase() === id.toLowerCase() ||
            a.username.toLowerCase() === `@${id.toLowerCase()}`
        );
      }
      if (!animal) return res.status(404).json({ error: "Animal profile not found" });

      return res.json({
        ...animal,
        followers: animal.followersCount ?? 0,
        handler: animal.handlerName || "Alex Morgan",
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch animal profile" });
    }
  });

  // Check follow status
  const handleCheckFollow = async (req: Request, res: Response) => {
    const { animalId, userId } = req.query as { animalId: string; userId: string };
    if (!animalId || !userId) return res.json({ isFollowing: false });

    try {
      const db = await getDb();
      let targetId = animalId;
      if (!db.animals[animalId]) {
        const found = Object.entries(db.animals).find(
          ([key, a]) =>
            key.toLowerCase() === animalId.toLowerCase() ||
            a.id.toLowerCase() === animalId.toLowerCase() ||
            a.name.toLowerCase() === animalId.toLowerCase() ||
            a.username.toLowerCase() === animalId.toLowerCase() ||
            a.username.toLowerCase() === `@${animalId.toLowerCase()}`
        );
        if (found) targetId = found[0];
      }
      const isFollowing = !!(db.follows[`${userId}_${targetId}`] || db.follows[`${userId}_${animalId}`]);
      res.json({ isFollowing });
    } catch (err) {
      res.json({ isFollowing: false });
    }
  };
  router.get("/follow/check", handleCheckFollow);
  router.get("/check", handleCheckFollow);

  // Toggle Follow / Unfollow
  const handleToggleFollow = async (req: Request, res: Response) => {
    const { animalId, userId } = req.body;
    if (!animalId || !userId) return res.status(400).json({ error: "animalId and userId are required" });

    try {
      const db = await getDb();
      let animal = db.animals[animalId];
      let targetId = animalId;

      if (!animal) {
        const found = Object.entries(db.animals).find(
          ([key, a]) =>
            key.toLowerCase() === animalId.toLowerCase() ||
            a.id.toLowerCase() === animalId.toLowerCase() ||
            a.name.toLowerCase() === animalId.toLowerCase() ||
            a.username.toLowerCase() === animalId.toLowerCase() ||
            a.username.toLowerCase() === `@${animalId.toLowerCase()}`
        );
        if (found) {
          targetId = found[0];
          animal = found[1];
        }
      }

      if (!animal) return res.status(404).json({ error: "Animal not found" });

      const followKey1 = `${userId}_${targetId}`;
      const followKey2 = `${userId}_${animalId}`;
      let isFollowing = false;

      if (db.follows[followKey1] || db.follows[followKey2]) {
        delete db.follows[followKey1];
        delete db.follows[followKey2];
        animal.followersCount = Math.max(0, (animal.followersCount || 1) - 1);
      } else {
        db.follows[followKey1] = true;
        db.follows[followKey2] = true;
        animal.followersCount = (animal.followersCount || 0) + 1;
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

      // Realtime Broadcast across entire app and room
      io.to(`profile_${targetId}`).emit("followers_updated", { animalId: targetId, followerCount: animal.followersCount });
      io.to(`profile_${animalId}`).emit("followers_updated", { animalId, followerCount: animal.followersCount });
      io.emit("followers_updated", { animalId: targetId, followerCount: animal.followersCount });
      io.emit("animal_updated", animal);

      res.json({ isFollowing, followerCount: animal.followersCount });
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle follow state" });
    }
  };
  router.post("/follow", handleToggleFollow);
  router.post("/", handleToggleFollow);

  // Create new pet / animal profile
  router.post("/create", async (req: Request, res: Response): Promise<any> => {
    try {
      const { name, username, bio, breed, age, location, avatar, coverImage, photos, handlerId, handlerName } = req.body;
      if (!name) return res.status(400).json({ error: "Animal name is required" });
      const db = await getDb();
      const id = `a_${Date.now()}`;
      const newAnimal = {
        id,
        name,
        username: username || `@${name.toLowerCase().replace(/\s+/g, "")}.pet`,
        avatar: avatar || "🐾",
        coverImage: coverImage || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&auto=format&fit=crop&q=80",
        breed: breed || "Pet",
        age: age || "1 yr",
        location: location || "Global",
        bio: bio || "",
        handlerId: handlerId || "u_1",
        handlerName: handlerName || "Handler",
        followersCount: 0,
        followingCount: 0,
        photos: (photos && photos.length > 0) ? photos : (avatar && avatar.startsWith("http") ? [avatar] : ["https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=500&auto=format&fit=crop&q=80"]),
        isVerified: true,
        createdAt: new Date().toISOString()
      };
      db.animals[id] = newAnimal;
      await saveDb(db);
      io.emit("animal_created", newAnimal);
      return res.json(newAnimal);
    } catch (err) {
      return res.status(500).json({ error: "Failed to create animal profile" });
    }
  });

  // Update animal profile (photos, avatar, coverImage, bio, etc.)
  router.put("/:id", async (req: Request, res: Response): Promise<any> => {
    try {
      const id = String(req.params.id);
      const db = await getDb();
      const animal = db.animals[id];
      if (!animal) return res.status(404).json({ error: "Animal profile not found" });

      const { name, username, bio, breed, age, location, avatar, coverImage, photos } = req.body;
      if (name) animal.name = name;
      if (username) animal.username = username;
      if (bio !== undefined) animal.bio = bio;
      if (breed) animal.breed = breed;
      if (age) animal.age = age;
      if (location) animal.location = location;
      if (avatar) animal.avatar = avatar;
      if (coverImage) animal.coverImage = coverImage;
      if (photos && Array.isArray(photos)) animal.photos = photos;

      await saveDb(db);
      io.emit("animal_updated", animal);
      return res.json(animal);
    } catch (err) {
      return res.status(500).json({ error: "Failed to update animal profile" });
    }
  });

  return router;
}
