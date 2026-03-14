import {
  type FrontMatterCache,
  normalizePath,
  TFile,
  type Vault,
} from "obsidian";
import type { CMSSettings, UploadAsset } from "src/types";
import { uploadAPI } from "./api";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  zip: "application/zip",
};

export async function publish(
  file: TFile,
  content: string,
  settings: CMSSettings,
  frontmatter: FrontMatterCache | undefined,
) {
  try {
    const convertedContent = convertObsidianImageSyntax(content);
    const assets = await processAssets(convertedContent, file, frontmatter);

    await uploadAPI(settings, assets, convertedContent, file.basename);

    return { success: true, message: "Note uploaded successfully!" };
  } catch (error) {
    console.error("Error uploading note:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function processAssets(
  content: string,
  file: TFile,
  frontmatter: FrontMatterCache | undefined,
) {
  const references = collectAssetReferences(content, frontmatter);
  const vault = file.vault;
  const seenFilePaths = new Set<string>();
  const duplicateFileNames = new Map<string, number>();
  const assets: UploadAsset[] = [];

  for (const reference of references) {
    const assetFile = resolveVaultFile(reference, vault, file);
    if (!(assetFile instanceof TFile) || seenFilePaths.has(assetFile.path)) {
      continue;
    }

    seenFilePaths.add(assetFile.path);
    const fileName = getUniqueFileName(assetFile.name, duplicateFileNames);
    const mimeType = guessMimeType(assetFile.name);
    const buffer = await vault.readBinary(assetFile);

    assets.push({ fileName, path: assetFile.path, mimeType, buffer });
  }

  return assets;
}

function collectAssetReferences(
  content: string,
  frontmatter: FrontMatterCache | undefined,
) {
  const references = new Set<string>();

  addFrontmatterReferences(frontmatter, references);

  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1]?.trim();
    if (target) {
      references.add(cleanReference(target));
    }
  }

  for (const match of content.matchAll(/!?\[\[([^\]]+)\]\]/g)) {
    const rawTarget = match[1]?.split("|")[0]?.trim();
    if (rawTarget) {
      references.add(cleanReference(rawTarget));
    }
  }

  for (const match of content.matchAll(
    /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
  )) {
    const target = match[1]?.trim();
    if (target) {
      references.add(cleanReference(target));
    }
  }

  return Array.from(references).filter(Boolean);
}

function addFrontmatterReferences(
  frontmatter: FrontMatterCache | undefined,
  references: Set<string>,
) {
  if (!frontmatter) {
    return;
  }

  for (const key of Object.keys(frontmatter)) {
    // Skip Obsidian's internal cache position metadata
    if (key === "position") continue;
    collectStringsFromValue(frontmatter[key], references);
  }
}

function collectStringsFromValue(value: unknown, references: Set<string>) {
  if (typeof value === "string") {
    const cleaned = cleanReference(value);
    if (cleaned.length > 0) {
      references.add(cleaned);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStringsFromValue(item, references);
    }
  }
}

function resolveVaultFile(reference: string, vault: Vault, currentFile: TFile) {
  const normalizedReference = normalizeReference(reference);
  if (!normalizedReference || isRemoteReference(normalizedReference)) {
    return null;
  }

  const directFile = vault.getAbstractFileByPath(normalizedReference);
  if (directFile instanceof TFile) {
    return directFile;
  }

  const currentFolder = currentFile.parent?.path;
  if (currentFolder) {
    const relativePath = normalizePath(
      `${currentFolder}/${normalizedReference}`,
    );
    const relativeFile = vault.getAbstractFileByPath(relativePath);
    if (relativeFile instanceof TFile) {
      return relativeFile;
    }
  }

  const fileName = normalizedReference.split("/").pop();
  if (!fileName) {
    return null;
  }

  const normalizedReferenceLower = normalizedReference.toLowerCase();
  const fileNameLower = fileName.toLowerCase();
  const referenceWithoutExt = stripExtension(normalizedReference).toLowerCase();
  const fileNameWithoutExt = stripExtension(fileName).toLowerCase();

  const candidates = vault
    .getFiles()
    .map((item) => {
      const itemPath = item.path.toLowerCase();
      const itemName = item.name.toLowerCase();
      const itemPathWithoutExt = stripExtension(item.path).toLowerCase();
      const itemNameWithoutExt = stripExtension(item.name).toLowerCase();

      let score = 0;
      if (itemPath === normalizedReferenceLower) score = 100;
      else if (itemPathWithoutExt === referenceWithoutExt) score = 90;
      else if (itemPath.endsWith(normalizedReferenceLower)) score = 80;
      else if (itemPathWithoutExt.endsWith(referenceWithoutExt)) score = 70;
      else if (itemName === fileNameLower) score = 60;
      else if (itemNameWithoutExt === fileNameWithoutExt) score = 50;

      return { item, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.path.length - b.item.path.length ||
        a.item.path.localeCompare(b.item.path),
    );

  return candidates[0]?.item || null;
}

function cleanReference(value: string): string {
  let cleaned = value.trim();

  if (cleaned.startsWith("<") && cleaned.endsWith(">")) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  const titleMatch = cleaned.match(/^(.+?)\s+(["']).*\2$/);
  if (titleMatch?.[1]) {
    cleaned = titleMatch[1].trim();
  }

  return cleaned;
}

function normalizeReference(value: string): string {
  let normalized = value.replace(/\\/g, "/").trim();
  normalized = normalized.split("#")[0]?.split("?")[0] || "";
  normalized = normalized.replace(/^\.\//, "");
  normalized = normalized.replace(/^\//, "");

  if (!normalized) {
    return "";
  }

  return normalizePath(normalized);
}

function isRemoteReference(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith("//");
}

function getUniqueFileName(
  fileName: string,
  duplicateFileNames: Map<string, number>,
) {
  const count = duplicateFileNames.get(fileName) || 0;
  duplicateFileNames.set(fileName, count + 1);

  if (count === 0) {
    return fileName;
  }

  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) {
    return `${fileName}-${count + 1}`;
  }

  const base = fileName.slice(0, lastDot);
  const ext = fileName.slice(lastDot);
  return `${base}-${count + 1}${ext}`;
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXTENSION[ext] || "application/octet-stream";
}

function stripExtension(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  const lastDot = path.lastIndexOf(".");

  if (lastDot <= lastSlash) {
    return path;
  }

  return path.slice(0, lastDot);
}

const convertObsidianImageSyntax = (content: string): string =>
  content.replace(/!\[\[(.*?)\]\]/g, (match, target: string) => {
    const [pathPart, rawMeta] = target.split("|");
    const cleanPath = pathPart?.trim();

    if (!cleanPath) {
      return match;
    }

    const meta = rawMeta?.trim();
    const isSizeMeta = !!meta && /^\d+(x\d+)?$/i.test(meta);
    const altText =
      !meta || isSizeMeta ? cleanPath.split("/").pop() || cleanPath : meta;

    return `![${altText}](${cleanPath})`;
  });
