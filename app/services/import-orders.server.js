// Orders import service - uses draftOrderCreate + draftOrderComplete
// Note: Shopify does not allow setting custom order dates/numbers via API.
// Historical orders are created as completed draft orders.

function getCol(headers, row, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? row[i]?.trim() || "" : "";
}

export async function importOrders({ admin, rows, headers }) {
  const dataRows = rows.slice(1);
  let imported = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const email = getCol(headers, row, "Email");
    const lineItemName = getCol(headers, row, "Line Item Name");
    const lineItemPrice = getCol(headers, row, "Line Item Price");

    if (!email || !lineItemName || !lineItemPrice) {
      failed++;
      errors.push(`Row ${i + 2}: Missing required fields (Email, Line Item Name, or Line Item Price), skipped.`);
      continue;
    }

    const lineItemQty = parseInt(getCol(headers, row, "Line Item Quantity") || "1");
    const lineItemSku = getCol(headers, row, "Line Item SKU");
    const shippingName = getCol(headers, row, "Shipping Name");
    const shippingAddr1 = getCol(headers, row, "Shipping Address1");
    const shippingCity = getCol(headers, row, "Shipping City");
    const shippingProvince = getCol(headers, row, "Shipping Province Code");
    const shippingCountry = getCol(headers, row, "Shipping Country Code");
    const shippingZip = getCol(headers, row, "Shipping Zip");
    const tags = getCol(headers, row, "Tags");
    const note = getCol(headers, row, "Note");

    const draftOrderInput = {
      email,
      lineItems: [
        {
          title: lineItemName,
          sku: lineItemSku || null,
          quantity: lineItemQty,
          originalUnitPrice: lineItemPrice,
        },
      ],
      tags: tags ? tags.split(",").map((t) => t.trim()) : ["migrated"],
      note: note || "Imported from migration app",
      shippingAddress: shippingAddr1
        ? {
            firstName: shippingName?.split(" ")[0] || "",
            lastName: shippingName?.split(" ").slice(1).join(" ") || "",
            address1: shippingAddr1,
            city: shippingCity || null,
            provinceCode: shippingProvince || null,
            countryCode: shippingCountry || "US",
            zip: shippingZip || null,
          }
        : null,
    };

    try {
      // Create draft order
      const createResponse = await admin.graphql(
        `#graphql
          mutation draftOrderCreate($input: DraftOrderInput!) {
            draftOrderCreate(input: $input) {
              draftOrder { id }
              userErrors { field message }
            }
          }`,
        { variables: { input: draftOrderInput } }
      );
      const createJson = await createResponse.json();
      const createErrors = createJson.data?.draftOrderCreate?.userErrors || [];
      if (createErrors.length > 0) {
        failed++;
        errors.push(`Row ${i + 2} (${email}): ${createErrors.map((e) => e.message).join(", ")}`);
        continue;
      }

      const draftOrderId = createJson.data?.draftOrderCreate?.draftOrder?.id;

      // Complete draft order (mark as paid)
      const completeResponse = await admin.graphql(
        `#graphql
          mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
            draftOrderComplete(id: $id, paymentPending: $paymentPending) {
              draftOrder { order { id } }
              userErrors { field message }
            }
          }`,
        { variables: { id: draftOrderId, paymentPending: false } }
      );
      const completeJson = await completeResponse.json();
      const completeErrors = completeJson.data?.draftOrderComplete?.userErrors || [];
      if (completeErrors.length > 0) {
        failed++;
        errors.push(`Row ${i + 2} (${email}) - complete: ${completeErrors.map((e) => e.message).join(", ")}`);
      } else {
        imported++;
      }
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 2} (${email}): ${err.message}`);
    }
  }

  return { imported, failed, errors };
}
