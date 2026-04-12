// Pages import service - calls Shopify pageCreate GraphQL mutation

function getCol(headers, row, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? row[i]?.trim() || "" : "";
}

export async function importPages({ admin, rows, headers }) {
  const dataRows = rows.slice(1);
  let imported = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const title = getCol(headers, row, "Title");
    const body = getCol(headers, row, "Body (HTML)");

    if (!title || !body) {
      failed++;
      errors.push(`Row ${i + 2}: Missing Title or Body (HTML), skipped.`);
      continue;
    }

    const handle = getCol(headers, row, "Handle");
    const author = getCol(headers, row, "Author");
    const published = getCol(headers, row, "Published").toLowerCase();
    const metaDesc = getCol(headers, row, "Metafield: Description Tag");

    const pageInput = {
      title,
      body,
      handle: handle || null,
      author: author || null,
      isPublished: published === "true" || published === "yes",
    };

    try {
      const response = await admin.graphql(
        `#graphql
          mutation pageCreate($page: PageCreateInput!) {
            pageCreate(page: $page) {
              page { id title }
              userErrors { field message }
            }
          }`,
        { variables: { page: pageInput } }
      );
      const json = await response.json();
      const userErrors = json.data?.pageCreate?.userErrors || [];
      if (userErrors.length > 0) {
        failed++;
        errors.push(`Row ${i + 2} ("${title}"): ${userErrors.map((e) => e.message).join(", ")}`);
      } else {
        // Add metafield description if provided
        if (metaDesc && json.data?.pageCreate?.page?.id) {
          try {
            await admin.graphql(
              `#graphql
                mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafields) {
                    metafields { id }
                    userErrors { field message }
                  }
                }`,
              {
                variables: {
                  metafields: [
                    {
                      ownerId: json.data.pageCreate.page.id,
                      namespace: "seo",
                      key: "description_tag",
                      value: metaDesc,
                      type: "single_line_text_field",
                    },
                  ],
                },
              }
            );
          } catch (_) {
            // non-fatal: page was created even if metafield failed
          }
        }
        imported++;
      }
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 2} ("${title}"): ${err.message}`);
    }
  }

  return { imported, failed, errors };
}
