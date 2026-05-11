// Products export service - fetches all products and generates CSV

function buildCsv(headers, rows) {
  const escape = (val) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}

const HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Custom Product Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Option3 Name",
  "Option3 Value",
  "Variant SKU",
  "Variant Grams",
  "Variant Inventory Policy",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Variant Barcode",
  "Image Src",
  "Image Alt Text",
  "SEO Title",
  "SEO Description",
  "Status",
];

function weightToGrams(weight) {
  if (!weight) return "";
  const { value, unit } = weight;
  if (unit === "GRAMS") return Math.round(value);
  if (unit === "KILOGRAMS") return Math.round(value * 1000);
  if (unit === "POUNDS") return Math.round(value * 453.592);
  if (unit === "OUNCES") return Math.round(value * 28.3495);
  return "";
}

export async function exportProducts({ admin }) {
  const allProducts = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `#graphql
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            handle title descriptionHtml vendor productType tags status
            seo { title description }
            options { name values }
            variants(first: 100) {
              nodes {
                sku barcode price compareAtPrice taxable
                inventoryPolicy
                inventoryItem {
                  requiresShipping
                  measurement { weight { value unit } }
                }
                selectedOptions { name value }
              }
            }
            images(first: 20) {
              nodes { url altText }
            }
          }
        }
      }`,
      { variables: { first: 50, after: cursor } }
    );
    const json = await res.json();
    const { nodes, pageInfo } = json.data.products;
    allProducts.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  const rows = [];
  for (const product of allProducts) {
    const variants = product.variants.nodes;
    const images = product.images.nodes;
    const options = product.options || [];
    const opt1Name = options[0]?.name || "";
    const opt2Name = options[1]?.name || "";
    const opt3Name = options[2]?.name || "";

    variants.forEach((variant, vi) => {
      const isFirst = vi === 0;
      const selectedOpts = variant.selectedOptions || [];
      const opt1Val = selectedOpts.find((o) => o.name === opt1Name)?.value || "";
      const opt2Val = selectedOpts.find((o) => o.name === opt2Name)?.value || "";
      const opt3Val = selectedOpts.find((o) => o.name === opt3Name)?.value || "";
      const grams = weightToGrams(variant.inventoryItem?.measurement?.weight);
      const img = images[vi] || (isFirst ? images[0] : null);

      rows.push([
        product.handle,
        isFirst ? product.title : "",
        isFirst ? (product.descriptionHtml || "") : "",
        isFirst ? (product.vendor || "") : "",
        isFirst ? (product.productType || "") : "",
        isFirst ? (product.tags || []).join(", ") : "",
        isFirst ? (product.status === "ACTIVE" ? "TRUE" : "FALSE") : "",
        isFirst ? opt1Name : "",
        opt1Val,
        isFirst ? opt2Name : "",
        opt2Val,
        isFirst ? opt3Name : "",
        opt3Val,
        variant.sku || "",
        grams,
        (variant.inventoryPolicy || "DENY").toLowerCase(),
        variant.price || "0.00",
        variant.compareAtPrice || "",
        variant.inventoryItem?.requiresShipping !== false ? "TRUE" : "FALSE",
        variant.taxable !== false ? "TRUE" : "FALSE",
        variant.barcode || "",
        img?.url || "",
        img?.altText || "",
        isFirst ? (product.seo?.title || "") : "",
        isFirst ? (product.seo?.description || "") : "",
        isFirst ? (product.status?.toLowerCase() || "active") : "",
      ]);
    });
  }

  return {
    csvContent: buildCsv(HEADERS, rows),
    filename: "products_export.csv",
    count: allProducts.length,
  };
}
