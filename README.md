# Loopt Desktop - Content Manager

Desktop app for creating and managing social media content. Works with the [Loopt Mobile App](https://loopt.shooflyai.com) for content approvals.

## Live URLs

- **Desktop App**: https://loopt-desktop-app.netlify.app
- **Mobile App**: https://loopt.shooflyai.com

## Features

- 📅 **Calendar View** - Schedule and visualize content
- ✏️ **Content Editor** - Create posts with media upload
- 📱 **Mobile Preview** - One-click access to mobile approval app
- 🔄 **Real-time Sync** - Instant updates via Supabase

## Quick Start

```bash
cd desktop-app
npm install
npm run dev
```

Open http://localhost:1420

## Environment Variables

Copy from main app or set in Netlify:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_API_BASE_URL=http://localhost:7328
```

## Workflow

1. **Desktop**: Create content → Submit for review
2. **Mobile**: Approve or reject
3. **Desktop**: See status update in real-time

## Tech Stack

Svelte 5, SvelteKit, Tailwind CSS, Supabase, Tauri (optional)

## Deploy

```bash
npm run build
npx netlify-cli deploy --prod --dir=build
```
