import { IntegrationAdapter } from './_adapter.interface.js';

export class Microsoft365Adapter extends IntegrationAdapter {
  getMetadata() {
    return {
      name: 'Microsoft 365',
      category: 'Email/Storage',
      auth: 'OAuth 2.0 / Graph',
      scopes: ['Mail.Send', 'Files.ReadWrite', 'Calendars.ReadWrite'],
      envVars: ['MS365_CLIENT_ID', 'MS365_CLIENT_SECRET', 'MS365_TENANT_ID']
    };
  }
  async authenticate() { return true; }
  async provision() { return { status: 'stub' }; }
}
