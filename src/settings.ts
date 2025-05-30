import { App, PluginSettingTab, Setting } from 'obsidian';

import CMSPlugin from './main';

export interface CMSSettings {
	apiUploadUrl: string;
	apiUnpublishUrl: string;
	apiAuthToken: string;
}

export const DEFAULT_SETTINGS: CMSSettings = {
	apiUploadUrl: 'http://localhost:3000/api/upload',
	apiUnpublishUrl: 'http://localhost:3000/api/unpublish',
	apiAuthToken: 'your-auth-token',
};

export class CMSSettingTab extends PluginSettingTab {
	plugin: CMSPlugin;

	constructor(app: App, plugin: CMSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;

		containerEl.empty();

		new Setting(containerEl)
			.setName('API Upload URL')
			.setDesc('The URL of your API route for handling uploads.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.apiUploadUrl)
				.setValue(settings.apiUploadUrl)
				.onChange(async (value) => {
					settings.apiUploadUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Unpublish URL')
			.setDesc('The URL of your API route for handling unpublishing.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.apiUnpublishUrl)
				.setValue(settings.apiUnpublishUrl)
				.onChange(async (value) => {
					settings.apiUnpublishUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Auth Token')
			.setDesc('Authentication token for your API route.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.apiAuthToken)
				.setValue(settings.apiAuthToken)
				.onChange(async (value) => {
					settings.apiAuthToken = value;
					await this.plugin.saveSettings();
				}));
	}
}
