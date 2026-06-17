import type { PublicationImage } from "./publication";

export const MAX_PUBLICATION_IMAGE_BYTES = 15 * 1024 * 1024;

export function resolvedRemoteImage(
  image: PublicationImage,
  arrayBuffer: ArrayBuffer,
  headers: Record<string, string>
): PublicationImage {
  if (arrayBuffer.byteLength > MAX_PUBLICATION_IMAGE_BYTES) {
    throw new Error(`远程图片超过 15 MB：${image.source}`);
  }
  const mimeType = contentType(headers) || mimeTypeFromName(image.source);
  if (!mimeType.startsWith("image/")) throw new Error(`远程地址返回的不是图片：${image.source}`);
  return {
    ...image,
    fileName: fileNameFromUrl(image.source, mimeType),
    mimeType,
    dataUrl: `data:${mimeType};base64,${arrayBufferToBase64(arrayBuffer)}`
  };
}

export function mimeTypeFromName(fileName: string): string {
  const extension = fileName.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "svg") return "image/svg+xml";
  return "image/png";
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function contentType(headers: Record<string, string>): string {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-type")?.[1] ?? "";
  return value.split(";")[0].trim().toLowerCase();
}

function fileNameFromUrl(source: string, mimeType: string): string {
  try {
    const name = decodeURIComponent(new URL(source).pathname.split("/").pop() ?? "");
    if (name) return name;
  } catch {
    // Use a generated name below.
  }
  return `image.${mimeType.split("/")[1] || "png"}`;
}
