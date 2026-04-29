import { authenticate } from "../shopify.server";

/**
 * Mandatory GDPR webhook: customers/data_request
 * Shopify sends this when a customer requests their stored data.
 * Since this app only stores ImportJob records (no personal customer data),
 * we acknowledge the request with a 200 response.
 */
export const action = async ({ request }) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // This app does not store personal customer data beyond import job metadata.
  // Respond with 200 to acknowledge the request.
  return new Response();
};
