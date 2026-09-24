import type { GiftPhoto } from "@/domain/records/activity";

/**
 * Shrinking a photo before it is kept.
 *
 * The demo stores everything in localStorage, which has a few megabytes in
 * total. A phone photo is three to eight of them. So a gift photo is redrawn
 * to at most 1400px on its long edge as a JPEG at 72% quality, and refused if
 * it is still over 900 KB — which keeps a handful of photos affordable and
 * makes the storage-full failure something the user is told about rather
 * than something that silently loses the rest of their work.
 */
export const MAX_EDGE = 1400;
export const JPEG_QUALITY = 0.72;
export const MAX_BYTES = 900 * 1024;
export const MAX_PHOTOS = 4;

export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file is not an image this browser can open."));
    img.src = src;
  });
}

export type ShrinkResult =
  | { status: "ready"; photo: GiftPhoto & { width: number; height: number } }
  | { status: "rejected"; message: string };

export async function shrinkPhoto(file: File, id: string): Promise<ShrinkResult> {
  if (!file.type.startsWith("image/")) {
    return { status: "rejected", message: "That is not a photo. Pick a JPG, PNG or HEIC." };
  }
  let dataUrl: string;
  try {
    dataUrl = await readAsDataUrl(file);
  } catch (e) {
    return { status: "rejected", message: e instanceof Error ? e.message : "That file could not be read." };
  }
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return {
      status: "rejected",
      message:
        "This browser cannot open that image. If it came off an iPhone it is probably HEIC — share it or save it as JPG first.",
    };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { status: "rejected", message: "This browser could not process the photo." };
  ctx.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const bytes = dataUrlBytes(out);
  if (bytes > MAX_BYTES) {
    return { status: "rejected", message: "That photo is still too large to keep. Try a smaller one." };
  }
  return {
    status: "ready",
    photo: { id, dataUrl: out, name: file.name || "Photo", width, height, bytes, addedAt: new Date().toISOString() },
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
