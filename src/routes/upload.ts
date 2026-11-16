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

/**
 * WhatsApp naming convention for Animandler media:
 * Images: ANIMANDLER-IMG-YYYYMMDD-WA0001.jpg
 * Videos: ANIMANDLER-VID-YYYYMMDD-WA0001.mp4
 * Audio:  ANIMANDLER-AUD-YYYYMMDD-WA0001.mp3
 */
export function generateWhatsAppMediaName(
  resourceType: string = "auto",
  originalName?: string,
  mimeType?: string
): { publicId: string; filename: string; ext: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  // 4-digit sequential/random number like WA0001, WA5829
  const seqNum = String(Math.floor(1000 + Math.random() * 9000));

  const isVideo =
    resourceType === "video" ||
    (mimeType && mimeType.includes("video")) ||
    (originalName && originalName.match(/\.(mp4|mov|avi|mkv|webm)$/i));

  const isAudio =
    resourceType === "audio" ||
    (mimeType && mimeType.includes("audio")) ||
    (originalName && originalName.match(/\.(mp3|wav|m4a|aac)$/i));

  let typePrefix = "IMG";
  let ext = ".jpg";

  if (isVideo) {
    typePrefix = "VID";
    ext = originalName ? path.extname(originalName) || ".mp4" : ".mp4";
  } else if (isAudio) {
    typePrefix = "AUD";
    ext = originalName ? path.extname(originalName) || ".mp3" : ".mp3";
  } else {
    typePrefix = "IMG";
    ext = originalName ? path.extname(originalName) || ".jpg" : ".jpg";
  }

  const publicId = `ANIMANDLER-${typePrefix}-${dateStr}-WA${seqNum}`;
  return {
    publicId,
    filename: `${publicId}${ext}`,
    ext: ext.replace(".", "")
  };
}

function saveBufferLocally(buffer: Buffer, resourceType = "auto", originalName?: string, mimeType?: string): string {
  const { filename } = generateWhatsAppMediaName(resourceType, originalName, mimeType);
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

function saveBase64Locally(data: string, resourceType = "auto"): string {
  const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let mime = "";
  let buffer: Buffer;

  if (matches && matches.length === 3) {
    mime = matches[1];
    buffer = Buffer.from(matches[2], "base64");
  } else {
    buffer = Buffer.from(data, "base64");
  }

  const { filename } = generateWhatsAppMediaName(resourceType, undefined, mime);
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
        const mediaName = generateWhatsAppMediaName(
          resourceType,
          req.file.originalname,
          req.file.mimetype
        );

        try {
          const result = await uploadBufferToCloudinary(
            req.file.buffer,
            folder,
            resourceType,
            mediaName.publicId
          );
          return res.status(200).json({
            success: true,
            url: result.secure_url,
            secure_url: result.secure_url,
            public_id: result.public_id,
            filename: mediaName.filename,
            format: result.format || mediaName.ext,
            resource_type: result.resource_type || resourceType,
            bytes: result.bytes,
            duration: result.duration
          });
        } catch (cloudErr) {
          console.warn("Cloudinary upload failed, falling back to WhatsApp-named local storage:", cloudErr);
          const localPath = saveBufferLocally(
            req.file.buffer,
            resourceType,
            req.file.originalname,
            req.file.mimetype
          );
          const fullUrl = `${hostUrl}${localPath}`;
          return res.status(200).json({
            success: true,
            url: fullUrl,
            secure_url: fullUrl,
            public_id: path.basename(localPath, path.extname(localPath)),
            filename: path.basename(localPath),
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

        const mediaName = generateWhatsAppMediaName(resourceType);

        try {
          const result = await uploadUrlOrBase64ToCloudinary(
            target,
            folder,
            resourceType,
            mediaName.publicId
          );
          return res.status(200).json({
            success: true,
            url: result.secure_url,
            secure_url: result.secure_url,
            public_id: result.public_id,
            filename: mediaName.filename,
            format: result.format || mediaName.ext,
            resource_type: result.resource_type || resourceType,
            bytes: result.bytes,
            duration: result.duration
          });
        } catch (cloudErr) {
          console.warn("Cloudinary base64 upload failed, falling back to WhatsApp-named local storage:", cloudErr);
          const localPath = saveBase64Locally(target, resourceType);
          const fullUrl = `${hostUrl}${localPath}`;
          return res.status(200).json({
            success: true,
            url: fullUrl,
            secure_url: fullUrl,
            public_id: path.basename(localPath, path.extname(localPath)),
            filename: path.basename(localPath),
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
