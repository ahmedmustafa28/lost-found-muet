import {
  IMAGE_MAX_DIMENSION,
  IMAGE_UPLOAD_QUALITY,
  IMAGE_UPLOAD_TYPE,
} from "@/lib/constants";

// Browser only. Draws the photo on a canvas and exports a new JPEG
// (DEVELOPMENT.md 11.1). The new file has none of the original's EXIF data,
// such as GPS location, and is at most IMAGE_MAX_DIMENSION pixels on its
// longest side. createImageBitmap applies the EXIF rotation first, so the
// photo keeps the right way up. JPEG because every browser can export it
// (Safari can't export WebP); the white background stops transparent PNGs
// turning black.
export async function reencodeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, IMAGE_UPLOAD_TYPE, IMAGE_UPLOAD_QUALITY),
    );
    if (!blob || blob.type !== IMAGE_UPLOAD_TYPE) {
      throw new Error("The photo could not be converted.");
    }
    return blob;
  } finally {
    bitmap.close();
  }
}
