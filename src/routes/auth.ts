import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb, saveDb } from "../db";
import { User, AnimalProfile } from "../types";

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_USE_ENV_VAR";
const SALT_ROUNDS = 12;

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

// Register new user & optional animal
authRouter.post("/register", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      name, username, email, password,
      accountType, clinicName, specialization,
      petName, petBreed, petAge, petBio
    } = req.body;

    if (!name || !username || !email) {
      return res.status(400).json({ error: "Name, username, and email are required." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
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
      // If the account exists but was created without a password (old flow), update it
      if (!(existing as any).passwordHash && password) {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        (existing as any).passwordHash = hash;
        await saveDb(db);
      }
      const token = signToken(existing.id);
      const firstAnimal = existing.animals && existing.animals[0] ? db.animals[existing.animals[0]] : null;
      return res.status(200).json({ user: existing, animal: firstAnimal, token, message: "Welcome back!" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = `u_${Date.now()}`;

    const newUser: User & { passwordHash?: string } = {
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
      createdAt: new Date().toISOString(),
      passwordHash,
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

    db.users[userId] = newUser as User;
    await saveDb(db);

    const token = signToken(userId);
    // Don't expose passwordHash in response
    const { passwordHash: _ph, ...safeUser } = newUser as any;
    res.status(201).json({ user: safeUser, animal: newAnimal, token });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed." });
  }
});

// Login
authRouter.post("/login", async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = (username || email || "").trim().toLowerCase();

    if (!loginIdentifier) {
      return res.status(400).json({ error: "Username or email is required." });
    }
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    const cleanInput = loginIdentifier.replace(/^@/, "");
    const db = await getDb();

    const user = Object.values(db.users).find((u) => {
      const uName = (u.username || "").toLowerCase().replace(/^@/, "");
      const uEmail = (u.email || "").toLowerCase();
      return uName === cleanInput || uEmail === loginIdentifier;
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Check password if hash exists; if no hash yet (legacy/seeded user), allow and update hash
    const userWithHash = user as any;
    if (userWithHash.passwordHash) {
      const valid = await bcrypt.compare(password, userWithHash.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials." });
      }
    } else {
      // First login for seeded/legacy account: set password now
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      userWithHash.passwordHash = hash;
      await saveDb(db);
    }

    const token = signToken(user.id);
    const firstAnimalId = user.animals && user.animals[0];
    const animal = firstAnimalId ? db.animals[firstAnimalId] : null;

    const { passwordHash: _ph, ...safeUser } = userWithHash;
    res.json({ user: safeUser, animal, token });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// Get current user profile
authRouter.get("/me", async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req.query.userId as string) || "u_3";
    const db = await getDb();
    const user = db.users[userId];
    if (!user) return res.status(404).json({ error: "User not found" });

    const userAnimals = user.animals.map(id => db.animals[id]).filter(Boolean);
    const { passwordHash: _ph, ...safeUser } = user as any;
    res.json({ user: safeUser, animals: userAnimals });
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
    const { passwordHash: _ph, ...safeUser } = user as any;
    return res.json({ success: true, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update profile" });
  }
});
