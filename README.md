# Obsidian Upload DB Plugin

This plugin allows you to use Obsidian as a CMS by uploading your notes to a PostgreSQL database and images to S3-compatible storage (like MinIO) through a Next.js API.

## Features

- Upload the current note to your PostgreSQL database
- Upload images referenced in the note to S3-compatible storage via a Next.js API
- Parse frontmatter metadata and include it in the database
- Support for cover and coverSquare images in frontmatter
- Tags and keywords from frontmatter are stored in separate tables

## Installation

1. Download the latest release from this repository
2. Extract the zip file to your Obsidian plugins folder: `.obsidian/plugins/obsidian-upload-db/`
3. Enable the plugin in Obsidian's settings

## Configuration

The plugin requires the following settings to be configured:

- **Postgres URL**: Connection URL to your PostgreSQL database
- **API Upload URL**: URL to your Next.js API route for handling image uploads
- **API Auth Token**: Authentication token for securing your API route
- **Image URL Prefix**: Prefix path for uploaded images in the S3 bucket
- **S3 Bucket Name**: Name of the S3 bucket to use for image storage

### Optional settings if you want to use direct MinIO access:
- **MinIO Endpoint**: The endpoint for your MinIO server
- **MinIO Access Key**: Your MinIO access key
- **MinIO Secret Key**: Your MinIO secret key

## Setting up the Next.js API Route

The plugin uses a Next.js API route to upload images to your S3-compatible storage. Here's how to set it up:

1. Create a new API route in your Next.js project: `pages/api/upload.js` or `app/api/upload/route.ts`
2. Use the example implementation provided in `examples/nextjs-upload-api.ts` 
3. Install required dependencies:

```
npm install @aws-sdk/client-s3 formidable
```

4. Set up environment variables in your Next.js project:

```
MINIO_ENDPOINT=http://your-minio-server:9000
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
API_AUTH_TOKEN=your-api-auth-token
MINIO_PUBLIC_URL=http://your-minio-public-url
```

## Database Schema

The plugin expects the following database schema:

```sql
CREATE TABLE posts (
  slug TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  excerpt TEXT,
  locale TEXT DEFAULT 'en',
  cover TEXT,
  coverSquare TEXT,
  lastModified TEXT NOT NULL,
  shortened TEXT,
  shortExcerpt TEXT
);

CREATE TABLE post_tags (
  slug TEXT REFERENCES posts(slug) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (slug, tag)
);

CREATE TABLE post_keywords (
  slug TEXT REFERENCES posts(slug) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  PRIMARY KEY (slug, keyword)
);
```

## Usage

1. Open a note in Obsidian
2. Use the ribbon icon or command palette to upload the note
3. The note content and any referenced images will be uploaded
4. A confirmation message will be shown upon successful upload

## Frontmatter Support

The plugin supports the following frontmatter fields:

```yaml
---
title: My Note Title
description: A description of my note
date: 2023-05-15
excerpt: A longer excerpt for the note
locale: en
cover: path/to/cover-image.jpg
coverSquare: path/to/square-cover.jpg
tags:
  - tag1
  - tag2
keywords:
  - keyword1
  - keyword2
---
```

## Image Support

The plugin handles images in various formats:
- Standard Markdown: `![alt text](path/to/image.jpg)`
- Obsidian syntax: `![[image.jpg]]`
- HTML img tags: `<img src="path/to/image.jpg">`

Images can be:
- Local files in your vault
- Attachments in various Obsidian attachment folders
- Already-uploaded images (will be skipped)

## Development

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start the development build
4. Link or copy the output to your Obsidian plugins folder

## Building for Distribution

To build the plugin for distribution:

```bash
npm run build
```

This will create the following files in the project root:
- `main.js`: The compiled plugin
- `manifest.json`: The plugin manifest
- `styles.css`: The plugin styles (if any)

## License

MIT

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://github.com/obsidianmd/obsidian-api
