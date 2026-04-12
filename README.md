# Shopify Store Migration App

A custom Shopify embedded app built with **Remix**, **Polaris**, and **Prisma** that helps merchants migrate their entire store (Products, Customers, Orders, Pages, Blogs) from any platform (WooCommerce, Magento, BigCommerce, etc.) to Shopify via CSV imports.

## Features

- **5 Migration Types**: Import Products, Customers, Orders (as Draft Orders), Pages, and Blog Posts.
- **CSV Templates**: Downloadable perfectly-formatted CSV templates for each data type.
- **Import Wizard**: Step-by-step UI to upload, validate, and preview CSV data.
- **Job Tracking**: Real-time status tracking and history of all imports using SQLite/Prisma.
- **GraphQL APIs**: Leverages Shopify's GraphQL Admin API for high-performance bulk operations.

## Tech Stack
- **Framework**: [Remix](https://remix.run)
- **UI Component Library**: [Shopify Polaris](https://polaris.shopify.com/)
- **Database**: SQLite + [Prisma ORM](https://www.prisma.io/)
- **API**: Shopify GraphQL Admin API
- **CSV Parsing**: PapaParse

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18 or higher)
- A [Shopify Partner Account](https://partners.shopify.com/)
- A Shopify Development Store

### 1. Install Dependencies
Clone the repository, navigate to the app folder, and install the required npm packages:
```bash
npm install
```

### 2. Set Up the Database
This app uses Prisma and SQLite to track import jobs. Initialize the database schema with:
```bash
npx prisma generate
npx prisma migrate dev
```

### 3. Run the Development Server
Start the local server and connect it to your Shopify development store:
```bash
npm run dev
```

1. The CLI will prompt you to log into your Shopify Partner account.
2. Select "Create a new app" or connect to an existing one in your dashboard.
3. Select the Development Store where you want to test the app.
4. Press `p` in the terminal to open the app directly inside your Shopify admin panel!

---

## 🔒 Important: Protected Customer Data
If you are importing **Customers**, Shopify requires explicit approval for data privacy. 
1. Go to your Shopify Partner Dashboard.
2. Select your app -> **API Access**.
3. Under **Protected customer data access**, request access for "Store management". 
*(Note: This is automatically approved for development apps).*

## Usage
1. Open the app in your Shopify admin.
2. Click **Download Template** for the entity you want to import.
3. Fill your data into the CSV (do not modify the header rows).
4. Click **Import**, upload your file, review the preview, and submit!

---

## License
MIT License
