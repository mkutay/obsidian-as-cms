# Obsidian as CMS

An Obsidian plugin that publishes the active note to your blog backend and can also unpublish it.

## What It Does

- Publishes the active note content to your API.
- Uploads referenced local assets as multipart file parts.
- Unpublishes a note using the same slug and content payload model.
- Uses a bearer token for API authentication.

## Current Reference Resolution (Important)

Asset discovery now uses Obsidian's metadata cache directly, not text scanning heuristics.

For the active note, the plugin reads references from:

- `embeds`
- `links`
- `frontmatterLinks`

Each reference is resolved with Obsidian's link resolver (`getFirstLinkpathDest`) relative to the current note path. Anchor fragments (`#heading` and block refs) are stripped before resolving.

Only successfully resolved local vault files are uploaded.

## Behavior Details

- Duplicate asset references are uploaded once per publish action.
- If multiple assets share the same file name, the plugin appends numeric suffixes (for example, `image-2.png`) in the upload payload.
- Obsidian embed syntax such as `![[image.png|300x200]]` is converted to Markdown image syntax in the content sent to your API.
- Slug is the active note basename.
- Publish/unpublish are considered successful only when the API responds with HTTP status `200`.

## Commands and UI

- Ribbon action: Publish to Catter
- Ribbon action: Unpublish from Catter
- Command: Publish current note to Catter
- Command: Unpublish current note from Catter

## Configuration

Set these in plugin settings:

- API Upload URL
- API Unpublish URL
- API Auth Token

Default values:

- Upload URL: `http://localhost:3000/api/upload`
- Unpublish URL: `http://localhost:3000/api/unpublish`
- Auth token: `your-auth-token`

## Required API Routes

You need two routes.

### 1) Upload Route

- Method: `POST`
- URL: whatever you set in API Upload URL
- Auth header: `Authorization: Bearer <token>`
- Content-Type: `multipart/form-data` with boundary

Form data fields expected:

- `content`: string, full note content after Obsidian image syntax normalization
- `slug`: string, note basename
- `files`: repeated file parts (0 or more)

For each `files` part:

- Form field name: `files`
- Filename: sent by plugin (may include dedupe suffix)
- Part `Content-Type`: inferred from file extension or `application/octet-stream`
- Custom part header: `X-Obsidian-Asset-Path` with original vault path

Success/Failure contract:

- Any response with status `200` is treated as success.
- Any non-`200` response is treated as failure.

### 2) Unpublish Route

- Method: `POST`
- URL: whatever you set in API Unpublish URL
- Auth header: `Authorization: Bearer <token>`
- Content-Type: `application/json`

JSON body expected:

- `slug`: string, note basename
- `content`: string, current note content

Success/Failure contract:

- Any response with status `200` is treated as success.
- Any non-`200` response is treated as failure.

## Installation

1. Build the plugin.
2. Copy plugin files into `.obsidian/plugins/obsidian-as-cms/`.
3. Enable the plugin in Obsidian.
4. Configure API URLs and token.

## Local Development

- `bun run dev` for watch builds
- `bun run build` for production build
- `bun run check` for formatting/lint fixes via Biome
