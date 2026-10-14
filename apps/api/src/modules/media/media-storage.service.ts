import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

export const MEDIA_CATEGORIES = ["profile", "campaign", "chat", "project", "misc"] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_PROFILE_BYTES = 10 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".pdf": "application/pdf",
  ".txt": "text/plain", ".csv": "text/csv", ".zip": "application/zip",
};
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "application/pdf": ".pdf",
  "text/plain": ".txt", "text/csv": ".csv", "application/zip": ".zip",
};

export type StoredMedia = { key: string; fileName: string; mimeType: string; size: number };
export type MediaOwner = { id: string; phoneE164: string | null; displayName: string | null };
export type MediaStream = { stream: Readable; mimeType: string; size: number };

const safeSegment = (value: string | null | undefined, fallback: string): string => {
  const safe = (value ?? "").trim().replace(/\\/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return safe || fallback;
};

const safeFileName = (value: string): string => {
  const name = path.basename(value || "file").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
  return name || "file";
};

@Injectable()
export class MediaStorageService {
  private readonly root = path.resolve(process.env.MEDIA_STORAGE_ROOT?.trim() || process.env.UPLOADS_ROOT?.trim() || path.join(process.cwd(), "uploads"));

  ownerFolder(owner: MediaOwner): string {
    const identity = owner.phoneE164 || owner.id;
    return `${safeSegment(identity, owner.id)}-${safeSegment(owner.displayName, "user")}`;
  }

  async save(owner: MediaOwner, categoryValue: string, fileName: string, mimeType: string, buffer: Buffer): Promise<StoredMedia> {
    const category = this.category(categoryValue);
    const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
    const extension = path.extname(fileName).toLowerCase() || MIME_EXTENSIONS[normalizedMime] || ".bin";
    const resolvedMime = CONTENT_TYPES[extension] || normalizedMime || "application/octet-stream";
    const maxBytes = category === "profile" ? MAX_PROFILE_BYTES : MAX_FILE_BYTES;
    if (!buffer.length) throw new BadRequestException("The selected file is empty.");
    if (buffer.length > maxBytes) throw new BadRequestException(`File size must be ${Math.round(maxBytes / (1024 * 1024))}MB or less.`);
    if (!this.isAllowed(resolvedMime, extension)) throw new BadRequestException("This file type is not supported.");

    const folder = path.posix.join("user", this.ownerFolder(owner), category);
    const storedName = `${category}-${Date.now()}-${randomUUID()}${extension}`;
    const key = path.posix.join(folder, safeFileName(storedName));
    const absolutePath = this.resolveKey(key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer, { flag: "wx" });
    return { key, fileName: safeFileName(fileName), mimeType: resolvedMime, size: buffer.length };
  }

  async saveStream(owner: MediaOwner, categoryValue: string, fileName: string, mimeType: string, input: NodeJS.ReadableStream): Promise<StoredMedia> {
    const category = this.category(categoryValue);
    const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
    const extension = path.extname(fileName).toLowerCase() || MIME_EXTENSIONS[normalizedMime] || ".bin";
    const resolvedMime = CONTENT_TYPES[extension] || normalizedMime || "application/octet-stream";
    const maxBytes = category === "profile" ? MAX_PROFILE_BYTES : MAX_FILE_BYTES;
    if (!this.isAllowed(resolvedMime, extension)) throw new BadRequestException("This file type is not supported.");

    const folder = path.posix.join("user", this.ownerFolder(owner), category);
    const storedName = `${category}-${Date.now()}-${randomUUID()}${extension}`;
    const key = path.posix.join(folder, safeFileName(storedName));
    const absolutePath = this.resolveKey(key);
    const tempPath = `${absolutePath}.${randomUUID()}.part`;
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    let size = 0;
    const limiter = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        size += chunk.length;
        if (size > maxBytes) callback(new BadRequestException(`File size must be ${Math.round(maxBytes / (1024 * 1024))}MB or less.`));
        else callback(null, chunk);
      },
    });
    try {
      await pipeline(input, limiter, createWriteStream(tempPath, { flags: "wx" }));
      if (!size) throw new BadRequestException("The selected file is empty.");
      await fs.rename(tempPath, absolutePath);
      return { key, fileName: safeFileName(fileName), mimeType: resolvedMime, size };
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      throw error;
    }
  }

  async deleteOwned(owner: MediaOwner, key: string): Promise<void> {
    const expectedPrefix = path.posix.join("user", this.ownerFolder(owner), "");
    const normalized = this.normalizeKey(key);
    if (!normalized.startsWith(expectedPrefix) || normalized.split("/").length !== 4) throw new NotFoundException("Media file not found.");
    const source = this.resolveKey(normalized);
    try { await fs.access(source); } catch { throw new NotFoundException("Media file not found."); }
    const fileName = normalized.split("/").pop()!;
    const target = this.resolveKey(path.posix.join("user", this.ownerFolder(owner), "deleted", fileName));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rename(source, target);
  }

  async read(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const normalized = this.normalizeKey(key);
    if (normalized.split("/").length !== 4 || normalized.split("/")[0] !== "user") throw new NotFoundException("Media file not found.");
    try {
      const buffer = await fs.readFile(this.resolveKey(normalized));
      const extension = path.extname(normalized).toLowerCase();
      return { buffer, mimeType: CONTENT_TYPES[extension] || "application/octet-stream" };
    } catch { throw new NotFoundException("Media file not found."); }
  }

  async readStream(key: string, range?: { start: number; end: number }): Promise<MediaStream> {
    const normalized = this.normalizeKey(key);
    if (normalized.split("/").length !== 4 || normalized.split("/")[0] !== "user") throw new NotFoundException("Media file not found.");
    const source = this.resolveKey(normalized);
    try {
      await fs.access(source);
      const extension = path.extname(normalized).toLowerCase();
      const stats = await fs.stat(source);
      const start = range?.start ?? 0;
      const end = Math.min(range?.end ?? Math.max(stats.size - 1, 0), Math.max(stats.size - 1, 0));
      if (start < 0 || start > end || start >= stats.size || end >= stats.size) throw new NotFoundException("Media range not found.");
      return { stream: createReadStream(source, { start, end }), mimeType: CONTENT_TYPES[extension] || "application/octet-stream", size: stats.size };
    } catch {
      throw new NotFoundException("Media file not found.");
    }
  }

  private category(value: string): MediaCategory {
    return (MEDIA_CATEGORIES as readonly string[]).includes(value) ? value as MediaCategory : "misc";
  }

  private isAllowed(mimeType: string, extension: string): boolean {
    return Boolean(CONTENT_TYPES[extension]) || /^(image|video)\//.test(mimeType);
  }

  private normalizeKey(key: string): string {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    const resolved = path.posix.normalize(normalized);
    if (!resolved || resolved === "." || resolved.startsWith("../") || resolved.includes("/../") || path.posix.isAbsolute(resolved)) throw new NotFoundException("Media file not found.");
    return resolved;
  }

  private resolveKey(key: string): string {
    const normalized = this.normalizeKey(key);
    const resolved = path.resolve(this.root, ...normalized.split("/"));
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) throw new NotFoundException("Media file not found.");
    return resolved;
  }
}
