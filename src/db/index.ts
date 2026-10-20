import fs from "fs/promises";
import path from "path";
import { DatabaseSchema } from "../types";
import { initialDbData } from "./initialData";

const DB_PATH = path.join(__dirname, "../../db.json");

export async function getDb(): Promise<DatabaseSchema> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const data = JSON.parse(raw);
    
    return {
      users: data.users || initialDbData.users,
      animals: data.animals || initialDbData.animals,
      follows: data.follows || initialDbData.follows,
      posts: data.posts || initialDbData.posts,
      likes: data.likes || initialDbData.likes,
      comments: data.comments || initialDbData.comments,
      products: data.products || initialDbData.products,
      services: data.services || initialDbData.services,
      events: data.events || initialDbData.events,
      notifications: data.notifications || initialDbData.notifications,
      messages: data.messages || initialDbData.messages,
      reports: data.reports || initialDbData.reports,
      auditLogs: data.auditLogs || initialDbData.auditLogs
    };
  } catch (err) {
    await saveDb(initialDbData);
    return initialDbData;
  }
}

export async function saveDb(data: DatabaseSchema): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}
