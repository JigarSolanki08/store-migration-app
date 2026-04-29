// Products import service - uses Shopify productSet GraphQL mutation
// Supports full Shopify standard product CSV format

function getCol(headers, row, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? row[i]?.trim() || "" : "";
}

// Try multiple possible column names for backward compatibility
function getColAny(headers, row, names) {
  for (const name of names) {
    const val = getCol(headers, row, name);
    if (val) return val;
  }
  return "";
}

function toBool(val) {
  if (!val) return false;
  const lower = val.toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1";
}

// Delay helper to avoid API rate limiting
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function determineStatus(headers, row) {
  const status = getCol(headers, row, "Status").toLowerCase();
  if (status === "active") return "ACTIVE";
  if (status === "archived") return "ARCHIVED";
  if (status === "draft") return "DRAFT";

  const published = getCol(headers, row, "Published").toLowerCase();
  if (published === "true" || published === "yes") return "ACTIVE";
  if (published === "false" || published === "no") return "DRAFT";

  return "ACTIVE";
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

  let productIndex = 0;
  for (const [handle, productRows] of productMap) {
    try {
      const firstRow = productRows[0];
      const title = getCol(headers, firstRow, "Title");
      if (!title) {
        failed++;
        errors.push(`Row skipped: missing Title for Handle "${handle}"`);
        continue;
      }

      // --- Product-level fields ---
      const bodyHtml = getCol(headers, firstRow, "Body (HTML)");
      const vendor = getCol(headers, firstRow, "Vendor");
      const productType = getColAny(headers, firstRow, [
        "Custom Product Type",
        "Type",
      ]);
      const tags = getCol(headers, firstRow, "Tags");
      const status = determineStatus(headers, firstRow);

      // SEO fields
      const seoTitle = getCol(headers, firstRow, "SEO Title");
      const seoDescription = getCol(headers, firstRow, "SEO Description");

      // --- Build product options from all rows ---
      const optionNamesSet = new Map(); // optionName -> Set of values
      for (const row of productRows) {
        for (let optNum = 1; optNum <= 3; optNum++) {
          const optName = getCol(headers, row, `Option${optNum} Name`);
          const optVal = getCol(headers, row, `Option${optNum} Value`);
          if (optName && optVal) {
            if (!optionNamesSet.has(optName)) {
              optionNamesSet.set(optName, new Set());
            }
            optionNamesSet.get(optName).add(optVal);
          }
        }
      }

      // Build productOptions array
      const productOptions = [];
      for (const [name, valuesSet] of optionNamesSet) {
        productOptions.push({
          name,
          values: Array.from(valuesSet).map((v) => ({ name: v })),
        });
      }

      // Default option if none found
      if (productOptions.length === 0) {
        productOptions.push({
          name: "Title",
          values: [{ name: "Default Title" }],
        });
      }

      // --- Collect images from all rows ---
      const media = [];
      const seenImageSrcs = new Set();
      for (const row of productRows) {
        const imgSrc = getCol(headers, row, "Image Src");
        if (imgSrc && !seenImageSrcs.has(imgSrc)) {
          seenImageSrcs.add(imgSrc);
          const imgAlt = getCol(headers, row, "Image Alt Text");
          media.push({
            originalSource: imgSrc,
            mediaContentType: "IMAGE",
            alt: imgAlt || null,
          });
        }
      }

      // --- Build variants array ---
      const variants = productRows.map((row) => {
        const price = getCol(headers, row, "Variant Price") || "0.00";
        const compareAt = getCol(headers, row, "Variant Compare At Price");
        const sku = getCol(headers, row, "Variant SKU");
        const barcode = getCol(headers, row, "Variant Barcode");
        const grams = getCol(headers, row, "Variant Grams");
        const weightUnit = getCol(headers, row, "Variant Weight Unit");
        const taxable = getCol(headers, row, "Variant Taxable");
        const requiresShipping = getCol(
          headers,
          row,
          "Variant Requires Shipping"
        );
        const inventoryPolicy = getCol(
          headers,
          row,
          "Variant Inventory Policy"
        );
        const costPerItem = getCol(headers, row, "Cost per item");

        // Build option values for this variant
        const optionValues = [];
        for (let optNum = 1; optNum <= 3; optNum++) {
          const optName = getCol(headers, row, `Option${optNum} Name`);
          const optVal = getCol(headers, row, `Option${optNum} Value`);
          if (optName && optVal) {
            optionValues.push({ optionName: optName, name: optVal });
          }
        }
        if (optionValues.length === 0) {
          optionValues.push({ optionName: "Title", name: "Default Title" });
        }

        const variantData = {
          optionValues,
          price,
          compareAtPrice: compareAt || null,
          barcode: barcode || null,
          taxable: taxable ? toBool(taxable) : true,
          inventoryPolicy:
            inventoryPolicy?.toUpperCase() === "CONTINUE"
              ? "CONTINUE"
              : "DENY",
          inventoryItem: {
            sku: sku || null,
            requiresShipping: requiresShipping
              ? toBool(requiresShipping)
              : true,
            tracked: true,
            cost: costPerItem ? parseFloat(costPerItem) : null,
          },
        };

        // Add weight if available
        if (grams) {
          const weightValue = parseFloat(grams);
          if (!isNaN(weightValue)) {
            const unit = (weightUnit || "g").toLowerCase();
            let apiUnit = "GRAMS";
            if (unit === "kg") apiUnit = "KILOGRAMS";
            else if (unit === "lb" || unit === "lbs") apiUnit = "POUNDS";
            else if (unit === "oz") apiUnit = "OUNCES";

            variantData.inventoryItem.measurement = {
              weight: {
                value: weightValue,
                unit: apiUnit,
              },
            };
          }
        }

        return variantData;
      });

      // --- Build productSet input ---
      const productSetInput = {
        title,
        handle,
        descriptionHtml: bodyHtml || null,
        vendor: vendor || null,
        productType: productType || null,
        tags: tags ? tags.split(",").map((t) => t.trim()) : [],
        status,
        productOptions,
        variants,
      };

      // Add SEO fields if present
      if (seoTitle || seoDescription) {
        productSetInput.seo = {};
        if (seoTitle) productSetInput.seo.title = seoTitle;
        if (seoDescription) productSetInput.seo.description = seoDescription;
      }

      // --- Create product via productSet mutation ---
      const response = await admin.graphql(
        `#graphql
          mutation productSet($input: ProductSetInput!) {
            productSet(input: $input) {
              product {
                id
                title
                handle
                variants(first: 10) {
                  nodes {
                    id
                    title
                    price
                  }
                }
              }
              userErrors { field message code }
            }
          }`,
        { variables: { input: productSetInput } }
      );

      const json = await response.json();
      const userErrors = json.data?.productSet?.userErrors || [];

      if (userErrors.length > 0) {
        failed++;
        errors.push(
          `Product "${title}": ${userErrors
            .map((e) => `${e.message} (field: ${e.field?.join(".")})`)
            .join(", ")}`
        );
      } else {
        const productId = json.data?.productSet?.product?.id;

        // --- Add media after product creation ---
        if (productId && media.length > 0) {
          try {
            await admin.graphql(
              `#graphql
              mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
                productCreateMedia(productId: $productId, media: $media) {
                  media { alt }
                  mediaUserErrors { field message }
                }
              }`,
              {
                variables: {
                  productId,
                  media,
                },
              }
            );
          } catch (mediaErr) {
            errors.push(
              `Product "${title}" media warning: ${mediaErr.message}`
            );
          }
        }

        imported++;
      }
    } catch (err) {
      failed++;
      errors.push(`Error processing handle "${handle}": ${err.message}`);
    }

    // Rate-limit: delay between products to avoid API throttling
    productIndex++;
    if (productIndex < productMap.size) {
      await delay(300);
    }
  }

  return { imported, failed, errors };
}
