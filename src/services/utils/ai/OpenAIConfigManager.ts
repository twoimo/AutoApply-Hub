import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'openai.config.json');

export interface OpenAIConfigData {
  assistantId?: string;
  threadId?: string;
}

export class OpenAIConfigManager {
  static loadConfig(): OpenAIConfigData {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
      } catch {
        return {};
      }
    }
    return {};
  }

  static saveConfig(config: OpenAIConfigData): void {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }
}
