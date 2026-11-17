import { Router, Request, Response } from "express";
import { getDb } from "../db";

export const searchRouter = Router();

function matchesPetType(petTypeFilter: string, ...fields: (string | undefined)[]): boolean {
  if (!petTypeFilter || petTypeFilter === "all") return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  switch (petTypeFilter) {
    case "dog":
      return /dog|pup|retriever|husky|lab|shepherd|canine|doodle|bulldog|poodle|🐕/.test(hay);
    case "cat":
      return /cat|feline|kitten|maine|bengal|ragdoll|siamese|tabby|🐈/.test(hay);
    case "bird":
      return /bird|parrot|avian|macaw|cockatiel|parakeet|🦜/.test(hay);
    case "rabbit":
      return /rabbit|bunny|hare|🐇|🐰/.test(hay);
    case "exotic":
      return /exotic|reptile|gecko|snake|lizard|turtle|iguana|ferret|🦎/.test(hay);
    case "horse":
      return /horse|equine|pony|stallion|mare|🐎/.test(hay);
    default:
      return true;
  }
}

searchRouter.get("/", async (req: Request, res: Response) => {
  try {
    const rawQuery = String(req.query.q || "").trim();
    const q = rawQuery.toLowerCase();
    const cleanQ = q.replace(/^[@#]+/, "");
    const petType = String(req.query.petType || "all").toLowerCase();
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25));

    const db = await getDb();
    const allAnimals = Object.values(db.animals || {});

    const matchesText = (...values: (string | string[] | undefined | null)[]) => {
      if (!q && !cleanQ) return true;
      const flat = values
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return flat.includes(q) || (cleanQ.length > 0 && flat.includes(cleanQ));
    };

    // 1. Handlers (Users — sanitized public profile + their pets)
    const handlers = Object.values(db.users || {})
      .filter((u) => u.status !== "suspended" && u.status !== "banned")
      .map((u) => {
        const ownedPets = allAnimals.filter(
          (a) =>
            a.handlerId === u.id ||
            (Array.isArray(u.animals) && u.animals.includes(a.id)) ||
            (u.name && a.handlerName && a.handlerName.toLowerCase() === u.name.toLowerCase())
        );
        return { user: u, ownedPets };
      })
      .filter(({ user: u, ownedPets }) => {
        const petTextMatch = ownedPets.some((p) =>
          matchesText(p.name, p.username, p.breed, p.bio)
        );
        const userTextMatch = matchesText(
          u.name,
          u.username,
          u.bio,
          u.clinicName,
          u.businessName,
          u.specialization,
          u.accountType,
          u.role
        );
        if (!userTextMatch && !petTextMatch) return false;
        if (petType !== "all") {
          return (
            ownedPets.some((p) => matchesPetType(petType, p.name, p.breed, p.bio, p.avatar)) ||
            matchesPetType(petType, u.bio, u.specialization, u.businessName)
          );
        }
        return true;
      })
      .map(({ user: u, ownedPets }) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatar: u.avatar,
        bio: u.bio || "",
        role: u.role,
        accountType: u.accountType || "handler",
        clinicName: u.clinicName,
        businessName: u.businessName,
        specialization: u.specialization,
        pets: ownedPets.map((p) => ({
          id: p.id,
          name: p.name,
          username: p.username,
          avatar: p.avatar,
          breed: p.breed,
          age: p.age,
          followersCount: p.followersCount || 0,
        })),
      }))
      .slice(0, limit);

    // 2. Pets / Animals
    const pets = allAnimals
      .filter((a) => {
        const textOk = matchesText(
          a.name,
          a.username,
          a.breed,
          a.age,
          a.location,
          a.bio,
          a.handlerName
        );
        const petOk = matchesPetType(petType, a.name, a.breed, a.bio, a.avatar);
        return textOk && petOk;
      })
      .sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0))
      .slice(0, limit);

    // 3. Posts / Videos
    const animalById = db.animals || {};
    const posts = Object.values(db.posts || {})
      .filter((p) => {
        if (p.isSuspended) return false;
        const linkedAnimal = p.animalId ? animalById[p.animalId] : undefined;
        const textOk = matchesText(
          p.caption,
          p.animalName,
          p.animalUsername,
          p.tags,
          p.audioName,
          linkedAnimal?.handlerName,
          linkedAnimal?.breed
        );
        const petOk = matchesPetType(
          petType,
          p.caption,
          Array.isArray(p.tags) ? p.tags.join(" ") : "",
          p.animalAvatar,
          linkedAnimal?.breed
        );
        return textOk && petOk;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((p) => {
        const linkedAnimal = p.animalId ? animalById[p.animalId] : undefined;
        return {
          ...p,
          handlerId: linkedAnimal?.handlerId,
          handlerName: linkedAnimal?.handlerName,
        };
      })
      .slice(0, limit);

    // 4. Events
    const events = Object.values(db.events || {})
      .filter((e) => {
        if (e.status === "cancelled") return false;
        const textOk = matchesText(
          e.title,
          e.location,
          e.description,
          e.category,
          e.organizerName,
          e.petType
        );
        const petOk =
          petType === "all" ||
          !e.petType ||
          e.petType === "all" ||
          e.petType.toLowerCase() === petType;
        return textOk && petOk;
      })
      .slice(0, limit);

    // 5. Products
    const products = Object.values(db.products || {})
      .filter((p) => {
        if (p.approvalStatus === "rejected") return false;
        const textOk = matchesText(p.title, p.category, p.description, p.sellerName, p.tags);
        const petOk = matchesPetType(petType, p.title, p.category, p.description);
        return textOk && petOk;
      })
      .slice(0, limit);

    // 6. Services
    const services = Object.values(db.services || {})
      .filter((s) => {
        if (s.approvalStatus === "rejected") return false;
        const textOk = matchesText(s.title, s.category, s.description, s.providerName, s.location);
        const petOk = matchesPetType(petType, s.title, s.category, s.description);
        return textOk && petOk;
      })
      .slice(0, limit);

    res.json({
      query: rawQuery,
      handlers,
      pets,
      posts,
      events,
      products,
      services,
    });
  } catch (err) {
    console.error("Unified search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});
