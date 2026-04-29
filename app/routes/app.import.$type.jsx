import { json, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import Papa from "papaparse";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  DataTable,
  Badge,
  Banner,
  ProgressBar,
  Divider,
  Box,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { importProducts } from "../services/import-products.server";
import { importCustomers } from "../services/import-customers.server";
import { importOrders } from "../services/import-orders.server";
import { importPages } from "../services/import-pages.server";
import { importBlogs } from "../services/import-blogs.server";

const ENTITY_CONFIG = {
  products: {
    label: "Products",
    icon: "📦",
    requiredColumns: ["Handle", "Title"],
    importFn: importProducts,
  },
  customers: {
    label: "Customers",
    icon: "👤",
    requiredColumns: ["Email"],
    importFn: importCustomers,
  },
  orders: {
    label: "Orders",
    icon: "🛒",
    requiredColumns: ["Email", "Line Item Name", "Line Item Price"],
    importFn: importOrders,
  },
  pages: {
    label: "Pages",
    icon: "📄",
    requiredColumns: ["Title", "Body (HTML)"],
    importFn: importPages,
  },
  blogs: {
    label: "Blog Posts",
    icon: "✍️",
    requiredColumns: ["Blog Handle", "Article Title", "Article Body (HTML)"],
    importFn: importBlogs,
  },
};

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);
  const config = ENTITY_CONFIG[params.type];
  if (!config) throw new Response("Not found", { status: 404 });
  return json({ type: params.type, config: { label: config.label, icon: config.icon, requiredColumns: config.requiredColumns } });
};

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === "," && !inQuotes) {
        row.push(current); current = "";
      } else {
        current += char;
      }
    }
    row.push(current);
    rows.push(row);
  }
  return rows;
}

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { type } = params;
  const config = ENTITY_CONFIG[type];

  if (!config) return json({ error: "Invalid import type" }, { status: 400 });

  const uploadHandler = unstable_createMemoryUploadHandler({ maxPartSize: 10_000_000 });
  const formData = await unstable_parseMultipartFormData(request, uploadHandler);
  const file = formData.get("csvFile");

  if (!file || file.size === 0) {
    return json({ error: "Please select a CSV file to upload." });
  }

  const text = await file.text();

  // Use papaparse for robust CSV parsing (handles multi-line quoted fields, etc.)
  const parseResult = Papa.parse(text, {
    skipEmptyLines: true,
  });
  const rows = parseResult.data;

  if (rows.length < 2) {
    return json({ error: "CSV file is empty or has no data rows." });
  }

  const headers = rows[0];
  const missingCols = config.requiredColumns.filter(
    (col) => !headers.includes(col)
  );
  if (missingCols.length > 0) {
    return json({
      error: `Missing required columns: ${missingCols.join(", ")}. Please download the template and use the correct column headers.`,
    });
  }

  // Create import job
  const job = await db.importJob.create({
    data: {
      shop: session.shop,
      type,
      status: "processing",
      totalRows: rows.length - 1,
      fileName: file.name,
    },
  });

  try {
    const result = await config.importFn({ admin, rows, headers });
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: result.failed > 0 ? "done" : "done",
        importedRows: result.imported,
        failedRows: result.failed,
        errors: result.errors?.length ? JSON.stringify(result.errors.slice(0, 50)) : null,
      },
    });
    return json({
      success: true,
      jobId: job.id,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors?.slice(0, 10),
      type,
      label: config.label,
    });
  } catch (err) {
    await db.importJob.update({
      where: { id: job.id },
      data: { status: "failed", errors: err.message },
    });
    return json({ error: `Import failed: ${err.message}` });
  }
};

export default function ImportPage() {
  const { type, config } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isImporting = navigation.state === "submitting";

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileChange = useCallback((e) => {
    const selected = e.target.files[0];
    setFile(selected);
    if (selected) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const rows = parseCSV(ev.target.result);
        setPreview(rows.slice(0, 6)); // header + 5 rows preview
      };
      reader.readAsText(selected);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!file) return;
    const fd = new FormData();
    fd.append("csvFile", file);
    submit(fd, { method: "POST", encType: "multipart/form-data" });
  }, [file, submit]);

  const previewHeaders = preview?.[0] || [];
  const previewRows = preview?.slice(1).map((row) =>
    previewHeaders.map((_, i) => row[i] ?? "")
  ) || [];

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title={`${config.icon} Import ${config.label}`}
    >
      <TitleBar title={`Import ${config.label}`} />
      <BlockStack gap="500">

        {/* Step 1: Download Template */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Step 1 — Download the template</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Download the CSV template, fill it with your data, and come back to upload it.
            </Text>
            <List type="bullet">
              <List.Item>Keep column headers exactly as they are</List.Item>
              <List.Item>Required columns: <strong>{config.requiredColumns.join(", ")}</strong></List.Item>
              <List.Item>Save as CSV format (not XLSX)</List.Item>
            </List>
            <Box>
              <Button url={`/app/download-template/${type}`} target="_blank">
                ⬇ Download {config.label} Template
              </Button>
            </Box>
          </BlockStack>
        </Card>

        <Divider />

        {/* Step 2: Upload */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Step 2 — Upload your filled CSV</Text>

            {/* Error banner */}
            {actionData?.error && (
              <Banner title="Import Error" tone="critical">
                <p>{actionData.error}</p>
              </Banner>
            )}

            {/* Success banner */}
            {actionData?.success && (
              <Banner
                title={`✅ ${config.label} imported successfully!`}
                tone="success"
              >
                <p>
                  <strong>{actionData.imported}</strong> records imported.
                  {actionData.failed > 0 && (
                    <> <strong>{actionData.failed}</strong> records failed.</>
                  )}
                </p>
                {actionData.errors?.length > 0 && (
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" tone="critical">First errors:</Text>
                    {actionData.errors.map((e, i) => (
                      <Text key={i} as="p" variant="bodySm">{e}</Text>
                    ))}
                  </BlockStack>
                )}
              </Banner>
            )}

            <Box>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{
                  padding: "8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  width: "100%",
                  cursor: "pointer",
                }}
              />
            </Box>

            {file && (
              <Text as="p" variant="bodySm" tone="subdued">
                Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </Text>
            )}

            {/* Preview */}
            {preview && preview.length > 1 && (
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Preview (first {Math.min(5, preview.length - 1)} rows)
                </Text>
                <Box overflowX="scroll">
                  <DataTable
                    columnContentTypes={previewHeaders.map(() => "text")}
                    headings={previewHeaders}
                    rows={previewRows}
                  />
                </Box>
              </BlockStack>
            )}

            {/* Import button */}
            {isImporting ? (
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">Importing {config.label}... this may take a moment.</Text>
                <ProgressBar progress={50} animated />
              </BlockStack>
            ) : (
              <InlineStack gap="300">
                <Button
                  variant="primary"
                  disabled={!file}
                  onClick={handleSubmit}
                  loading={isImporting}
                >
                  🚀 Start Import
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
