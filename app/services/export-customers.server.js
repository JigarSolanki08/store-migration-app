// Customers export service

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
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Accepts Marketing",
  "Tags",
  "Note",
  "Address1",
  "Address2",
  "City",
  "Province",
  "Province Code",
  "Country",
  "Country Code",
  "Zip",
];

export async function exportCustomers({ admin }) {
  const allCustomers = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `#graphql
      query getCustomers($first: Int!, $after: String) {
        customers(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            firstName lastName email phone tags note
            emailMarketingConsent { marketingState }
            addresses {
              address1 address2 city province provinceCode
              country countryCode zip
            }
          }
        }
      }`,
      { variables: { first: 100, after: cursor } }
    );
    const json = await res.json();
    const { nodes, pageInfo } = json.data.customers;
    allCustomers.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  const rows = allCustomers.map((c) => {
    const addr = c.addresses?.[0] || {};
    const acceptsMkt =
      c.emailMarketingConsent?.marketingState === "SUBSCRIBED" ? "yes" : "no";
    return [
      c.firstName || "",
      c.lastName || "",
      c.email || "",
      c.phone || "",
      acceptsMkt,
      (c.tags || []).join(", "),
      c.note || "",
      addr.address1 || "",
      addr.address2 || "",
      addr.city || "",
      addr.province || "",
      addr.provinceCode || "",
      addr.country || "",
      addr.countryCode || "",
      addr.zip || "",
    ];
  });

  return {
    csvContent: buildCsv(HEADERS, rows),
    filename: "customers_export.csv",
    count: allCustomers.length,
  };
}
