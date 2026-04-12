// Products import service - calls Shopify productCreate GraphQL mutation

function getCol(headers, row, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? row[i]?.trim() || "" : "";
}

export async function importProducts({ admin, rows, headers }) {
  const dataRows = rows.slice(1);
  let imported = 0;
  let failed = 0;
  const errors = [];

  // Group rows by Handle (variants of same product share a Handle)
  const productMap = new Map();
  for (const row of dataRows) {
    const handle = getCol(headers, row, "Handle");
    if (!handle) continue;
    if (!productMap.has(handle)) productMap.set(handle, []);
    productMap.get(handle).push(row);
  }

  for (const [handle, productRows] of productMap) {
    try {
      const firstRow = productRows[0];
      const title = getCol(headers, firstRow, "Title");
      if (!title) { failed++; errors.push(`Row skipped: missing Title for Handle "${handle}"`); continue; }

      const bodyHtml = getCol(headers, firstRow, "Body (HTML)");
      const vendor = getCol(headers, firstRow, "Vendor");
      const productType = getCol(headers, firstRow, "Type");
      const tags = getCol(headers, firstRow, "Tags");
      const published = getCol(headers, firstRow, "Published").toLowerCase();
      const imgSrc = getCol(headers, firstRow, "Image Src");
      const imgAlt = getCol(headers, firstRow, "Image Alt Text");
      const option1Name = getCol(headers, firstRow, "Option1 Name") || "Title";

      // Build variants array
      const variants = productRows.map((row) => {
        const sku = getCol(headers, row, "Variant SKU");
        const price = getCol(headers, row, "Variant Price") || "0.00";
        const compareAt = getCol(headers, row, "Variant Compare At Price");
        const inventoryQty = parseInt(getCol(headers, row, "Variant Inventory Qty") || "0");
        const option1Val = getCol(headers, row, "Option1 Value") || "Default Title";
        return {
          optionValues: [{ optionName: option1Name, name: option1Val }],
          price,
          compareAtPrice: compareAt || null,
          sku,
          inventoryQuantities: [
            { availableQuantity: inventoryQty, locationId: "" }, // filled later if needed
          ],
        };
      });

      const productInput = {
        title,
        bodyHtml: bodyHtml || null,
        vendor: vendor || null,
        productType: productType || null,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
        status: published === "true" || published === "yes" ? "ACTIVE" : "DRAFT",
        images: imgSrc ? [{ src: imgSrc, altText: imgAlt || null }] : [],
      };

      const response = await admin.graphql(
        `#graphql
          mutation productCreate($product: ProductCreateInput!) {
            productCreate(product: $product) {
              product { id title }
              userErrors { field message }
            }
          }`,
        { variables: { product: productInput } }
      );
      const json = await response.json();
      const userErrors = json.data?.productCreate?.userErrors || [];
      if (userErrors.length > 0) {
        failed++;
        errors.push(`Product "${title}": ${userErrors.map((e) => e.message).join(", ")}`);
      } else {
        imported++;
      }
    } catch (err) {
      failed++;
      errors.push(`Error processing handle "${handle}": ${err.message}`);
    }
  }

  return { imported, failed, errors };
}
