import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadBufferToCloudinary, uploadUrlOrBase64ToCloudinary } from "../lib/cloudinary";

export const uploadRouter = Router();

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function saveBufferLocally(buffer: Buffer, originalName?: string): string {
  const ext = originalName ? path.extname(originalName) || ".jpg" : ".jpg";
  const filename = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

function saveBase64Locally(data: string): string {
  const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let ext = ".jpg";
  let buffer: Buffer;

  if (matches && matches.length === 3) {
    const mime = matches[1];
    if (mime.includes("video")) ext = ".mp4";
    else if (mime.includes("png")) ext = ".png";
    else if (mime.includes("gif")) ext = ".gif";
    else if (mime.includes("audio")) ext = ".mp3";
    buffer = Buffer.from(matches[2], "base64");
  } else {
    buffer = Buffer.from(data, "base64");
  }

  const filename = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

// Multer memory storage configuration (handles files up to 100MB for video)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for high-res videos
  }
});

// Single file upload endpoint (images, videos, audio)
uploadRouter.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const folder = (req.body.folder as string) || "animaltok/media";
      const resourceType = (req.body.resourceType as any) || "auto";
      const hostUrl = `${req.protocol}://${req.get("host")}`;

      // Case 1: Form-data file buffer
      if (req.file) {
        try {
          const result = await uploadBufferToCloudinary(
            req.file.buffer,
            folder,
            resourceType
          );
          return res.status(200).json({
            success: true,
            url: result.secure_url,
            secure_url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            resource_type: result.resource_type,
            bytes: result.bytes,
            duration: result.duration
          });
        } catch (cloudErr) {
          console.warn("Cloudinary upload failed, falling back to local storage:", cloudErr);
          const localPath = saveBufferLocally(req.file.buffer, req.file.originalname);
          const fullUrl = `${hostUrl}${localPath}`;
          return res.status(200).json({
            success: true,
            url: fullUrl,
            secure_url: fullUrl,
            public_id: path.basename(localPath),
            format: path.extname(localPath).replace(".", ""),
            resource_type: resourceType,
          });
        }
      }

      // Case 2: Base64 data or remote URL passed in JSON
      const { data, url } = req.body;
      const target = data || url;

      if (target) {
        if (target.startsWith("http://") || target.startsWith("https://")) {
          return res.status(200).json({
            success: true,
            url: target,
            secure_url: target
          });
        }

        try {
          const result = await uploadUrlOrBase64ToCloudinary(target, folder, resourceType);
          return res.status(200).json({
            success: true,
            url: result.secure_url,
            secure_url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            resource_type: result.resource_type,
            bytes: result.bytes,
            duration: result.duration
          });
        } catch (cloudErr) {
          console.warn("Cloudinary base64 upload failed, falling back to local storage:", cloudErr);
          const localPath = saveBase64Locally(target);
          const fullUrl = `${hostUrl}${localPath}`;
          return res.status(200).json({
            success: true,
            url: fullUrl,
            secure_url: fullUrl,
            public_id: path.basename(localPath),
            format: path.extname(localPath).replace(".", ""),
            resource_type: resourceType,
          });
        }
      }

      return res.status(400).json({
        error: "No file or media data provided"
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      return res.status(500).json({
        error: "Upload failed",
        message: err.message || "Unknown error during media upload"
      });
    }
  }
);
