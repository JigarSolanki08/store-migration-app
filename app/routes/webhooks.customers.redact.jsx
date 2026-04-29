import { authenticate } from "../shopify.server";

/**
 * Mandatory GDPR webhook: customers/redact
 * Shopify sends this when a customer requests deletion of their personal data.
 * Since this app does not store personal customer data, we acknowledge with 200.
 */
export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // This app does not store personal customer data.
  // Respond with 200 to acknowledge the request.
  return new Response();
};
