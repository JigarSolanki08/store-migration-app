// CSV template download route - serves template files for download
// URL: /app/download-template/:type

const TEMPLATES = {
  products: {
    filename: "products_template.csv",
    headers: [
      "Handle",
      "Title",
      "Body (HTML)",
      "Vendor",
      "Type",
      "Tags",
      "Published",
      "Option1 Name",
      "Option1 Value",
      "Variant SKU",
      "Variant Price",
      "Variant Compare At Price",
      "Variant Inventory Qty",
      "Image Src",
      "Image Alt Text",
    ],
    sample: [
      [
        "blue-denim-jeans",
        "Blue Denim Jeans",
        "<p>Classic blue denim jeans for everyday wear.</p>",
        "My Brand",
        "Pants",
        "denim, jeans, blue",
        "TRUE",
        "Size",
        "M",
        "BDJ-M-001",
        "49.99",
        "69.99",
        "10",
        "https://example.com/images/jeans-blue.jpg",
        "Blue Denim Jeans",
      ],
      [
        "blue-denim-jeans",
        "",
        "",
        "",
        "",
        "",
        "",
        "Size",
        "L",
        "BDJ-L-001",
        "49.99",
        "69.99",
        "5",
        "",
        "",
      ],
      [
        "cotton-white-tshirt",
        "Cotton White T-Shirt",
        "<p>100% cotton premium white t-shirt.</p>",
        "My Brand",
        "T-Shirts",
        "cotton, white, tshirt",
        "TRUE",
        "Size",
        "S",
        "CWT-S-001",
        "19.99",
        "29.99",
        "20",
        "https://example.com/images/tshirt-white.jpg",
        "White T-Shirt",
      ],
    ],
  },
  customers: {
    filename: "customers_template.csv",
    headers: [
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
    ],
    sample: [
      [
        "John",
        "Doe",
        "john.doe@example.com",
        "",
        "no",
        "vip, loyal",
        "Prefers express shipping",
        "123 Main Street",
        "Apt 4B",
        "New York",
        "New York",
        "NY",
        "United States",
        "US",
        "10001",
      ],
      [
        "Jane",
        "Smith",
        "jane.smith@example.com",
        "",
        "yes",
        "new",
        "",
        "456 Oak Avenue",
        "",
        "Los Angeles",
        "California",
        "CA",
        "United States",
        "US",
        "90001",
      ],
    ],
  },
  orders: {
    filename: "orders_template.csv",
    headers: [
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
    ],
    sample: [
      [
        "john.doe@example.com",
        "paid",
        "Blue Denim Jeans",
        "BDJ-M-001",
        "1",
        "49.99",
        "John Doe",
        "123 Main Street",
        "New York",
        "NY",
        "US",
        "10001",
        "49.99",
        "migrated",
        "Imported from WooCommerce",
      ],
      [
        "jane.smith@example.com",
        "paid",
        "Cotton White T-Shirt",
        "CWT-S-001",
        "2",
        "19.99",
        "Jane Smith",
        "456 Oak Avenue",
        "Los Angeles",
        "CA",
        "US",
        "90001",
        "39.98",
        "migrated",
        "",
      ],
    ],
  },
  pages: {
    filename: "pages_template.csv",
    headers: [
      "Title",
      "Body (HTML)",
      "Handle",
      "Author",
      "Published",
      "Metafield: Description Tag",
    ],
    sample: [
      [
        "About Us",
        "<h1>About Our Store</h1><p>We've been selling quality products since 2010.</p>",
        "about-us",
        "Admin",
        "TRUE",
        "Learn about our store, our mission, and our team.",
      ],
      [
        "Contact Us",
        "<h1>Contact Us</h1><p>Email: support@mystore.com<br>Phone: 1-800-123-4567</p>",
        "contact-us",
        "Admin",
        "TRUE",
        "Get in touch with our support team.",
      ],
    ],
  },
  blogs: {
    filename: "blogs_template.csv",
    headers: [
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
    ],
    sample: [
      [
        "news",
        "News",
        "Welcome to Our New Store",
        "admin",
        "<h1>Welcome!</h1><p>We are excited to launch our new online store.</p>",
        "news, announcement",
        "2024-01-15T10:00:00Z",
        "TRUE",
        "https://example.com/images/welcome-post.jpg",
        "Welcome Banner",
      ],
      [
        "news",
        "News",
        "Top 10 Products of 2024",
        "admin",
        "<h1>Top 10 Products</h1><p>Our best selling products this year...</p>",
        "products, guide",
        "2024-03-20T10:00:00Z",
        "TRUE",
        "",
        "",
      ],
    ],
  },
};

export const loader = async ({ params }) => {
  const { type } = params;
  const template = TEMPLATES[type];

  if (!template) {
    return new Response("Template not found", { status: 404 });
  }

  const { headers, sample } = template;
  const rows = [headers, ...sample];

  // Build CSV manually (no external dep needed for simple generation)
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? "");
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\r\n");

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
    },
  });
};
