import { MarkdownView, Notice, Plugin } from "obsidian";
import { publish } from "./lib/publish";
import { unpublish } from "./lib/unpublish";
import { CMSSettingTab, DEFAULT_SETTINGS } from "./settings";
import type { CMSSettings } from "./types";

export default class CMSPlugin extends Plugin {
  settings: CMSSettings;

  async onload() {
    await this.loadSettings();

    const publishRibbonIconEl = this.addRibbonIcon(
      "upload-cloud",
      "Publish to Catter",
      async (_evt: MouseEvent) => {
        await this.publishCurrentDocument();
      },
    );
    publishRibbonIconEl.addClass("cms-publish-ribbon-class");

    const unpublishRibbonIconEl = this.addRibbonIcon(
      "trash-2",
      "Unpublish from Catter",
      async (_evt: MouseEvent) => {
        await this.unpublishCurrentDocument();
      },
    );
    unpublishRibbonIconEl.addClass("cms-unpublish-ribbon-class");

    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note to Catter",
      callback: async () => {
        await this.publishCurrentDocument();
      },
    });

    this.addCommand({
      id: "unpublish-current-note",
      name: "Unpublish current note from Catter",
      callback: async () => {
        await this.unpublishCurrentDocument();
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new CMSSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async publishCurrentDocument() {
    const file = this.getFile();
    if (!file) return;

    const content = await this.app.vault.read(file);

    const notice = new Notice("Publishing...", 0);

    const result = await publish(
      file,
      content,
      this.settings,
      this.app.metadataCache,
    );

    // Remove the processing notice and show the result
    notice.hide();

    if (result.success) {
      new Notice(result.message);
    } else {
      new Notice(`Publish failed: ${result.message}`);
    }
  }

  async unpublishCurrentDocument() {
    const file = this.getFile();
    if (!file) return;

    const notice = new Notice("Unpublishing...", 0);

    const content = await this.app.vault.read(file);

    const result = await unpublish(file, this.settings, content);

    // Remove the processing notice and show the result
    notice.hide();

    if (result.success) {
      new Notice(result.message);
    } else {
      new Notice(`Unpublish failed: ${result.message}`);
    }
  }

  getFile() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      new Notice("No active markdown view.");
      return;
    }

    const file = activeView.file;

    if (!file) {
      new Notice("No file is open");
      return;
    }

    return file;
  }
}
