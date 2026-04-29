import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory GDPR webhook: shop/redact
 * Shopify sends this 48 hours after a merchant uninstalls the app.
 * We must delete all data associated with the shop.
 */
export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const shopDomain = payload?.shop_domain || shop;

  // Delete all import job records for this shop
  try {
    await db.importJob.deleteMany({ where: { shop: shopDomain } });
    console.log(`Deleted all ImportJob records for ${shopDomain}`);
  } catch (err) {
    console.error(`Error deleting data for ${shopDomain}:`, err.message);
  }

  return new Response();
};
