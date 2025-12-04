# Loopt Desktop - Content Manager

A desktop content management application that connects to the Loopt mobile approval system **in real-time**. Create, organize, and submit social media content for approval.

## Real-Time Sync Architecture

```
┌─────────────────┐                           ┌─────────────────┐
│  Desktop App    │  ←──── Real-time ────→   │  Mobile Web App │
│  (Content Mgmt) │          Sync             │  (Approval)     │
└────────┬────────┘                           └────────┬────────┘
         │                                             │
         │           ┌───────────────┐                 │
         └───────────→   Supabase    ←─────────────────┘
                     │   Database    │
                     │  (PostgreSQL) │
                     │  + Real-time  │
                     └───────────────┘
```

### How Real-Time Sync Works

1. **Desktop creates content** → Saved to Supabase with `status: 'draft'`
2. **Desktop submits for review** → Status changes to `pending`
3. **Mobile gets instant notification** → Real-time subscription fires
4. **Mobile approves/rejects** → Status changes to `approved`/`rejected`
5. **Desktop sees update instantly** → Real-time subscription fires

Both apps share the same Supabase database and use PostgreSQL's real-time capabilities for instant sync.

## Features

### ✅ Calendar View
- Month view showing scheduled content
- Color-coded status indicators (draft, pending, approved, rejected)
- Quick navigation between months

### ✅ Content Editor
- Platform selection (LinkedIn, Facebook, Instagram, Twitter)
- Content type (Post, Carousel, Video, Story, Reel)
- Scheduled date picker
- Idea/Brief and Caption fields
- Media upload via drag & drop
- Auto-save drafts

### ✅ All Posts View
- Filter by status and platform
- Quick submit to review

### ✅ Real-Time Updates
- Instant sync with mobile app
- Toast notifications for approvals/rejections
- See feedback in real-time

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (for real-time sync)

### Installation

```bash
cd desktop-app
npm install
```

### Environment Setup

Create a `.env` file with your Supabase credentials (same as mobile app):

```env
VITE_API_BASE_URL=http://localhost:7328
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Migration

Run the migration to set up the database schema:

```bash
# From the root folder
npx supabase db push
```

Or manually run the SQL in `supabase/migrations/20251204_desktop_sync.sql`.

### Start Development

```bash
# Terminal 1: Start backend server
cd ..
node server.cjs

# Terminal 2: Start desktop app
cd desktop-app
npm run dev
```

The app will be available at `http://localhost:1420`

## Workflow

1. **Create Content** (Desktop)
   - Click "New Post" → Fill details → "Save Draft"
   - Draft is saved to Supabase

2. **Submit for Review** (Desktop)
   - Click "Submit for Review"
   - Status changes to "Pending"
   - Mobile app gets real-time notification

3. **Approve/Reject** (Mobile)
   - Open mobile app → Swipe to approve/reject
   - Status updates in real-time

4. **See Feedback** (Desktop)
   - Toast notification appears instantly
   - Post status updates automatically
   - If rejected, see rejection reason

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime
- **Desktop Wrapper**: Tauri (optional)

## Building for Production

### Web Build
```bash
npm run build
npm run preview
```

### Native Desktop App
Requires Rust installation:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
npm run tauri build
```

## Project Structure

```
desktop-app/
├── src/
│   ├── lib/
│   │   ├── components/     # UI components
│   │   ├── services/
│   │   │   ├── api.ts      # API + Supabase integration
│   │   │   └── supabase.ts # Supabase client
│   │   ├── stores/         # Svelte stores + real-time
│   │   └── types/          # TypeScript types
│   └── routes/             # SvelteKit routes
└── ...
```
