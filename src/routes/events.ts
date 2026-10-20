import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";

export const eventsRouter = Router();

// Get Events
eventsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    res.json(Object.values(db.events));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Toggle RSVP for Event
eventsRouter.post("/:id/rsvp", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = await getDb();
    const event = db.events[id];

    if (!event) return res.status(404).json({ error: "Event not found" });

    event.isAttending = !event.isAttending;
    if (event.isAttending) {
      event.attendeesCount += 1;
    } else {
      event.attendeesCount = Math.max(0, event.attendeesCount - 1);
    }

    await saveDb(db);

    res.json({ isAttending: event.isAttending, attendeesCount: event.attendeesCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to RSVP" });
  }
});
