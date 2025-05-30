import { FrontMatterCache, TFile, Vault } from "obsidian";

import { uploadAPI } from "./api";
import { CMSSettings } from "../settings";

export async function upload(file: TFile, content: string, settings: CMSSettings, frontmatter: FrontMatterCache | undefined) {
  try {
    const convertedContent = convertObsidianImageSyntax(content);

    const coverImage = frontmatter && frontmatter.cover ? frontmatter.cover as string : null;
    const coverSquareImage = frontmatter && frontmatter.coverSquare ? frontmatter.coverSquare as string : null;

    const images = await processImages(convertedContent, file, coverImage, coverSquareImage);

    await uploadAPI(settings, images, content, file.basename);

    return { success: true, message: "Note uploaded successfully!" };
  } catch (error) {
    console.error("Error uploading note:", error);
    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function processImages(content: string, file: TFile, coverImage: string | null, coverSquareImage: string | null) {
  const imageUrls = getImageUrls(content);
  if (coverImage) {
    imageUrls.push(coverImage);
  }
  if (coverSquareImage) {
    imageUrls.push(coverSquareImage);
  }

  const images: {
    fileName: string;
    buffer: ArrayBuffer;
  }[] = [];
  
  for (const imageUrl of imageUrls) {
    // Only process local attachments
    if (!imageUrl.startsWith('http')) {
      const vault = file.vault;
      const imageFile = findImage(imageUrl, vault, file);

      if (imageFile instanceof TFile) {
        const arrayBuffer = await vault.readBinary(imageFile);
        images.push({
          fileName: imageFile.name,
          buffer: arrayBuffer
        });
      }
    }
  }
  
  return images;
}

function findImage(relativePath: string, vault: Vault, currentFile: TFile) {
  // First try to get the file as an absolute path
  let imageFile = vault.getAbstractFileByPath(relativePath);
  
  // If that fails, try to resolve it as a relative path using Obsidian's resolveAttachment
  if (!imageFile) {
    // Get all attachments in the vault
    const attachmentFiles = vault.getFiles().filter(file => 
      file.extension.match(/(jpg|jpeg|png|gif|webp|svg|bmp|tiff)/i)
    );
    
    // Try to match the filename or path ending
    const filename = relativePath.split('/').pop() || '';
    const matchedFile = attachmentFiles.find(file => 
      file.path.endsWith(relativePath) || file.name === filename
    );
    
    if (matchedFile) {
      imageFile = matchedFile;
    }
    
    // If still not found, try to look in the attachment folder associated with the current file
    if (!imageFile) {
      // Check for common attachment folder patterns
      const noteFolder = currentFile.parent;
      if (noteFolder) {
        const possibleAttachmentFolders = [
          noteFolder.path + '/attachments',
          noteFolder.path + '/images',
          noteFolder.path + '/assets'
        ];
        
        for (const folderPath of possibleAttachmentFolders) {
          const folder = vault.getAbstractFileByPath(folderPath);
          if (folder) {
            const potentialImagePath = folderPath + '/' + filename;
            const potentialFile = vault.getAbstractFileByPath(potentialImagePath);
            if (potentialFile instanceof TFile) {
              imageFile = potentialFile;
              break;
            }
          }
        }
      }
    }
  }

  return imageFile;
}

const getImageUrls = (content: string): string[] => {
  const imageUrls: string[] = [];
  
  // Standard Markdown image syntax: ![alt](url)
  const standardImgRegex = /!\[(.*?)\]\((.*?)\)/g;
  let match;
  while ((match = standardImgRegex.exec(content)) !== null) {
    const imageUrl = match[2];
    // Remove query parameters or anchors if they exist
    const cleanUrl = imageUrl.split('#')[0].split('?')[0];
    imageUrls.push(cleanUrl);
  } 
  
  // Obsidian's specific image embedding syntax: ![[image.jpg]]
  const obsidianImgRegex = /!\[\[(.*?)\]\]/g;
  while ((match = obsidianImgRegex.exec(content)) !== null) {
    const imageUrl = match[1];
    // Remove query parameters or anchors if they exist
    const cleanUrl = imageUrl.split('#')[0].split('?')[0];
    imageUrls.push(cleanUrl);
  }
  
  // HTML image tags: <img src="url" />
  const htmlImgRegex = /<img.*?src=["'](.*?)["'].*?>/g;
  while ((match = htmlImgRegex.exec(content)) !== null) {
    const imageUrl = match[1];
    // Remove query parameters or anchors if they exist
    const cleanUrl = imageUrl.split('#')[0].split('?')[0];
    imageUrls.push(cleanUrl);
  }
  
  // Next.js Image component: <Image src="url" />
  const nextJsImgRegex = /<Image.*?src=["'](.*?)["'].*?>/g;
  while ((match = nextJsImgRegex.exec(content)) !== null) {
    const imageUrl = match[1];
    // Remove query parameters or anchors if they exist
    const cleanUrl = imageUrl.split('#')[0].split('?')[0];
    imageUrls.push(cleanUrl);
  }
  
  // Next.js Image component with imported images or object syntax
  const nextJsImgObjRegex = /<Image.*?src=\{(.*?)\}.*?>/g;
  while ((match = nextJsImgObjRegex.exec(content)) !== null) {
    // This might be a reference to an imported image or an object
    // We'll extract paths that look like file paths
    const objContent = match[1];
    const pathMatch = objContent.match(/(["'])(\/[^"']+?)\1/);
    if (pathMatch) {
      imageUrls.push(pathMatch[2]);
    }
  }
  
  // Remove duplicates
  return [...new Set(imageUrls)];
};

/**
 * Converts Obsidian-specific image syntax (![[image.jpg]]) to standard Markdown syntax (![image.jpg](image.jpg))
 * 
 * @param content The markdown content to process
 * @returns The content with converted image syntax
 */
export function convertObsidianImageSyntax(content: string): string {
  // Replace ![[image.jpg]] with ![image.jpg](image.jpg)
  return content.replace(/!\[\[(.*?)\]\]/g, (match, imagePath) => {
    // Remove any pipe and additional text for display (like ![[image.jpg|alt text]])
    const cleanPath = imagePath.split('|')[0].trim().replace(/\s+/g, '-');
    
    // Use the filename as alt text or the provided alt text after the pipe
    const altText = imagePath.includes('|') 
      ? imagePath.split('|')[1].trim() 
      : cleanPath.split('/').pop() || cleanPath;
    
    return `![${altText}](/${cleanPath})`;
  });
}