# Base Template

A Next.js + Express + Tailwind v4 project template with DataTable components, theme toggling, and authentication boilerplate.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ 
- npm 10+

### Installation

```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### Development

```bash
# Start Next.js dev server (from root)
npm run dev

# Start Express server (in another terminal)
npm run server:dev
```

The Next.js app will be available at `http://localhost:3000` and the Express server at `http://localhost:4000`.

## 📁 Project Structure

```
.
├── src/                          # Next.js App Router
│   ├── app/
│   │   ├── layout.tsx           # Root layout with theme support
│   │   ├── globals.css          # Tailwind v4 + TweakCN palette + p9 table styles
│   │   └── page.tsx             # Sample page (DataTable + Button)
│   ├── components/
│   │   ├── ui/                  # shadcn-style primitives
│   │   │   ├── button.tsx
│   │   │   ├── table.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── select.tsx
│   │   │   └── separator.tsx
│   │   └── tables/             # DataTable components
│   │       ├── data-table.tsx
│   │       ├── data-table-pagination.tsx
│   │       ├── data-table-view-options.tsx
│   │       └── data-table-column-header.tsx
│   └── lib/
│       └── utils.ts             # cn helper
├── server/                      # Express + TypeScript backend
│   ├── src/
│   │   └── index.ts             # Express bootstrap + auth endpoints
│   ├── package.json
│   └── tsconfig.json
├── components.json               # shadcn conventions
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json                  # Monorepo root
```

## 🎨 Theme Toggling

The template supports multiple theme modes via HTML class toggles. Modify the `className` prop on the `<html>` tag in `src/app/layout.tsx`:

- `""` (default) - Light theme
- `"dark"` - Dark theme
- `"turnaround"` - Turnaround theme (light)
- `"turnaround dark"` - Turnaround theme (dark)

### Example Theme Toggle Component

You can create a client component to toggle themes dynamically:

```tsx
"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    root.className = theme;
  }, [theme]);

  return (
    <div className="flex gap-2">
      <button onClick={() => setTheme("")}>Light</button>
      <button onClick={() => setTheme("dark")}>Dark</button>
      <button onClick={() => setTheme("turnaround")}>Turnaround</button>
      <button onClick={() => setTheme("turnaround dark")}>Turnaround Dark</button>
    </div>
  );
}
```

## 🎯 Key Features

### UI Components

- **Button** - Multiple variants (default, secondary, destructive, outline, ghost, link) and sizes
- **Table** - Full table component with header, body, footer, and caption
- **Input** - Styled input with focus states and validation support
- **Dropdown Menu** - Radix UI dropdown with checkbox and radio items
- **Select** - Radix UI select component
- **Separator** - Horizontal and vertical separators

### DataTable

The DataTable component includes:
- Sorting on columns
- Column filtering/search
- Column visibility toggle
- Pagination with customizable page sizes
- Row click handlers
- Custom row styling
- Loading states support

### Server

Express server includes:
- Health check endpoint (`GET /health`)
- JWT authentication boilerplate (`POST /auth/login`)
- Protected route example (`GET /api/protected`)
- CORS configuration
- Cookie parser middleware

## 📝 Configuration

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=4000
JWT_SECRET=your-secret-key-here
```

### Tailwind Configuration

The template uses Tailwind v4 with:
- CSS variables for theming (TweakCN compatible)
- Dark mode via class toggle
- Custom p9 table styles
- DataTable zebra striping support

### Components Configuration

The `components.json` file follows shadcn/ui conventions:
- Style: default
- RSC: true (React Server Components)
- CSS variables: enabled
- Base color: slate

## 🔧 Scripts

### Root Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build Next.js app for production
- `npm run start` - Start Next.js production server
- `npm run lint` - Run ESLint
- `npm run server:dev` - Start Express development server
- `npm run build:server` - Build Express server
- `npm run build:all` - Build both Next.js app and server

### Server Scripts

- `npm run dev` - Start server with tsx (hot reload)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start compiled server
- `npm run typecheck` - Type check without building

## 📚 Locations

- **Global styles**: `src/app/globals.css`
- **UI primitives**: `src/components/ui`
- **DataTable**: `src/components/tables`
- **Utils**: `src/lib/utils.ts`
- **Server entry**: `server/src/index.ts`

## 🎨 Customizing Themes

The TweakCN palette section in `globals.css` is marked as "SAFE TO OVERWRITE". You can:

1. Go to [TweakCN Editor](https://tweakcn.com/editor/theme)
2. Customize your theme
3. Copy the generated CSS variables
4. Paste over the `:root` and `.dark` blocks in `globals.css`

The template preserves:
- DataTable styles
- p9 table variables
- Layout helpers
- Modal overlay styles

## 🔐 Authentication

The server includes JWT authentication boilerplate. To implement full authentication:

1. Add user database/models
2. Implement password hashing (bcryptjs is included)
3. Add login validation logic
4. Create auth middleware for protected routes
5. Add refresh token support if needed

## 📦 Dependencies

### Frontend
- Next.js 16+ (App Router)
- React 19+
- Tailwind CSS v4
- TanStack Table (React Table)
- Radix UI primitives
- Lucide React icons
- class-variance-authority
- clsx & tailwind-merge

### Backend
- Express
- TypeScript
- jsonwebtoken
- bcryptjs
- cors
- cookie-parser
- dotenv
- mssql (database client)

## 🚢 Deployment

### Next.js

The app can be deployed to Vercel, Netlify, or any Node.js hosting:

```bash
npm run build
npm run start
```

### Express Server

Build and run:

```bash
cd server
npm run build
npm run start
```

For production, consider:
- Using PM2 or similar process manager
- Setting up proper environment variables
- Configuring CORS for your domain
- Using a reverse proxy (nginx, etc.)

## 📄 License

MIT

## 🤝 Contributing

This is a template repository. Feel free to fork and customize for your needs!
