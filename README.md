# iReserve MVP — Interactive Smart Village Reservation System

iReserve is a production-ready smart subdivision reservation platform. It moves away from static property cards, enabling guests and buyers to explore an interactive vector blueprint map, check climate exposure, identify amenities, use an automated loan calculator, and reserve land parcels in 48 hours.

---

## 🚀 Key Features

1. **Subdivision Vector Editor**: Built on React Konva. Architects sketch streets (which visually snap and merge T-junctions), map hazard/flood overlays, place amenity icons, and link vector polygons directly to property database rows.
2. **Environmental & Climate Layers**: Buyers can filter lots by Morning/Afternoon Sunlight orientations, high/low Flood Risks, guard house proximity, and active noise zones.
3. **Smart Rule-Based Recommendations**: Buyers input their budget, bedroom requirements, parking preferences, and safety tolerances to discover and highlight matching coordinates.
4. **48-Hour Unpaid Expirations**: Active countdown timers warn buyers that unpaid holds automatically expire, releasing properties back to available.
5. **Auditing Ledger**: Accountants audit GCash/Maya receipts, log Official Receipt numbers, verify deposits, or reject entries.

---

## 🛠️ Technology Stack

- **Framework**: Next.js (App Router, dynamic routing)
- **Language**: JavaScript (ES6+)
- **Styling**: Tailwind CSS (Tailwind v4 theme variables)
- **Vector Canvas**: Konva.js & React Konva
- **Database / Auth / Storage**: Supabase Suite
- **Analytics**: Recharts & Lucide React Icons

---

## 💾 Database Setup

All database interactions are database-driven and guarded by strict Supabase Row-Level Security (RLS).

1. Create a new project in your **Supabase Dashboard**.
2. Open the **SQL Editor** in the dashboard.
3. Copy the contents of the database schema file located at [supabase/schema.sql](file:///c:/Users/lenovo/iReserve/supabase/schema.sql) and paste it into the editor.
4. Click **Run** to execute the query. This instantiates all 15 tables, relational indexes, triggers, profiles synchronizers, and security policies.

---

## 📂 Supabase Storage Buckets Setup

To manage images and secure documents, create the following 5 buckets in your Supabase **Storage** panel:

| Bucket Name             | Access Type    | Description / Assets                                           |
| :---------------------- | :------------- | :------------------------------------------------------------- |
| `public-village-images` | **Public**     | Village hero sliders, logo emblems, property thumbnails.       |
| `property-images`       | **Public**     | Detailed floor plans, street-views, galleries.                 |
| `private-documents`     | **Private**    | Goverment ID proofs, income statements (requires signed URLs). |
| `payment-proofs`        | **Private**    | Bank slips, GCash audit transfer screenshots.                  |
| `blueprint-assets`      | **Restricted** | Canvas background blueprints, architect icons.                 |

### Storage Security Policies:

- **Insert Rules**: Authenticated users can upload documents where `auth.uid() = customer_id`.
- **Read Rules**: Public folders are readable by all. Private buckets (`private-documents` and `payment-proofs`) are only accessible by their respective customer, assigned accounting staff, and super admins.

---

## ⚙️ Environment Configurations

Create a `.env.local` file at the project root based on the template below:

```bash
# Supabase Project Credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-private-service-role-key

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
GMAIL_SMTP_USER=belledesk.info@gmail.com
GMAIL_SMTP_HOST=smtp.gmail.com
GMAIL_SMTP_PORT=465
GMAIL_SMTP_SECURE=true
GMAIL_SMTP_APP_PASSWORD=your_16_character_google_app_password
GMAIL_SMTP_FROM_NAME=iReserve
GMAIL_SMTP_REPLY_TO=belledesk.info@gmail.com
```

Gmail SMTP requires 2-Step Verification and a Google App Password. Do not use the normal Gmail account password. Email delivery is skipped safely when these values are missing, while in-app and real-time notifications continue normally.

---

## 🏃 Local Development

To run the application locally, execute the following commands in your shell:

```bash
# Install dependencies
npm install

# Start local server
npm run dev
```

Open your browser and navigate to `http://localhost:3000` to interact with iReserve!

### Paperdoc Report Service

Administrative PDF, XLSX, and CSV exports are rendered by the PHP 8.2
Paperdoc service in `report-service/`.

```bash
docker compose -f docker-compose.reports.yml up --build
```

Configure `REPORT_SERVICE_URL` and use the same strong
`REPORT_SERVICE_SECRET` for Next.js and the report service. See
`report-service/README.md` for local PHP and deployment details.

---

## 👥 Roles for Manual Verification

For simple local manual verification, the system supports choosing testing roles directly on the registration form:

1. **Super Admin**: Set up a new village community.
2. **Architect**: Launch the vector blueprint and sketch roads (click points, double-click to finish), place lots, map zones, and publish layouts.
3. **Village Admin**: View stats, click lot polygons on the blueprint, and audit specs (price, sunlight, flood risk).
4. **Guest / Customer**: Browse village landing pages, filter matching properties, launch the monthly calculator, submit reservations, and log receipts.
5. **Accounting**: Inspect verified queues, input Official Receipt numbers, audit proof attachments, and approve.
