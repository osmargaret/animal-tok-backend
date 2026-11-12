import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { User, AnimalProfile } from "../types";

export const authRouter = Router();

// Register new user & optional animal
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, username, email, accountType, clinicName, specialization, petName, petBreed, petAge, petBio } = req.body;
    
    if (!name || !username || !email) {
      return res.status(400).json({ error: "Name, username, and email are required." });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    const cleanEmail = email.trim().toLowerCase();
    const resolvedAccountType: 'handler' | 'vet' | 'business' =
      accountType === 'vet' ? 'vet' : accountType === 'business' ? 'business' : 'handler';
    const resolvedRole: 'user' | 'vet' | 'business' =
      resolvedAccountType === 'vet' ? 'vet' : resolvedAccountType === 'business' ? 'business' : 'user';

    const db = await getDb();

    // Check if user already exists
    const existing = Object.values(db.users).find(
      (u) => u.email?.toLowerCase() === cleanEmail || u.username?.toLowerCase().replace(/^@/, "") === cleanUsername
    );
    if (existing) {
      const firstAnimal = existing.animals && existing.animals[0] ? db.animals[existing.animals[0]] : null;
      return res.status(200).json({
        user: existing,
        animal: firstAnimal,
        message: "Welcome back! User already registered."
      });
    }

    const userId = `u_${Date.now()}`;

    const newUser: User = {
      id: userId,
      name: name.trim(),
      username: `@${cleanUsername}`,
      email: cleanEmail,
      avatar: resolvedAccountType === 'vet'
        ? "https://images.unsplash.com/photo-1628015081036-0747ec8f077a?w=150&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      bio: petBio || (resolvedAccountType === 'vet' ? `Licensed Veterinarian at ${clinicName || 'Animal Hospital'}` : `Handler of ${petName || 'pets'}`),
      role: resolvedRole,
      accountType: resolvedAccountType,
      clinicName: clinicName?.trim(),
      specialization: specialization?.trim(),
      status: "active",
      subscriptionPlan: "free",
      animals: [],
      createdAt: new Date().toISOString()
    };

    let newAnimal: AnimalProfile | null = null;

    if (petName) {
      const animalId = `a_${Date.now()}`;
      newAnimal = {
        id: animalId,
        name: petName.trim(),
        username: `@${petName.toLowerCase().replace(/\s+/g, '')}.pet`,
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
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed." });
  }
});

// Login
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, email } = req.body;
    const loginIdentifier = (username || email || "").trim().toLowerCase();

    if (!loginIdentifier) {
      return res.status(400).json({ error: "Username or email is required." });
    }

    const cleanInput = loginIdentifier.replace(/^@/, "");

    const db = await getDb();
    
    const user = Object.values(db.users).find((u) => {
      const uName = (u.username || "").toLowerCase().replace(/^@/, "");
      const uEmail = (u.email || "").toLowerCase();
      return uName === cleanInput || uEmail === loginIdentifier;
    });

    if (!user) {
      // If demo user or fallback
      if (cleanInput.includes("demo") || cleanInput.includes("alex")) {
        const fallback = db.users["u_3"] || Object.values(db.users)[0];
        const firstAnimal = fallback?.animals?.[0] ? db.animals[fallback.animals[0]] : null;
        return res.json({ user: fallback, animal: firstAnimal });
      }
      return res.status(401).json({ error: "Invalid credentials. User not found." });
    }

    const firstAnimalId = user.animals && user.animals[0];
    const animal = firstAnimalId ? db.animals[firstAnimalId] : null;

    res.json({ user, animal });
  } catch (err: any) {
    console.error("Login error:", err);
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

// Update user / handler profile
authRouter.put("/me", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, name, username, bio, avatar } = req.body;
    const db = await getDb();
    const targetUserId = userId || (req.query.userId as string) || "u_3";
    const user = db.users[targetUserId];

    if (!user) return res.status(404).json({ error: "User not found" });

    if (name) user.name = name;
    if (username) user.username = username;
    if (bio !== undefined) user.bio = bio;
    if (avatar) user.avatar = avatar;

    await saveDb(db);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update profile" });
  }
});
