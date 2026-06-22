export class IntegrationAdapter {
  constructor(credentials = {}, config = {}) {
    this.credentials = credentials;
    this.config = config;
  }

  async authenticate() { throw new Error('Not implemented'); }
  async testConnection() { throw new Error('Not implemented'); }
  async provision(engagement) { throw new Error('Not implemented'); }
  async pushContact(contact) { throw new Error('Not implemented'); }
  async syncStatus() { throw new Error('Not implemented'); }
  getMetadata() { throw new Error('Not implemented'); }
}
