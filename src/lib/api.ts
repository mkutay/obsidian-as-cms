import { requestUrl } from "obsidian";
import type { CMSSettings, UploadAsset } from "src/types";

export async function uploadAPI(
  settings: CMSSettings,
  assets: UploadAsset[],
  content: string,
  slug: string,
) {
  const boundary = `----WebKitFormBoundary${Math.random().toString(16).slice(2)}`;
  const textEncoder = new TextEncoder();

  const parts: Uint8Array[] = [];

  const contentHeader = textEncoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="content"\r\n\r\n` +
      `${content}\r\n`,
  );
  parts.push(contentHeader);

  const slugHeader = textEncoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="slug"\r\n\r\n` +
      `${slug}\r\n`,
  );
  parts.push(slugHeader);

  for (const asset of assets) {
    const name = asset.fileName;

    const imageHeader = textEncoder.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files"; filename="${name}"\r\n` +
        `Content-Type: ${asset.mimeType}\r\n` +
        `X-Obsidian-Asset-Path: ${asset.path}\r\n\r\n`,
    );
    parts.push(imageHeader);

    parts.push(new Uint8Array(asset.buffer));

    const lineBreak = textEncoder.encode("\r\n");
    parts.push(lineBreak);
  }

  const finalBoundary = textEncoder.encode(`--${boundary}--\r\n`);
  parts.push(finalBoundary);

  const totalSize = parts.reduce((sum, part) => sum + part.length, 0);

  const combinedBuffer = new Uint8Array(totalSize);
  let offset = 0;

  for (const part of parts) {
    combinedBuffer.set(part, offset);
    offset += part.length;
  }

  const response = await requestUrl({
    url: settings.apiUploadUrl,
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiAuthToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: combinedBuffer.buffer,
  });

  if (response.status !== 200) {
    console.error("API Upload failed:", response.text);
    throw new Error(`Upload failed with status: ${response.status}`);
  }
}

export async function unpublishAPI(
  slug: string,
  settings: CMSSettings,
  content: string,
) {
  try {
    const response = await requestUrl({
      url: settings.apiUnpublishUrl,
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiAuthToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slug, content }),
    });

    if (response.status !== 200) {
      console.error("Unpublish API failed:", response.text);
      throw new Error(`Unpublish failed with status: ${response.status}`);
    }

    return { success: true, message: "Note unpublished successfully!" };
  } catch (error) {
    console.error("Error unpublishing note:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
