import { MarkdownView, Notice, Plugin } from 'obsidian';

import { CMSSettings, DEFAULT_SETTINGS, CMSSettingTab } from './settings';
import { upload } from './lib/upload';
import { unpublish } from './lib/unpublish';

export default class CMSPlugin extends Plugin {
	settings: CMSSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon for upload
		const uploadRibbonIconEl = this.addRibbonIcon('upload-cloud', 'Upload to DB', async (evt: MouseEvent) => {
			await this.uploadCurrentDocument();
		});
		uploadRibbonIconEl.addClass('cms-upload-ribbon-class');

		// Add a ribbon icon for unpublish
		const unpublishRibbonIconEl = this.addRibbonIcon('trash-2', 'Unpublish from DB', async (evt: MouseEvent) => {
			await this.unpublishCurrentDocument();
		});
		unpublishRibbonIconEl.addClass('cms-unpublish-ribbon-class');

		// This adds a simple command for upload
		this.addCommand({
			id: 'upload-current-note',
			name: 'Upload current note to DB',
			callback: async () => {
				await this.uploadCurrentDocument();
			},
		});

			// Add command for unpublish
		this.addCommand({
			id: 'unpublish-current-note',
			name: 'Unpublish current note from DB',
			callback: async () => {
				await this.unpublishCurrentDocument();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CMSSettingTab(this.app, this));
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async uploadCurrentDocument() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active markdown view');
			return;
		}

		const file = activeView.file;

		if (!file) {
			new Notice('No file is open');
			return;
		}

		const content = await this.app.vault.read(file);
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

		// Show processing notice
		const notice = new Notice("Uploading to CMS...", 0);
		
		const result = await upload(file, content, this.settings, frontmatter);
		
		// Remove the processing notice and show the result
		notice.hide();
		
		if (result.success) {
			new Notice(result.message);
		} else {
			new Notice(`Upload failed: ${result.message}`);
		}
	}

	async unpublishCurrentDocument() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active markdown view');
			return;
		}

		const file = activeView.file;

		if (!file) {
			new Notice('No file is open');
			return;
		}

		try {
			const notice = new Notice("Unpublishing from DB...", 0);

			const content = await this.app.vault.read(file);
			
			const result = await unpublish(file, this.settings, content);
			
			// Remove the processing notice and show the result
			notice.hide();
			
			if (result.success) {
				new Notice(result.message);
			} else {
				new Notice(`Unpublish failed: ${result.message}`);
			}
		} catch (error) {
			new Notice(`Error unpublishing: ${error instanceof Error ? error.message : String(error)}`);
			console.error('Unpublish error:', error);
		}
	}
}