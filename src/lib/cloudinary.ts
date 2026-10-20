import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "lo1xfi5f",
  api_key: process.env.CLOUDINARY_API_KEY || "114821646633185",
  api_secret: process.env.CLOUDINARY_API_SECRET || "tonFsu6zLPilRLekgNb6j_qJYPg",
  secure: true
});

/**
 * Upload a file Buffer directly to Cloudinary using upload_stream
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = "animaltok",
  resourceType: "auto" | "image" | "video" | "raw" = "auto"
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed with empty result"));
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Upload a base64 string or remote URL directly to Cloudinary
 */
export async function uploadUrlOrBase64ToCloudinary(
  source: string,
  folder = "animaltok",
  resourceType: "auto" | "image" | "video" | "raw" = "auto"
): Promise<UploadApiResponse> {
  return await cloudinary.uploader.upload(source, {
    folder,
    resource_type: resourceType,
  });
}

export { cloudinary };
