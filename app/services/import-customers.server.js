// Customers import service - calls Shopify customerCreate GraphQL mutation

function getCol(headers, row, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? row[i]?.trim() || "" : "";
}

export async function importCustomers({ admin, rows, headers }) {
  const dataRows = rows.slice(1);
  let imported = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const email = getCol(headers, row, "Email");
    if (!email) {
      failed++;
      errors.push(`Row ${i + 2}: Missing Email, skipped.`);
      continue;
    }

    const firstName = getCol(headers, row, "First Name");
    const lastName = getCol(headers, row, "Last Name");
    const phone = getCol(headers, row, "Phone");
    const acceptsMarketing = getCol(headers, row, "Accepts Marketing").toLowerCase() === "yes";
    const tags = getCol(headers, row, "Tags");
    const note = getCol(headers, row, "Note");

    const addr1 = getCol(headers, row, "Address1");
    const addr2 = getCol(headers, row, "Address2");
    const city = getCol(headers, row, "City");
    const province = getCol(headers, row, "Province");
    const provinceCode = getCol(headers, row, "Province Code");
    const country = getCol(headers, row, "Country");
    const countryCode = getCol(headers, row, "Country Code");
    const zip = getCol(headers, row, "Zip");

    const customerInput = {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      emailMarketingConsent: {
        marketingState: acceptsMarketing ? "SUBSCRIBED" : "NOT_SUBSCRIBED",
        marketingOptInLevel: "SINGLE_OPT_IN",
      },
      tags: tags ? tags.split(",").map((t) => t.trim()) : [],
      note: note || null,
      addresses: addr1
        ? [
            {
              address1: addr1,
              address2: addr2 || null,
              city: city || null,
              province: province || null,
              provinceCode: provinceCode || null,
              country: country || null,
              countryCode: countryCode || null,
              zip: zip || null,
              firstName: firstName || null,
              lastName: lastName || null,
            },
          ]
        : [],
    };

    try {
      const response = await admin.graphql(
        `#graphql
          mutation customerCreate($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer { id email }
              userErrors { field message }
            }
          }`,
        { variables: { input: customerInput } }
      );
      const json = await response.json();
      const userErrors = json.data?.customerCreate?.userErrors || [];
      if (userErrors.length > 0) {
        failed++;
        errors.push(`Row ${i + 2} (${email}): ${userErrors.map((e) => e.message).join(", ")}`);
      } else {
        imported++;
      }
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 2} (${email}): ${err.message}`);
    }
  }

  return { imported, failed, errors };
}
