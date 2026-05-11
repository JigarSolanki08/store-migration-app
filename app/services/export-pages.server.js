// Pages export service

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
  "Title",
  "Body (HTML)",
  "Handle",
  "Author",
  "Published",
  "Metafield: Description Tag",
];

export async function exportPages({ admin }) {
  const allPages = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `#graphql
      query getPages($first: Int!, $after: String) {
        pages(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            title body handle author publishedAt isPublished
          }
        }
      }`,
      { variables: { first: 100, after: cursor } }
    );
    const json = await res.json();
    const { nodes, pageInfo } = json.data.pages;
    allPages.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  const rows = allPages.map((page) => [
    page.title || "",
    page.body || "",
    page.handle || "",
    page.author || "",
    page.isPublished ? "TRUE" : "FALSE",
    "", // Metafield: Description Tag — not fetched via basic query
  ]);

  return {
    csvContent: buildCsv(HEADERS, rows),
    filename: "pages_export.csv",
    count: allPages.length,
  };
}
