import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb, saveDb } from "../db";
import { query } from "../db/postgres";
import { sendOtpEmail, sendWelcomeEmail, sendRegistrationOtpEmail } from "../lib/email";
import { User, AnimalProfile } from "../types";

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_USE_ENV_VAR";
const SALT_ROUNDS = 12;

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

interface PendingRegistration {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  accountType: 'handler' | 'vet' | 'business';
  clinicName?: string;
  specialization?: string;
  petName?: string;
  petBreed?: string;
  petAge?: string;
  petBio?: string;
  otp: string;
  expiresAt: number;
}

// In-memory cache for fast lookups (also backed by Postgres table registration_verifications)
const pendingRegistrations = new Map<string, PendingRegistration>();

// 1. Initiate Registration -> Validate & Send 6-digit Email Verification OTP
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
    const hasLetter = /[a-zA-Z]/.test(password || "");
    const hasNumber = /[0-9]/.test(password || "");
    if (!password || password.length < 6 || !hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Password must be at least 6 characters long and contain both letters and numbers." });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    const cleanEmail = email.trim().toLowerCase();
    const resolvedAccountType: 'handler' | 'vet' | 'business' =
      accountType === 'vet' ? 'vet' : accountType === 'business' ? 'business' : 'handler';

    const db = await getDb();

    // Check if user already exists
    const existing = Object.values(db.users).find(
      (u) => u.email?.toLowerCase() === cleanEmail || u.username?.toLowerCase().replace(/^@/, "") === cleanUsername
    );
    if (existing) {
      return res.status(400).json({ error: "An account with this email or username already exists. Please log in." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    const pendingData: PendingRegistration = {
      name: name.trim(),
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      accountType: resolvedAccountType,
      clinicName: clinicName?.trim(),
      specialization: specialization?.trim(),
      petName: petName?.trim(),
      petBreed: petBreed?.trim(),
      petAge: petAge?.trim(),
      petBio: petBio?.trim(),
      otp,
      expiresAt,
    };

    pendingRegistrations.set(cleanEmail, pendingData);

    // Persist to PostgreSQL registration_verifications table
    try {
      await query(`
        INSERT INTO registration_verifications (email, otp, payload, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          otp = EXCLUDED.otp,
          payload = EXCLUDED.payload,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW()
      `, [cleanEmail, otp, JSON.stringify(pendingData), new Date(expiresAt).toISOString()]);
    } catch (dbErr) {
      console.warn("Could not write to registration_verifications DB table:", dbErr);
    }

    // Dispatch 6-digit verification code email via Resend
    const sent = await sendRegistrationOtpEmail(cleanEmail, name.trim(), otp);

    res.status(200).json({
      success: true,
      requiresOtp: true,
      email: cleanEmail,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Please enter it to complete registration.`,
      otp: !sent ? otp : undefined, // fallback OTP provided if email service runs in sandbox
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed." });
  }
});

// 2. Verify Registration OTP & Complete Account Creation
authRouter.post("/verify-registration", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({ error: "Email address and 6-digit verification code are required." });
    }

    let pending = pendingRegistrations.get(cleanEmail);

    // If not in memory or expired, check PostgreSQL
    if (!pending || pending.otp !== cleanOtp || pending.expiresAt < Date.now()) {
      try {
        const result = await query(
          "SELECT * FROM registration_verifications WHERE LOWER(email) = $1 AND otp = $2 AND expires_at > NOW()",
          [cleanEmail, cleanOtp]
        );
        if (result.rows && result.rows.length > 0) {
          const row = result.rows[0];
          pending = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        }
      } catch (err) {
        console.warn("Error querying registration_verifications:", err);
      }
    }

    if (!pending || pending.otp !== cleanOtp) {
      return res.status(400).json({ error: "Invalid or expired verification code. Please check your email or request a new code." });
    }

    if (pending.expiresAt < Date.now()) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }

    const db = await getDb();
    const userId = `u_${Date.now()}`;
    const resolvedRole: 'user' | 'vet' | 'business' =
      pending.accountType === 'vet' ? 'vet' : pending.accountType === 'business' ? 'business' : 'user';

    const newUser: User & { passwordHash?: string } = {
      id: userId,
      name: pending.name,
      username: `@${pending.username}`,
      email: cleanEmail,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(pending.name)}&background=027A69&color=fff&size=200&bold=true`,
      bio: pending.petBio || (pending.accountType === 'vet' ? `Licensed Veterinarian at ${pending.clinicName || 'Animal Hospital'}` : `Handler of ${pending.petName || 'pets'}`),
      role: resolvedRole,
      accountType: pending.accountType,
      clinicName: pending.clinicName,
      specialization: pending.specialization,
      status: "active",
      subscriptionPlan: "free",
      animals: [],
      createdAt: new Date().toISOString(),
      passwordHash: pending.passwordHash,
    };

    let newAnimal: AnimalProfile | null = null;
    if (pending.petName) {
      const animalId = `a_${Date.now()}`;
      newAnimal = {
        id: animalId,
        name: pending.petName,
        username: `@${pending.petName.toLowerCase().replace(/\s+/g, '')}.pet`,
        avatar: "🐾",
        coverImage: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80",
        breed: pending.petBreed || "Mixed Breed",
        age: pending.petAge || "1 yr",
        location: "United States",
        bio: pending.petBio || `Hello from ${pending.petName}! 🐾`,
        handlerId: userId,
        handlerName: pending.name,
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

    // Clean up verification entry
    pendingRegistrations.delete(cleanEmail);
    query("DELETE FROM registration_verifications WHERE LOWER(email) = $1", [cleanEmail]).catch(() => {});

    // Dispatch warm membership welcome email asynchronously (non-blocking)
    sendWelcomeEmail({
      toEmail: cleanEmail,
      name: pending.name,
      username: `@${pending.username}`,
      accountType: pending.accountType,
      petName: pending.petName,
    }).catch((e) => console.warn("Welcome email async notice:", e));

    const token = signToken(userId);
    const { passwordHash: _ph, ...safeUser } = newUser as any;
    res.status(201).json({
      success: true,
      user: safeUser,
      animal: newAnimal,
      token,
      message: "Email verified successfully! Welcome to Animandler. 🐾"
    });
  } catch (err: any) {
    console.error("verify-registration error:", err);
    res.status(500).json({ error: err.message || "Registration verification failed." });
  }
});

// 3. Resend Registration OTP Code
authRouter.post("/resend-registration-otp", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: "Email address is required." });
    }

    let pending = pendingRegistrations.get(cleanEmail);
    if (!pending) {
      try {
        const result = await query(
          "SELECT * FROM registration_verifications WHERE LOWER(email) = $1 AND expires_at > NOW()",
          [cleanEmail]
        );
        if (result.rows && result.rows.length > 0) {
          const row = result.rows[0];
          pending = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        }
      } catch (err) {}
    }

    if (!pending) {
      return res.status(404).json({ error: "No pending registration found for this email. Please sign up again." });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    pending.otp = newOtp;
    pending.expiresAt = expiresAt;
    pendingRegistrations.set(cleanEmail, pending);

    query(
      "UPDATE registration_verifications SET otp = $1, expires_at = $2 WHERE LOWER(email) = $3",
      [newOtp, new Date(expiresAt).toISOString(), cleanEmail]
    ).catch(() => {});

    const sent = await sendRegistrationOtpEmail(cleanEmail, pending.name, newOtp);

    res.json({
      success: true,
      message: `A new verification code has been sent to ${cleanEmail}.`,
      otp: !sent ? newOtp : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to resend verification code." });
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

// Request Password Reset OTP
authRouter.post("/forgot-password", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const db = await getDb();
    const user = Object.values(db.users).find((u) => (u.email || "").toLowerCase() === cleanEmail);

    if (!user) {
      return res.status(404).json({ error: "No account found with this email address." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const id = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any existing unused OTPs for this email
    await query("UPDATE password_resets SET used = true WHERE email = $1", [cleanEmail]);

    // Store new OTP
    await query(
      "INSERT INTO password_resets (id, email, otp, expires_at, used) VALUES ($1, $2, $3, $4, false)",
      [id, cleanEmail, otp, expiresAt.toISOString()]
    );

    // Send email via Resend
    const sent = await sendOtpEmail(cleanEmail, otp);

    return res.json({
      success: true,
      sent,
      // Fallback OTP provided if Resend test domain blocks external recipients
      otp: !sent ? otp : undefined,
      message: sent
        ? `A 6-digit verification code has been sent to ${cleanEmail}.`
        : `A 6-digit verification code has been created for ${cleanEmail}.`
    });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: err.message || "Failed to process password reset request." });
  }
});

// Verify OTP
authRouter.post("/verify-otp", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({ error: "Email and OTP code are required." });
    }

    const { rows } = await query(
      "SELECT * FROM password_resets WHERE email = $1 AND otp = $2 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [cleanEmail, cleanOtp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    return res.json({ success: true, message: "Code verified successfully." });
  } catch (err: any) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ error: "Failed to verify code." });
  }
});

// Reset Password with verified OTP
authRouter.post("/reset-password", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, otp, newPassword } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").trim();

    if (!cleanEmail || !cleanOtp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP code, and new password are required." });
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword || "");
    const hasNumber = /[0-9]/.test(newPassword || "");
    if (!newPassword || newPassword.length < 6 || !hasLetter || !hasNumber) {
      return res.status(400).json({ error: "Password must be at least 6 characters long and contain both letters and numbers." });
    }

    // Verify OTP one more time
    const { rows } = await query(
      "SELECT * FROM password_resets WHERE email = $1 AND otp = $2 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [cleanEmail, cleanOtp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    // Mark OTP as used
    await query("UPDATE password_resets SET used = true WHERE id = $1", [rows[0].id]);

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update in Neon Postgres
    await query("UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2", [newHash, cleanEmail]);

    // Update in-memory DB and reset TTL
    const db = await getDb();
    const user = Object.values(db.users).find((u) => (u.email || "").toLowerCase() === cleanEmail);
    if (user) {
      (user as any).passwordHash = newHash;
      await saveDb(db);
    }

    return res.json({ success: true, message: "Your password has been reset successfully! You can now log in." });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});
