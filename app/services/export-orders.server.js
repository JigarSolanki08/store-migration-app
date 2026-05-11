// Orders export service

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
  "Email",
  "Financial Status",
  "Line Item Name",
  "Line Item SKU",
  "Line Item Quantity",
  "Line Item Price",
  "Shipping Name",
  "Shipping Address1",
  "Shipping City",
  "Shipping Province Code",
  "Shipping Country Code",
  "Shipping Zip",
  "Total Price",
  "Tags",
  "Note",
];

export async function exportOrders({ admin }) {
  const allOrders = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `#graphql
      query getOrders($first: Int!, $after: String) {
        orders(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            email
            displayFinancialStatus
            tags note
            totalPriceSet { shopMoney { amount } }
            shippingAddress {
              name address1 city provinceCode countryCode zip
            }
            lineItems(first: 50) {
              nodes {
                title sku quantity
                originalUnitPriceSet { shopMoney { amount } }
              }
            }
          }
        }
      }`,
      { variables: { first: 50, after: cursor } }
    );
    const json = await res.json();
    const { nodes, pageInfo } = json.data.orders;
    allOrders.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  const rows = [];
  for (const order of allOrders) {
    const ship = order.shippingAddress || {};
    const lineItems = order.lineItems.nodes;
    const total = order.totalPriceSet?.shopMoney?.amount || "";
    const status = (order.displayFinancialStatus || "").toLowerCase();

    lineItems.forEach((item) => {
      rows.push([
        order.email || "",
        status,
        item.title || "",
        item.sku || "",
        item.quantity || "",
        item.originalUnitPriceSet?.shopMoney?.amount || "",
        ship.name || "",
        ship.address1 || "",
        ship.city || "",
        ship.provinceCode || "",
        ship.countryCode || "",
        ship.zip || "",
        total,
        (order.tags || []).join(", "),
        order.note || "",
      ]);
    });
  }

  return {
    csvContent: buildCsv(HEADERS, rows),
    filename: "orders_export.csv",
    count: allOrders.length,
  };
}
