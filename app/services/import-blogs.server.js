// Blogs import service - calls blogCreate + articleCreate GraphQL mutations

function getCol(headers, row, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? row[i]?.trim() || "" : "";
}

export async function importBlogs({ admin, rows, headers }) {
  const dataRows = rows.slice(1);
  let imported = 0;
  let failed = 0;
  const errors = [];

  // Cache blog IDs to avoid re-creating the same blog
  const blogCache = new Map();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const blogHandle = getCol(headers, row, "Blog Handle");
    const blogTitle = getCol(headers, row, "Blog Title");
    const articleTitle = getCol(headers, row, "Article Title");
    const articleBody = getCol(headers, row, "Article Body (HTML)");

    if (!blogHandle || !articleTitle || !articleBody) {
      failed++;
      errors.push(`Row ${i + 2}: Missing Blog Handle, Article Title, or Article Body, skipped.`);
      continue;
    }

    try {
      // Create or retrieve blog
      let blogId = blogCache.get(blogHandle);
      if (!blogId) {
        const blogResponse = await admin.graphql(
          `#graphql
            mutation blogCreate($blog: BlogCreateInput!) {
              blogCreate(blog: $blog) {
                blog { id title }
                userErrors { field message }
              }
            }`,
          { variables: { blog: { title: blogTitle || blogHandle } } }
        );
        const blogJson = await blogResponse.json();
        const blogErrors = blogJson.data?.blogCreate?.userErrors || [];
        if (blogErrors.length > 0 && !blogErrors[0].message.includes("already")) {
          // If "already exists" we'll try to query it; otherwise fail
          failed++;
          errors.push(`Row ${i + 2}: Blog creation error: ${blogErrors.map((e) => e.message).join(", ")}`);
          continue;
        }
        blogId = blogJson.data?.blogCreate?.blog?.id;
        if (blogId) blogCache.set(blogHandle, blogId);
      }

      if (!blogId) {
        failed++;
        errors.push(`Row ${i + 2}: Could not find or create blog "${blogTitle}".`);
        continue;
      }

      const articleAuthor = getCol(headers, row, "Article Author") || "admin";
      const articleTags = getCol(headers, row, "Article Tags");
      const publishedAt = getCol(headers, row, "Article Published At");
      const published = getCol(headers, row, "Article Published").toLowerCase();
      const imgUrl = getCol(headers, row, "Image URL");
      const imgAlt = getCol(headers, row, "Image Alt");

      const articleInput = {
        title: articleTitle,
        body: articleBody,
        author: { name: articleAuthor },
        tags: articleTags ? articleTags.split(",").map((t) => t.trim()) : [],
        isPublished: published === "true" || published === "yes",
        publishedAt: publishedAt || null,
        image: imgUrl ? { src: imgUrl, altText: imgAlt || null } : null,
        blogId,
      };

      const articleResponse = await admin.graphql(
        `#graphql
          mutation articleCreate($article: ArticleCreateInput!) {
            articleCreate(article: $article) {
              article { id title }
              userErrors { field message }
            }
          }`,
        { variables: { article: articleInput } }
      );
      const articleJson = await articleResponse.json();
      const articleErrors = articleJson.data?.articleCreate?.userErrors || [];
      if (articleErrors.length > 0) {
        failed++;
        errors.push(`Row ${i + 2} ("${articleTitle}"): ${articleErrors.map((e) => e.message).join(", ")}`);
      } else {
        imported++;
      }
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  return { imported, failed, errors };
}
