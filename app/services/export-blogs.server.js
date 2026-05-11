// Blogs / Articles export service

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
  "Blog Handle",
  "Blog Title",
  "Article Title",
  "Article Author",
  "Article Body (HTML)",
  "Article Tags",
  "Article Published At",
  "Article Published",
  "Image URL",
  "Image Alt",
];

export async function exportBlogs({ admin }) {
  const allBlogs = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `#graphql
      query getBlogs($first: Int!, $after: String) {
        blogs(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            handle title
            articles(first: 100) {
              nodes {
                title
                author { name }
                body
                tags
                publishedAt
                isPublished
                image { url altText }
              }
            }
          }
        }
      }`,
      { variables: { first: 50, after: cursor } }
    );
    const json = await res.json();
    const { nodes, pageInfo } = json.data.blogs;
    allBlogs.push(...nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  const rows = [];
  for (const blog of allBlogs) {
    for (const article of blog.articles.nodes) {
      rows.push([
        blog.handle || "",
        blog.title || "",
        article.title || "",
        article.author?.name || "",
        article.body || "",
        (article.tags || []).join(", "),
        article.publishedAt || "",
        article.isPublished ? "TRUE" : "FALSE",
        article.image?.url || "",
        article.image?.altText || "",
      ]);
    }
  }

  return {
    csvContent: buildCsv(HEADERS, rows),
    filename: "blogs_export.csv",
    count: rows.length,
  };
}
