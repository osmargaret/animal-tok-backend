import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";

export const adsRouter = Router();

// Get active ads
adsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const activeAds = Object.values(db.ads || {}).filter(a => a.status === "active");
    res.json(activeAds);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ads" });
  }
});

// Record Ad Impression
adsRouter.post("/:id/impression", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    if (db.ads && db.ads[id]) {
      db.ads[id].impressions = (Number(db.ads[id].impressions) || 0) + 1;
      await saveDb(db);
      return res.json({ success: true, impressions: db.ads[id].impressions });
    }
    res.status(404).json({ error: "Ad not found" });
  } catch (err) {
    res.status(500).json({ error: "Failed to record impression" });
  }
});

// Record Ad Click
adsRouter.post("/:id/click", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    if (db.ads && db.ads[id]) {
      db.ads[id].clicks = (Number(db.ads[id].clicks) || 0) + 1;
      await saveDb(db);
      return res.json({ success: true, clicks: db.ads[id].clicks });
    }
    res.status(404).json({ error: "Ad not found" });
  } catch (err) {
    res.status(500).json({ error: "Failed to record click" });
  }
});

// Public Sounds catalog endpoint for SoundPickerModal
export const soundsRouter = Router();

soundsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const sounds = Object.values(db.sounds || {}).filter(s => s.status !== "archived");
    res.json(sounds);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sounds" });
  }
});
