import { StripeAdapter } from './stripe.adapter.js';
import { GoHighLevelAdapter } from './gohighlevel.adapter.js';
import { GoogleWorkspaceAdapter } from './google-workspace.adapter.js';
import { Microsoft365Adapter } from './microsoft-365.adapter.js';
import { HubspotAdapter } from './hubspot.adapter.js';
import { SalesforceAdapter } from './salesforce.adapter.js';

const registry = {
  stripe: StripeAdapter,
  gohighlevel: GoHighLevelAdapter,
  'google-workspace': GoogleWorkspaceAdapter,
  'microsoft-365': Microsoft365Adapter,
  hubspot: HubspotAdapter,
  salesforce: SalesforceAdapter
};

export function getAdapter(key, credentials = {}, config = {}) {
  const AdapterClass = registry[key];
  if (!AdapterClass) throw new Error(`Unknown integration key: ${key}`);
  return new AdapterClass(credentials, config);
}
