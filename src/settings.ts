import { App, PluginSettingTab, Setting } from 'obsidian';

import CMSPlugin from './main';

export interface CMSSettings {
	postgresUrl: string;
	apiUploadUrl: string;
	apiRevalidateUrl: string;
	apiAuthToken: string;
}

export const DEFAULT_SETTINGS: CMSSettings = {
	postgresUrl: 'postgres://localhost:5432/postgres',
	apiUploadUrl: 'http://localhost:3000/api/uploadImage',
	apiRevalidateUrl: 'http://localhost:3000/api/revalidate',
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
			.setName('Postgres URL')
			.setDesc('URL for the PostgreSQL database.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.postgresUrl)
				.setValue(settings.postgresUrl)
				.onChange(async (value) => {
					settings.postgresUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Upload URL')
			.setDesc('The URL of your API route for handling image uploads.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.apiUploadUrl)
				.setValue(settings.apiUploadUrl)
				.onChange(async (value) => {
					settings.apiUploadUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Revalidation URL')
			.setDesc('The URL of your API route for handling revalidation.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.apiRevalidateUrl)
				.setValue(settings.apiRevalidateUrl)
				.onChange(async (value) => {
					settings.apiRevalidateUrl = value;
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
