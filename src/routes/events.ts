import { Router, Request, Response } from "express";
import { getDb, saveDb } from "../db";
import { EventItem } from "../types";
import { uploadUrlOrBase64ToCloudinary } from "../lib/cloudinary";

export const eventsRouter = Router();

// Get Events (supports ?organizerId=...)
eventsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { organizerId } = req.query;
    const db = await getDb();
    let list = Object.values(db.events);
    if (organizerId) {
      list = list.filter((e) => e.organizerId === organizerId);
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Create new Event
eventsRouter.post("/", async (req: Request, res: Response): Promise<any> => {
  try {
    let { title, date, time, location, category, petType, description, image, organizerId, organizerName } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Event title is required." });
    }

    const db = await getDb();

    // If image is base64, upload to Cloudinary
    if (image && image.startsWith("data:")) {
      try {
        const up = await uploadUrlOrBase64ToCloudinary(image, "animaltok/events", "image");
        image = up.secure_url;
      } catch (err) {
        console.warn("Cloudinary event image upload error:", err);
      }
    }

    const user = db.users[organizerId || "u_1"];
    const eventId = `evt_${Date.now()}`;

    const newEvent: EventItem = {
      id: eventId,
      title: title.trim(),
      date: date || "Upcoming Weekend",
      time: time || "10:00 AM",
      location: location || "Local Community Dog Park",
      image: image || "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&fit=crop",
      attendeesCount: 1,
      category: category || "Meetup",
      petType: petType || "all",
      description: description || "Join us for a friendly pet community gathering!",
      organizerId: organizerId || (user ? user.id : "u_1"),
      organizerName: organizerName || (user ? user.name : "Animandler Host"),
      isAttending: true,
    };

    db.events[eventId] = newEvent;
    await saveDb(db);

    return res.status(201).json(newEvent);
  } catch (err: any) {
    console.error("Failed to create event:", err);
    return res.status(500).json({ error: "Failed to create event" });
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
