import { Router, Request, Response } from "express";
import multer from "multer";
import { uploadBufferToCloudinary, uploadUrlOrBase64ToCloudinary } from "../lib/cloudinary";

export const uploadRouter = Router();

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

      // Case 1: Form-data file buffer
      if (req.file) {
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
      }

      // Case 2: Base64 data or remote URL passed in JSON
      const { data, url } = req.body;
      const target = data || url;

      if (target) {
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
      }

      return res.status(400).json({
        error: "No file or media data provided"
      });
    } catch (err: any) {
      console.error("Cloudinary upload error:", err);
      return res.status(500).json({
        error: "Upload failed",
        message: err.message || "Unknown error during media upload"
      });
    }
  }
);

// Multiple files upload endpoint (e.g., photo galleries)
uploadRouter.post(
  "/multiple",
  upload.array("files", 10),
  async (req: Request, res: Response): Promise<any> => {
    try {
      const folder = (req.body.folder as string) || "animaltok/gallery";
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadPromises = files.map(file =>
        uploadBufferToCloudinary(file.buffer, folder, "auto")
      );

      const results = await Promise.all(uploadPromises);

      return res.status(200).json({
        success: true,
        count: results.length,
        items: results.map(r => ({
          url: r.secure_url,
          secure_url: r.secure_url,
          public_id: r.public_id,
          format: r.format,
          resource_type: r.resource_type
        }))
      });
    } catch (err: any) {
      console.error("Multi upload error:", err);
      return res.status(500).json({
        error: "Multiple file upload failed",
        message: err.message
      });
    }
  }
);
