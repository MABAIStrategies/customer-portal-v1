import { IntegrationAdapter } from './_adapter.interface.js';

export class GoogleWorkspaceAdapter extends IntegrationAdapter {
  getMetadata() {
    return {
      name: 'Google Workspace',
      category: 'Email/Storage',
      auth: 'OAuth 2.0',
      scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/calendar'],
      envVars: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN']
    };
  }
  async authenticate() { return true; }
  async provision() { return { status: 'stub' }; }
}
