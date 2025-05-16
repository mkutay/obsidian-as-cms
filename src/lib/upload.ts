import { TFile, Vault } from "obsidian";

import { revalidate, uploadImageViaApi } from "./api";
import { getSql } from "./postgres";
import { Post } from "../types";
import { CMSSettings } from "../settings";

export async function upload(file: TFile, content: string, frontmatter: Record<string, unknown>, settings: CMSSettings) {
  try {
    const post = createPost(frontmatter, content, file);
    
    await processImages(content, file, settings);
    
    // Update cover and coverSquare in post object if they exist in frontmatter
    if (typeof frontmatter.cover === 'string') {
      post.cover = await uploadFrontmatterImage(frontmatter.cover, file, settings);
    }
    
    if (typeof frontmatter.coverSquare === 'string') {
      post.coverSquare = await uploadFrontmatterImage(frontmatter.coverSquare, file, settings);
    }
    
    // Insert into database
    await insertIntoDB({ post });

    await revalidate(post, settings);
    
    return { success: true, message: "Note uploaded successfully!" };
  } catch (error) {
    console.error("Error uploading note:", error);
    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function unpublish(file: TFile, settings: CMSSettings, content: string, frontmatter: Record<string, unknown>) {
  try {
    const slug = file.basename;
    const post = createPost(frontmatter, content, file);
    
    await deleteFromDB(slug);
    
    await revalidate(post, settings);
    
    return { success: true, message: "Note unpublished successfully!" };
  } catch (error) {
    console.error("Error unpublishing note:", error);
    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function createPost(frontmatter: Record<string, unknown>, content: string, file: TFile): Post {
  // Helper function to safely get string value
  const getStringValue = (value: unknown, defaultValue: string): string => {
    return typeof value === 'string' ? value : defaultValue;
  };

  const getDateValue = (value: unknown, defaultValue: string) => {
    if (value instanceof Date) return value.toISOString();
    if (value) return new Date(value as string).toISOString();
    return defaultValue;
  };

  const contentWithoutFrontmatter = content.replace(/---[\s\S]*?---/, "").trim();
  
  const description = contentWithoutFrontmatter.slice(0, 150) + "...";
  const slug = getStringValue(frontmatter.slug, file.basename);
  
  // Helper function to safely get string array
  const getStringArray = (value: unknown): string[] => {
    return Array.isArray(value) ? value.filter(item => typeof item === 'string') as string[] : [];
  };
  
  // Create the post object
  const post: Post = {
    slug,
    title: getStringValue(frontmatter.title, file.basename),
    content,
    description: getStringValue(frontmatter.description, description),
    date: getDateValue(frontmatter.date, new Date().toISOString()),
    excerpt: getStringValue(frontmatter.excerpt, ''),
    locale: getStringValue(frontmatter.locale, "en_UK"),
    cover: typeof frontmatter.cover === 'string' ? frontmatter.cover : null,
    coverSquare: typeof frontmatter.coverSquare === 'string' ? frontmatter.coverSquare : null,
    lastModified: getDateValue(frontmatter.lastModified, new Date(file.stat.mtime).toISOString()),
    shortened: getStringValue(frontmatter.shortened, slug),
    shortExcerpt: getStringValue(frontmatter.shortExcerpt, ''),
    tags: getStringArray(frontmatter.tags),
    keywords: getStringArray(frontmatter.keywords)
  };
  
  return post;
}

async function processImages(content: string, file: TFile, settings: CMSSettings): Promise<string[]> {
  const imageUrls = getImageUrls(content);
  const processedUrls = [];
  
  for (const imageUrl of imageUrls) {
    try {
      // Only process local attachments
      if (!imageUrl.startsWith('http')) {
        const uploadedUrl = await uploadLocalImage(imageUrl, file, settings);
        if (uploadedUrl) {
          processedUrls.push(uploadedUrl);
        } else {
          console.warn(`Failed to upload image: ${imageUrl}`);
        }
      }
    } catch (err) {
      console.error(`Failed to process image: ${imageUrl}`, err);
    }
  }
  
  return processedUrls;
}

async function uploadLocalImage(relativeImagePath: string, currentFile: TFile, settings: CMSSettings): Promise<string | null> {
  try {
    const vault = currentFile.vault;
    
    const imageFile = findImage(relativeImagePath, vault, currentFile);
    
    if (imageFile instanceof TFile) {
      const arrayBuffer = await vault.readBinary(imageFile);
      
      const ext = imageFile.extension.toLowerCase();
      const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      
      // Upload the image via API instead of direct Minio upload
      const uploadedUrl = await uploadImageViaApi(
        settings,
        relativeImagePath,
        arrayBuffer,
        contentType
      );
      
      return uploadedUrl;
    }

    return null;
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
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

async function uploadFrontmatterImage(imagePath: string, currentFile: TFile, settings: CMSSettings): Promise<string | null> {
  try {
    // First try to upload the image using our standard method
    const result = await uploadLocalImage(imagePath, currentFile, settings);
    if (result) return result;
    
    // If that failed, we need to handle some special frontmatter image path cases
    const vault = currentFile.vault;
    
    // Check if the path is a URL - if so, we don't need to upload it
    if (imagePath.match(/^https?:\/\//i)) {
      return imagePath;
    }
    
    // Look in common site-specific image folders at the root of the vault
    const commonImageFolders = [
      'assets', 
      'images', 
      'attachments', 
      'media',
      '_attachments',
      '_assets',
      '_images'
    ];
    
    for (const folder of commonImageFolders) {
      const potentialPath = `${folder}/${imagePath}`;
      const imageFile = vault.getAbstractFileByPath(potentialPath);
      
      if (imageFile instanceof TFile) {
        // Read the file contents
        const arrayBuffer = await vault.readBinary(imageFile);
        
        // Determine content type from extension
        const ext = imageFile.extension.toLowerCase();
        const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        
        // Upload the image via API instead of direct Minio upload
        const uploadedUrl = await uploadImageViaApi(
          settings,
          imagePath,
          arrayBuffer,
          contentType
        );
        
        return uploadedUrl;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error uploading frontmatter image:", error);
    return null;
  }
}

const insertIntoDB = async ({ post }: { post: Post }) => {
  const sql = getSql();
  
  await sql`
    INSERT INTO posts (slug, content, title, description, date, excerpt, locale, cover, coverSquare, lastModified, shortened, shortExcerpt)
    VALUES (${post.slug}, ${post.content}, ${post.title}, ${post.description}, ${post.date}, ${post.excerpt}, ${post.locale}, ${post.cover}, ${post.coverSquare}, ${post.lastModified}, ${post.shortened}, ${post.shortExcerpt})
    ON CONFLICT (slug) DO UPDATE SET
      content = ${post.content},
      title = ${post.title},
      description = ${post.description},
      date = ${post.date},
      excerpt = ${post.excerpt},
      locale = ${post.locale},
      cover = ${post.cover},
      coverSquare = ${post.coverSquare},
      lastModified = ${post.lastModified},
      shortened = ${post.shortened},
      shortExcerpt = ${post.shortExcerpt}
  `;

  // Delete existing tags and keywords for this post and re-insert them
  await sql`DELETE FROM post_tags WHERE slug = ${post.slug}`;
  await sql`DELETE FROM post_keywords WHERE slug = ${post.slug}`;

  for (const tag of post.tags) {
    await sql`
      INSERT INTO post_tags (slug, tag)
      VALUES (${post.slug}, ${tag})
      ON CONFLICT (slug, tag) DO NOTHING;
    `;
  }

  for (const keyword of post.keywords) {
    await sql`
      INSERT INTO post_keywords (slug, keyword)
      VALUES (${post.slug}, ${keyword})
      ON CONFLICT (slug, keyword) DO NOTHING;
    `
  }

  await sql`
    INSERT INTO views (slug, count)
    VALUES (${post.slug}, 0)
    ON CONFLICT (slug) DO NOTHING;
  `;
}

const deleteFromDB = async (slug: string) => {
  const sql = getSql();
  
  await sql`DELETE FROM post_tags WHERE slug = ${slug}`;
  await sql`DELETE FROM post_keywords WHERE slug = ${slug}`;
  
  // Then delete the post itself
  await sql`DELETE FROM posts WHERE slug = ${slug}`;
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
  
  // Remove duplicates
  return [...new Set(imageUrls)];
};
