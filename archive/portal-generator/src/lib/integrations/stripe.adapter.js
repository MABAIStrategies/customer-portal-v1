import { IntegrationAdapter } from './_adapter.interface.js';

export class StripeAdapter extends IntegrationAdapter {
  getMetadata() {
    return {
      name: 'Stripe',
      category: 'Payments',
      auth: 'API key',
      scopes: ['payment_links', 'checkout_sessions', 'webhooks'],
      envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
    };
  }
  async authenticate() {
    // TODO: verify key with Stripe API
    return true;
  }
  async provision(engagement) {
    // TODO: create customer + payment link for live proposal total
    return { status: 'stub', paymentLink: this.config.stripePaymentLink };
  }
}
