import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  EmptyState,
  Banner,
  Divider,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const jobs = await db.importJob.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return json({ jobs });
};

const ENTITY_TYPES = [
  {
    type: "products",
    label: "Products",
    description: "Import products with variants, images, prices, SKUs, and tags.",
    icon: "📦",
    color: "#008060",
  },
  {
    type: "customers",
    label: "Customers",
    description: "Import customer profiles with addresses and contact details.",
    icon: "👤",
    color: "#0969da",
  },
  {
    type: "orders",
    label: "Orders",
    description: "Import historical orders as draft orders (dates may differ).",
    icon: "🛒",
    color: "#9a0000",
  },
  {
    type: "pages",
    label: "Pages",
    description: "Import static pages like About Us, Contact, FAQ, etc.",
    icon: "📄",
    color: "#6941c6",
  },
  {
    type: "blogs",
    label: "Blog Posts",
    description: "Import blog articles with titles, content, tags, and authors.",
    icon: "✍️",
    color: "#c77800",
  },
];

function statusBadge(status) {
  const map = {
    pending: "info",
    processing: "attention",
    done: "success",
    failed: "critical",
  };
  return <Badge tone={map[status] || "info"}>{status}</Badge>;
}

export default function Index() {
  const { jobs } = useLoaderData();
  const navigate = useNavigate();

  const historyRows = jobs.map((job) => [
    job.type.charAt(0).toUpperCase() + job.type.slice(1),
    job.fileName || "-",
    statusBadge(job.status),
    `${job.importedRows} / ${job.totalRows}`,
    job.failedRows > 0 ? `${job.failedRows} errors` : "—",
    new Date(job.createdAt).toLocaleString(),
  ]);

  return (
    <Page>
      <TitleBar title="Store Migration App" />
      <BlockStack gap="600">
        {/* Welcome Banner */}
        <Banner title="Welcome to Store Migration App" tone="info">
          <p>
            Migrate your store from any platform (WooCommerce, Magento,
            BigCommerce, etc.) to Shopify. Download a CSV template, fill it with
            your data, and import it directly into your store.
          </p>
        </Banner>

        {/* Entity Cards */}
        <Text as="h2" variant="headingLg">
          Choose what to migrate
        </Text>
        <Layout>
          {ENTITY_TYPES.map((entity) => (
            <Layout.Section key={entity.type} variant="oneThird">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="headingMd">
                      {entity.icon} {entity.label}
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {entity.description}
                  </Text>
                  <Divider />
                  <InlineStack gap="200">
                    <Button
                      url={`/app/download-template/${entity.type}`}
                      target="_blank"
                      variant="plain"
                    >
                      ⬇ Download Template
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => navigate(`/app/import/${entity.type}`)}
                    >
                      Import {entity.label}
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>

        {/* How It Works */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              📋 How to migrate your store
            </Text>
            <Text as="p" variant="bodyMd">
              <strong>Step 1:</strong> Click "Download Template" for the data
              type you want to import. Open the CSV in Excel or Google Sheets.
            </Text>
            <Text as="p" variant="bodyMd">
              <strong>Step 2:</strong> Fill in your existing store data into the
              CSV. Keep the column headers exactly as-is.
            </Text>
            <Text as="p" variant="bodyMd">
              <strong>Step 3:</strong> Click "Import" and upload your filled CSV
              file. The app will validate it and import all records into your
              Shopify store.
            </Text>
            <Text as="p" variant="bodyMd">
              <strong>Step 4:</strong> Review the import summary. Download an
              error report if any rows failed.
            </Text>
          </BlockStack>
        </Card>

        {/* Import History */}
        <BlockStack gap="200">
          <Text as="h2" variant="headingLg">
            Import History
          </Text>
          {jobs.length === 0 ? (
            <Card>
              <EmptyState
                heading="No imports yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Download a template above and start migrating your store.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Type",
                  "File",
                  "Status",
                  "Progress",
                  "Errors",
                  "Started",
                ]}
                rows={historyRows}
              />
            </Card>
          )}
        </BlockStack>
      </BlockStack>
    </Page>
  );
}
