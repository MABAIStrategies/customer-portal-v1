import { IntegrationAdapter } from './_adapter.interface.js';

export class GoHighLevelAdapter extends IntegrationAdapter {
  getMetadata() {
    return {
      name: 'GoHighLevel',
      category: 'CRM',
      auth: 'OAuth 2.0',
      scopes: ['contacts.write', 'pipelines.read', 'workflows.write'],
      envVars: ['GHL_CLIENT_ID', 'GHL_CLIENT_SECRET', 'GHL_REFRESH_TOKEN']
    };
  }
  async authenticate() { return true; }
  async provision() { return { status: 'stub' }; }
}
