import { IntegrationAdapter } from './_adapter.interface.js';

export class HubspotAdapter extends IntegrationAdapter {
  getMetadata() {
    return {
      name: 'HubSpot',
      category: 'CRM',
      auth: 'OAuth 2.0 / Private App',
      scopes: ['crm.objects.deals.write', 'crm.objects.contacts.write'],
      envVars: ['HUBSPOT_ACCESS_TOKEN']
    };
  }
  async authenticate() { return true; }
  async provision() { return { status: 'stub' }; }
}
