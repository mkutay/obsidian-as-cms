import { Post } from "src/types";
import { CMSSettings } from "../settings";
import { requestUrl } from "obsidian";

/**
 * Upload an image to the configured API endpoint
 * 
 * @param settings The plugin settings containing API URL and token
 * @param fileName The name of the file to be uploaded
 * @param buffer The file contents as a buffer
 * @param contentType The content type of the file (e.g., image/jpeg)
 * @returns The URL of the uploaded file or null if upload failed
 */
export async function uploadImageViaApi(
  settings: CMSSettings, 
  fileName: string,
  buffer: ArrayBuffer, 
  contentType: string
): Promise<string | null> {
  try {
    const boundary = `----WebKitFormBoundary${Math.random().toString(16).slice(2)}`;
    
    // Manual construction of multipart/form-data since FormData is not directly supported
    let body = '';

    const name = fileName.replace(/\s+/g, '-');
    console.log(name);
    
    // Add the filename field
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="url"\r\n\r\n`;
    body += `${name}\r\n`;
    
    // Add the binary file data
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="image"; filename="${name}"\r\n`;
    body += `Content-Type: ${contentType}\r\n\r\n`;

    // Convert text part to ArrayBuffer
    const textEncoder = new TextEncoder();
    const textPart = textEncoder.encode(body);
    
    // Create the file footer (boundary end)
    const footer = `\r\n--${boundary}--\r\n`;
    const footerPart = textEncoder.encode(footer);
    
    // Combine all parts into a single ArrayBuffer
    const combinedBuffer = new Uint8Array(textPart.length + buffer.byteLength + footerPart.length);
    combinedBuffer.set(textPart, 0);
    combinedBuffer.set(new Uint8Array(buffer), textPart.length);
    combinedBuffer.set(footerPart, textPart.length + buffer.byteLength);

    // Use Obsidian's requestUrl which handles CORS properly
    const response = await requestUrl({
      url: settings.apiUploadUrl,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiAuthToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: combinedBuffer.buffer
    });
    
    if (response.status !== 200) {
      console.error('API Upload failed:', response.text);
      throw new Error(`Upload failed with status: ${response.status}`);
    }
    
    const data = response.json;
    
    return data.url || null;
  } catch (error) {
    console.error('Error uploading image via API:', error);
    return null;
  }
}

export async function revalidate(
  post: Post,
  settings: CMSSettings,
): Promise<string | null> {
  try {
    const boundary = `----WebKitFormBoundary${Math.random().toString(16).slice(2)}`;
    
    // Manual construction of multipart/form-data since FormData is not directly supported
    let body = '';
    
    // Add the slug field
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="slug"\r\n\r\n`;
    body += `${post.slug}\r\n`;
    
    // Add the shortened field
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="shortened"\r\n\r\n`;
    body += `${post.shortened}\r\n`;
    
    // Add the tags field
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="tags"\r\n\r\n`;
    body += `${Array.isArray(post.tags) ? post.tags.join(',') : ''}\r\n`;
    
    body += `--${boundary}--\r\n`;
    
    const textEncoder = new TextEncoder();
    const bodyBuffer = textEncoder.encode(body).buffer;
    
    const response = await requestUrl({
      url: settings.apiRevalidateUrl,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiAuthToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer,
    });
    
    if (response.status !== 200) {
      console.error('API revalidation failed:', response.text);
      throw new Error(`Revalidation failed with status: ${response.status}`);
    }
    
    const data = response.json;
    
    return data.url || null;
  } catch (error) {
    console.error('Error revalidating via API:', error);
    return null;
  }
}
