import { type MetadataCache, TFile } from "obsidian";
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
  metadataCache: MetadataCache,
) {
  try {
    const convertedContent = convertObsidianImageSyntax(content);
    const assets = await processAssets(file, metadataCache);

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

async function processAssets(file: TFile, metadataCache: MetadataCache) {
  const cache = metadataCache.getFileCache(file);
  const seenFilePaths = new Set<string>();
  const duplicateFileNames = new Map<string, number>();
  const assets: UploadAsset[] = [];

  const linkCaches = [
    ...(cache?.embeds ?? []),
    ...(cache?.links ?? []),
    ...(cache?.frontmatterLinks ?? []),
  ];

  for (const linkCache of linkCaches) {
    // Strip any #heading or ^block anchor before resolving to a file path
    const linkpath = linkCache.link.split("#")[0];
    const resolved = metadataCache.getFirstLinkpathDest(linkpath, file.path);
    if (!(resolved instanceof TFile) || seenFilePaths.has(resolved.path)) {
      continue;
    }

    seenFilePaths.add(resolved.path);
    const fileName = getUniqueFileName(resolved.name, duplicateFileNames);
    const mimeType = guessMimeType(resolved.name);
    const buffer = await resolved.vault.readBinary(resolved);

    assets.push({ fileName, path: resolved.path, mimeType, buffer });
  }

  return assets;
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
