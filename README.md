# Obsidian as CMS

An Obsidian plugin that allows you to publish your notes as blog posts. I made this so that I can write and publish my blog posts through Obsidian, without the need to write and convert them to MDX files in VS Code or something.

## Features

- **Publishing**: Upload notes directly
- **Images**: Includes the images in the form data in the request
- **Frontmatter**: Extracts metadata from YAML frontmatter for images, specifically
- **Unpublish**: Remove content from your app when needed

## Installation

1. Download the plugin files to your `.obsidian/plugins/obsidian-as-cms/` directory
2. Enable the plugin in Obsidian settings
3. Configure your API endpoints and authentication token

## Configuration

Set up your API endpoints in the plugin settings:
- **Upload URL**: Endpoint for publishing content
- **Unpublish URL**: Endpoint for removing content
- **Auth Token**: Bearer token for API authentication

## Usage

### Publishing
- Click the upload cloud icon in the ribbon, or
- Use the command palette: "Upload current note to DB"

### Unpublishing
- Click the trash icon in the ribbon, or
- Use the command palette: "Unpublish current note from DB"

## API Implementation Example

Example API endpoints (these are from my own [Next.js blog](https://github.com/mkutay/catter))

### Upload Endpoint (`/api/upload`)

```typescript
import { revalidatePath } from "next/cache";
import { Post } from "@/config/types";
import { uploadImage } from "@/lib/images";
import { sql } from "@/lib/postgres";
import { createPost } from "@/lib/dbContentQueries";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const apiKey = process.env.UPLOAD_API_KEY;
  
  if (!apiKey) {
    return new Response("API key not configured on server", { status: 500 });
  }
  
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  try {
    const formData = await request.formData();
    const content = formData.get("content") as string;
    const slug = formData.get("slug") as string;
    const images = formData.getAll("images") as File[];

    // Process images
    for (const image of images) {
      const buffer = Buffer.from(await image.arrayBuffer());
      await uploadImage(image.name, buffer, image.size, image.type);
    }

    // Create post from content and frontmatter
    const post = createPost(content, slug);
    await insertIntoDB({ post });

    // Revalidate relevant pages
    revalidatePath("/projects");
    revalidatePath(`/posts/${slug}`);
    revalidatePath(`/${post.shortened}`);
    revalidatePath("/tags", "layout");
    revalidatePath("/posts/page/[id]", "page");
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error uploading:", error);
    return new Response(JSON.stringify({ error: "Failed to upload" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
```

### Unpublish Endpoint (`/api/unpublish`)

```typescript
import { revalidatePath } from "next/cache";
import { createPost } from "@/lib/dbContentQueries";
import { sql } from "@/lib/postgres";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const apiKey = process.env.UPLOAD_API_KEY;
  
  if (!apiKey) {
    return new Response("API key not configured on server", { status: 500 });
  }
  
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { content, slug } = body;

    const post = createPost(content, slug);
    await deleteFromDB(post.slug);

    // Revalidate relevant pages
    revalidatePath("/projects");
    revalidatePath(`/posts/${slug}`);
    revalidatePath(`/${post.shortened}`);
    revalidatePath("/tags", "layout");
    revalidatePath("/posts/page/[id]", "page");
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error unpublishing:", error);
    return new Response(JSON.stringify({ error: "Failed to unpublish" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
```

### Helper for completeness's sake

```typescript
export function createPost(content: string, slug: string): Post {
  const { data: frontmatter, content: contentWithoutFrontmatter } = matter(content);

  const getStringValue = (value: unknown, defaultValue: string): string => {
    return typeof value === 'string' ? value : defaultValue;
  };

  const getDateValue = (value: unknown, defaultValue: string) => {
    if (value instanceof Date) return value.toISOString();
    if (value) return new Date(value as string).toISOString();
    return defaultValue;
  };
  
  const getStringArray = (value: unknown): string[] => {
    return Array.isArray(value) ? value.filter(item => typeof item === 'string') as string[] : [];
  };
  
  return {
    slug: getStringValue(frontmatter.slug, slug),
    title: getStringValue(frontmatter.title, slug),
    content: contentWithoutFrontmatter,
    description: getStringValue(frontmatter.description, ""),
    date: getDateValue(frontmatter.date, new Date().toISOString()),
    excerpt: getStringValue(frontmatter.excerpt, ''),
    locale: getStringValue(frontmatter.locale, "en_UK"),
    cover: typeof frontmatter.cover === 'string' ? frontmatter.cover : null,
    coverSquare: typeof frontmatter.coverSquare === 'string' ? frontmatter.coverSquare : null,
    lastModified: getDateValue(frontmatter.lastModified, new Date().toISOString()),
    shortened: getStringValue(frontmatter.shortened, slug),
    shortExcerpt: getStringValue(frontmatter.shortExcerpt, ''),
    tags: getStringArray(frontmatter.tags),
    keywords: getStringArray(frontmatter.keywords)
  };
}
```