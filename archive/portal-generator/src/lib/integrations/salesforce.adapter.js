import { IntegrationAdapter } from './_adapter.interface.js';

export class SalesforceAdapter extends IntegrationAdapter {
  getMetadata() {
    return {
      name: 'Salesforce',
      category: 'CRM',
      auth: 'OAuth 2.0 / JWT Bearer',
      scopes: ['api', 'refresh_token', 'offline_access'],
      envVars: ['SF_CLIENT_ID', 'SF_CLIENT_SECRET', 'SF_USERNAME', 'SF_PRIVATE_KEY_PATH']
    };
  }
  async authenticate() { return true; }
  async provision() { return { status: 'stub' }; }
}
