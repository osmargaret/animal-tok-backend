import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { User, AnimalProfile } from "../types";

export const authRouter = Router();

// Register new user & optional animal
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, username, email, petName, petBreed, petAge, petBio } = req.body;
    
    if (!name || !username || !email) {
      return res.status(400).json({ error: "Name, username, and email are required." });
    }

    const db = await getDb();
    const userId = `u_${Date.now()}`;

    const newUser: User = {
      id: userId,
      name,
      username,
      email,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      bio: petBio || `Handler of ${petName || 'pets'}`,
      role: "user",
      subscriptionPlan: "free",
      animals: [],
      createdAt: new Date().toISOString()
    };

    let newAnimal: AnimalProfile | null = null;

    if (petName) {
      const animalId = `a_${Date.now()}`;
      newAnimal = {
        id: animalId,
        name: petName,
        username: `@${petName.toLowerCase().replace(/\s+/g, '')}`,
        avatar: "🐾",
        coverImage: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80",
        breed: petBreed || "Mixed Breed",
        age: petAge || "1 yr",
        location: "United States",
        bio: petBio || `Hello from ${petName}! 🐾`,
        handlerId: userId,
        handlerName: name,
        followersCount: 0,
        followingCount: 0,
        photos: ["https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=500&auto=format&fit=crop&q=80"],
        isVerified: false,
        createdAt: new Date().toISOString()
      };
      
      db.animals[animalId] = newAnimal;
      newUser.animals.push(animalId);
    }

    db.users[userId] = newUser;
    await saveDb(db);

    res.status(201).json({
      user: newUser,
      animal: newAnimal
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed." });
  }
});

// Login
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    const db = await getDb();
    
    const user = Object.values(db.users).find(u => u.username.toLowerCase() === username?.toLowerCase() || u.email.toLowerCase() === username?.toLowerCase());

    if (!user) {
      // Fallback to demo user u_3 (Clemence) if not found
      return res.json({ user: db.users["u_3"], animal: db.animals["bella"] });
    }

    const firstAnimalId = user.animals[0];
    const animal = firstAnimalId ? db.animals[firstAnimalId] : null;

    res.json({ user, animal });
  } catch (err) {
    res.status(500).json({ error: "Login failed." });
  }
});

// Get current user profile
authRouter.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || "u_3";
    const db = await getDb();
    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: "User not found" });

    const userAnimals = user.animals.map(id => db.animals[id]).filter(Boolean);

    res.json({ user, animals: userAnimals });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch current user" });
  }
});
