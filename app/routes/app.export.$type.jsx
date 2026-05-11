import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  ProgressBar,
  Badge,
  Box,
  List,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { exportProducts } from "../services/export-products.server";
import { exportCustomers } from "../services/export-customers.server";
import { exportOrders } from "../services/export-orders.server";
import { exportPages } from "../services/export-pages.server";
import { exportBlogs } from "../services/export-blogs.server";

const ENTITY_CONFIG = {
  products: {
    label: "Products",
    icon: "📦",
    description: "Exports all products with variants, images, prices, SKUs, options, and SEO fields.",
    fields: ["Handle", "Title", "Body (HTML)", "Vendor", "Tags", "Variants", "Images", "SEO", "Status"],
    exportFn: exportProducts,
  },
  customers: {
    label: "Customers",
    icon: "👤",
    description: "Exports all customer profiles with contact details and primary address.",
    fields: ["Name", "Email", "Phone", "Marketing Consent", "Tags", "Note", "Address"],
    exportFn: exportCustomers,
  },
  orders: {
    label: "Orders",
    icon: "🛒",
    description: "Exports all orders (one row per line item) with shipping and financial details.",
    fields: ["Email", "Financial Status", "Line Items", "Shipping Address", "Total Price", "Tags"],
    exportFn: exportOrders,
  },
  pages: {
    label: "Pages",
    icon: "📄",
    description: "Exports all online store pages with content, handle, and author.",
    fields: ["Title", "Body (HTML)", "Handle", "Author", "Published"],
    exportFn: exportPages,
  },
  blogs: {
    label: "Blog Posts",
    icon: "✍️",
    description: "Exports all blog articles with content, tags, publish date, and images.",
    fields: ["Blog Handle", "Blog Title", "Article Title", "Author", "Body", "Tags", "Image"],
    exportFn: exportBlogs,
  },
};

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);
  const config = ENTITY_CONFIG[params.type];
  if (!config) throw new Response("Not found", { status: 404 });
  return json({
    type: params.type,
    config: {
      label: config.label,
      icon: config.icon,
      description: config.description,
      fields: config.fields,
    },
  });
};

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const { type } = params;
  const config = ENTITY_CONFIG[type];

  if (!config) return json({ error: "Invalid export type" }, { status: 400 });

  try {
    const result = await config.exportFn({ admin });
    return json({
      success: true,
      csvContent: result.csvContent,
      filename: result.filename,
      count: result.count,
    });
  } catch (err) {
    return json({ error: `Export failed: ${err.message}` });
  }
};

export default function ExportPage() {
  const { type, config } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isExporting = navigation.state === "submitting";

  // Trigger CSV download when data arrives
  useEffect(() => {
    if (actionData?.csvContent && actionData?.filename) {
      // Add UTF-8 BOM so Excel opens it correctly
      const blob = new Blob(["\uFEFF" + actionData.csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = actionData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [actionData?.csvContent, actionData?.filename]);

  const handleExport = () => {
    submit({}, { method: "POST" });
  };

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title={`${config.icon} Export ${config.label}`}
    >
      <TitleBar title={`Export ${config.label}`} />
      <BlockStack gap="500">

        {/* What will be exported */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">What will be exported</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              {config.description}
            </Text>
            <List type="bullet">
              {config.fields.map((f) => (
                <List.Item key={f}>{f}</List.Item>
              ))}
            </List>
            <Banner tone="info">
              <p>
                The exported CSV uses the same column format as the import template —
                you can edit and re-import it directly.
              </p>
            </Banner>
          </BlockStack>
        </Card>

        <Divider />

        {/* Result */}
        {actionData?.error && (
          <Banner title="Export Error" tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        {actionData?.success && (
          <Banner title={`✅ Export complete`} tone="success">
            <p>
              <strong>{actionData.count}</strong> {config.label.toLowerCase()} exported.
              Your download should have started automatically.
            </p>
            <Box paddingBlockStart="200">
              <Button
                onClick={() => {
                  const blob = new Blob(["\uFEFF" + actionData.csvContent], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = actionData.filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                ⬇ Download Again
              </Button>
            </Box>
          </Banner>
        )}

        {/* Export button */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Start Export</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Click the button below to fetch all {config.label.toLowerCase()} from your
              store and download a CSV file. Large stores may take a moment.
            </Text>

            {isExporting ? (
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  Fetching {config.label.toLowerCase()} from your store…
                </Text>
                <ProgressBar progress={50} animated />
              </BlockStack>
            ) : (
              <InlineStack gap="300">
                <Button variant="primary" onClick={handleExport} loading={isExporting}>
                  ⬇ Export {config.label} to CSV
                </Button>
                <Button url="/app" variant="plain">Cancel</Button>
              </InlineStack>
            )}
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
