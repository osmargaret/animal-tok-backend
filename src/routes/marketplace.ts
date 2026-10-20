import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { Product, Service } from "../types";

export const marketplaceRouter = Router();

// Get Products
marketplaceRouter.get("/products", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    res.json(Object.values(db.products));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get Product by ID
marketplaceRouter.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    const product = db.products[id];
    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Add new Product (for handlers / business users)
marketplaceRouter.post("/products", async (req: Request, res: Response) => {
  try {
    const { title, price, category, image, description, sellerId } = req.body;
    const db = await getDb();

    const user = db.users[sellerId || "u_1"];

    const productId = `prod_${Date.now()}`;
    const newProduct: Product = {
      id: productId,
      title: title || "New Pet Item",
      price: Number(price) || 19.99,
      currency: "$",
      category: category || "General",
      image: image || "https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=500&auto=format&fit=crop&q=80",
      rating: 5.0,
      reviewsCount: 1,
      description: description || "Quality item for your pet.",
      sellerId: user ? user.id : "u_1",
      sellerName: user ? user.name : "Verified Seller",
      sellerAvatar: user ? user.avatar : "🐾",
      inStock: true,
      tags: [category || "PetCare"]
    };

    db.products[productId] = newProduct;
    await saveDb(db);

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: "Failed to add product" });
  }
});

// Get Services
marketplaceRouter.get("/services", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    res.json(Object.values(db.services));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// Get Service by ID
marketplaceRouter.get("/services/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    const service = db.services[id];
    if (!service) return res.status(404).json({ error: "Service not found" });

    res.json(service);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch service" });
  }
});
