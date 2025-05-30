import { TFile } from "obsidian";

import { CMSSettings } from "../settings";
import { unpublishAPI } from "./api";

export async function unpublish(file: TFile, settings: CMSSettings, content: string) {
  try {
    const slug = file.basename;

    await unpublishAPI(slug, settings, content)
    
    return { success: true, message: "Note unpublished successfully!" };
  } catch (error) {
    console.error("Error unpublishing note:", error);
    return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}