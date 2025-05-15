import { MarkdownView, Notice, Plugin } from 'obsidian';
import matter from 'gray-matter';

import { CMSSettings, DEFAULT_SETTINGS, CMSSettingTab } from './settings';
import { initialiseSql } from './lib/postgres';
import { upload } from './lib/upload';

export default class CMSPlugin extends Plugin {
	settings: CMSSettings;

	async onload() {
		await this.loadSettings();
		
		initialiseSql(this.settings);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('upload-cloud', 'Upload to DB', async (evt: MouseEvent) => {
			await this.uploadCurrentDocument();
		});
		ribbonIconEl.addClass('cms-upload-ribbon-class');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'upload-current-note',
			name: 'Upload current note to DB',
			callback: async () => {
				await this.uploadCurrentDocument();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CMSSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
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

		try {
			const content = await this.app.vault.read(file);
			const { data, content: contentWithoutFrontmatter } = matter(content);

			// Show processing notice
			const notice = new Notice("Uploading to CMS...", 0);
			
			// Upload the note
			const result = await upload(file, contentWithoutFrontmatter, data, this.settings);
			
			// Remove the processing notice and show the result
			notice.hide();
			
			if (result.success) {
				new Notice(result.message);
			} else {
				new Notice(`Upload failed: ${result.message}`);
			}
		} catch (error) {
			new Notice(`Error uploading: ${error instanceof Error ? error.message : String(error)}`);
			console.error('Upload error:', error);
		}
	}
}