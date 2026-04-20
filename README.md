# D&D Ultimate Assistant

A full-stack campaign management web application for Dungeons & Dragons.
Supports multiple campaigns, character/creature/item management, and a modular plugin system with widget, fullscreen, and popup view modes.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite (SWC) |
| Backend | Express 5 + TypeScript (REST API) |
| Database | MySQL 8 via `mysql2/promise` (connection pool) |
| Auth | JWT (access + refresh tokens) via `httpOnly` cookies + `bcryptjs` |
| Styling | Plain CSS with BEM naming + CSS custom properties |
| Icons | `lucide-react` |
| Routing | `react-router-dom` v7 |

---

## Project Structure

```
/
 backend/          # Express REST API
 frontend/         # React SPA (Vite)
 CLAUDE/           # AI agent documentation
 docs/             # Legacy analysis & planning docs
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- MySQL 8 running locally
- `.env` file in `backend/` (see `backend/src/config/env.ts` for required vars)

### Backend

```bash
cd backend
npm install
npm run dev       # tsx watch mode, default port 3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # Vite dev server, default port 5173
```

### Database

Run `backend/src/db/database.sql` against your MySQL instance to create all tables.
Then apply any incremental migrations in `backend/src/db/migrations/`.

---

## Architecture Overview

### Backend

```
src/
 index.ts                    # App bootstrap, middleware, route registration
 config/                     # db.ts (pool)  env.ts (env vars)
 auth/                       # JWT auth module
 core/                       # Shared middleware, utils, types
 modules/
     campaigns/ users/ settings/ admin/    # Core modules
     plugins/
         core/               # Campaign-scoped entity plugins
            characters/
            creatures/
            effects/
            abilities/
            items/
         addon/              # Optional feature plugins
             combat/
             map/
             notes/
             screen/
```

**API base:** `http://localhost:3000/api`

| Prefix | Description |
|--------|-------------|
| `/api/auth` | Register, login, refresh, logout, /me |
| `/api/campaigns` | Campaign CRUD + join/leave + player management |
| `/api/characters` | Characters (campaign-scoped) |
| `/api/creatures` | Creatures (campaign-scoped) |
| `/api/abilities` | Abilities (owner-scoped) |
| `/api/effects` | Effect templates |
| `/api/items` | Items (campaign-scoped) |
| `/api/settings` | User + campaign + plugin config |
| `/api/admin` | Platform administration |

Addon routes (combat/map/notes/screen) are registered separately per module but NOT yet wired to `index.ts`  they are implemented and ready.

### Frontend

```
src/
 app/
    main.tsx                # Entry point
    App.tsx                 # Root component with providers
    router/                 # React Router config + AuthGuard
    providers/              # AuthProvider  CampaignProvider  UIProvider
                               # + AppContext  useApp  useAuth  useCampaign  useUI
 pages/
    Login/                  # Login page
    Home/                   # Campaign hub (standalone, no MainLayout)
       components/         # CampaignCard  ProfileModal  CreateCharacterModal
    Dashboard/              # Main workspace (inside MainLayout)
    Admin/                  # Admin panel
 services/api/               # API client modules (one file per resource)
 shared/
     types/                  # All shared TypeScript types (index.ts)
     constants/              # D&D constants (dnd.ts)
     hooks/                  # useIdleLogout
     icons/                  # pluginIcons.ts
     layout/
        MainLayout.tsx      # Dashboard shell (Sidebar + TopBar + plugins grid)
        topbar/             # TopBar.tsx + TopBar.css
        sidebar/            # Sidebar.tsx
        vault/              # Vault drawer (full entity management)
        settings/           # Settings panel
     ui/                     # Reusable component library
        components/         # Primitives: Button  Input  Select  Modal  Badge 
        blocks/             # Composites: CharacterCard  CreatureCard  ItemCard 
     plugins/
         PluginShell.tsx     # Wrapper for all plugins (handles view mode)
         index.ts            # Plugin registry + pluginRegistry + supportsMode()
         views/              # Plugin implementations
             CharactersPlugin.tsx
             CreaturesPlugin.tsx
             ItemsPlugin.tsx
             AbilitiesPlugin.tsx
             EffectsPlugin.tsx
```

### Routes

| Path | Page | Auth |
|------|------|------|
| `/login` | LoginPage | Public |
| `/home` | HomePage  campaign hub | Required |
| `/` | DashboardPage inside MainLayout | Required |
| `/admin` | AdminPage inside MainLayout | Required |
| `/test` | TestPage | Required |
| `*` | Redirect to `/home` |  |

### Plugin System

Plugins are the main feature blocks on the Dashboard. Each plugin can render in three modes:

- **widget**  grid card on the Dashboard
- **fullscreen**  expanded full-screen overlay
- **popup**  draggable floating overlay

Adding a plugin requires:
1. Create `src/shared/plugins/views/{Name}Plugin.tsx`
2. Add the slug to `PluginSlug` in `shared/types/index.ts`
3. Register in `shared/plugins/index.ts` (`pluginRegistry`)

---

## UI Component Library

Located at `src/shared/ui/`. All components exported from `shared/ui/index.ts`.

**Primitives:** Button  Card  HpBar  Input  Modal  Select  Switch  Textarea  SearchBar  Badge  StatChip  StatBlock  Avatar  Tag  Spinner  Tooltip  NumberStepper  Checkbox  ProgressBar  Divider

**Blocks:** StatRow  CombatStats  EntityHeader  FilterBar  CharacterCard  CreatureCard  ItemCard  AbilityCard  EffectRow

---

## Design Tokens (CSS Custom Properties)

```css
--color-bg-base:     #0b0b14     --color-bg-surface:  #111122
--color-bg-raised:   #1a1a2e     --color-border:      #2a2a3e
--color-text:        #e2e2ee     --color-text-muted:  #8888a4
--color-accent:      #7c83ff     --color-success:     #34d399
--color-warning:     #fbbf24     --color-danger:      #f87171
--color-info:        #60a5fa
--radius-sm/md/lg/xl            --transition-fast/normal
```

---

## Useful Commands

```bash
# Type-check only (no emit)
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

---

## AI Agent Docs

See `CLAUDE/` for architecture, conventions, project map, and task backlog.
