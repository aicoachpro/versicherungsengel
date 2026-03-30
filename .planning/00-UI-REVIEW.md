# Phase 00 -- UI Review

**Audited:** 2026-03-30
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md present)
**Screenshots:** Not captured (no dev server running on ports 3000, 5173, or 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Domain-specific German labels throughout, no generic "Submit" or "Click Here" patterns |
| 2. Visuals | 3/4 | Strong visual hierarchy, but icon-only buttons lack aria-labels entirely |
| 3. Color | 3/4 | Coherent Allianz Blue theme with gold accent, but hardcoded hex values in 12+ locations bypass the design token system |
| 4. Typography | 3/4 | Clean 4-size scale (xs/sm/lg/xl) with 3 weights (medium/semibold/bold), within acceptable range |
| 5. Spacing | 3/4 | Consistent Tailwind spacing with minor arbitrary values in audit-log column widths |
| 6. Experience Design | 3/4 | Loading and empty states well covered, but delete actions lack confirmation dialogs (except Nutzer) |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Icon-only buttons have no accessible labels** -- Screen readers cannot identify button purpose; keyboard users are lost -- Add `aria-label` to every icon-only `<Button>` (Edit, Delete, Archive, Download, ExternalLink). Roughly 25+ instances across kanban-board.tsx, pipeline/[id]/page.tsx, versicherungen/page.tsx, archiv/page.tsx.

2. **Hardcoded hex colors bypass design tokens** -- If the brand color changes, 12+ files need manual updates instead of one CSS variable change -- Replace all `bg-[#003781] hover:bg-[#002a63]` with `bg-primary hover:bg-primary/90` and chart fills `#003781`/`#c4a035` with `var(--primary)`/`var(--gold)` via CSS variables.

3. **Delete actions fire without confirmation** -- Lead delete, insurance delete, activity delete, and document delete all execute immediately on click with no undo -- Add a confirmation dialog (AlertDialog from shadcn) to all destructive actions. Currently only `nutzer/page.tsx:110` uses `confirm()`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

All UI copy is domain-specific German. CTAs are precise and action-oriented:

- "Neuer Lead", "Neuer Vertrag", "Neue Aktivitat", "Neuer Nutzer" -- clear creation labels
- "Speichern" / "Erstellen" -- context-dependent save buttons (edit vs. create)
- "Abbrechen" -- consistent cancel label
- "Wird angemeldet..." -- loading state copy on login button

Empty states are well-written with helpful guidance:
- `wiedervorlage/page.tsx:134`: "Sobald Leads einen Folgetermin haben, erscheinen sie hier"
- `pipeline/[id]/page.tsx:468-469`: "Noch keine Aktivitaten erfasst / Dokumentiere Telefonate, E-Mails und Meetings"
- `archiv/page.tsx:109`: Distinguishes between "no search results" and "no archived leads"

Error messages are specific:
- `settings/page.tsx:59`: "Passworter stimmen nicht uberein"
- `login/page.tsx:58`: "Ungultiger 2FA-Code" vs. "Ungultige Anmeldedaten"

No generic patterns found. Score: 4/4.

### Pillar 2: Visuals (3/4)

**Strengths:**
- Clear focal point: Dashboard KPI cards at top, charts below
- Kanban board has colored top-borders per phase for visual differentiation
- Consistent icon usage from lucide-react library
- Lead detail page has logical card-based sections (Info, Activities, Cross-Selling, Contracts, Documents)

**Issues:**
- **Zero `aria-label` attributes** across the entire `src/` directory. Every icon-only button (Edit2, Trash2, Download, ExternalLink, Archive, RotateCcw) is invisible to screen readers. Critical instances:
  - `kanban-board.tsx:177-190`: Edit and Delete buttons on every Kanban card
  - `pipeline/[id]/page.tsx:488-496`: Delete activity button
  - `pipeline/[id]/page.tsx:592-599`: Edit and Delete contract buttons
  - `versicherungen/page.tsx:280-285`: Edit and Delete on insurance table rows
- `archiv/page.tsx` partially compensates with `title=` attributes (lines 153, 162, 171), but `title` is not a reliable accessible name
- Mobile sidebar hamburger button (`sidebar.tsx:50`) has no accessible label

### Pillar 3: Color (3/4)

**Strengths:**
- Well-defined CSS custom properties in `globals.css` using oklch color space
- Allianz Blue (`#003781`) as primary with Gold (`#8B7D2A`) accent -- professional insurance branding
- Chart colors use a harmonious blue spectrum (`chart-1` through `chart-5`)
- Phase-specific colors are consistent across components (kanban-board, recent-activity, pipeline-funnel, lead-detail)
- Dark sidebar (`oklch(0.22 0.08 250)`) creates clear spatial separation

**Issues:**
- **Hardcoded hex values in 12+ locations** instead of using the `--primary` / `--gold` CSS variables:
  - `bg-[#003781] hover:bg-[#002a63]` in: pipeline/page.tsx:146, nutzer/page.tsx:127+241, versicherungen/page.tsx:204, settings/page.tsx:206+229+262, login/page.tsx:69+141, lead-dialog.tsx:265
  - `fill="#003781"` and `fill="#c4a035"` in revenue-chart.tsx:53+59
  - `text-[#003781]` in forgot-password and reset-password pages
  - `from-[#003781] via-[#002a63] to-[#001d45]` on login page gradient
- The `--gold` token is defined but the gold color is hardcoded as `#c4a035` in the chart (slightly different from the defined `#8B7D2A`)
- Some status colors use Tailwind palette directly (e.g., `bg-gray-100 text-gray-800`) which would not adapt to a theme change

### Pillar 4: Typography (3/4)

**Font sizes in use (app components, excluding shadcn/ui internals):**
- `text-xs` -- Badge labels, timestamps, secondary info
- `text-sm` -- Body text, table cells, form labels
- `text-lg` -- Card titles, section headers
- `text-xl` -- Page titles (Header component), lead name, KPI values, Gewerbeart counts
- `text-2xl` -- KPI card values (responsive `sm:text-2xl`)

5 sizes total -- slightly above the ideal 4, but the 5th (`text-2xl`) is only used in one responsive context (KPI cards at sm+ breakpoint). Acceptable.

**Font weights in use:**
- `font-medium` -- Nav items, table cells, form labels, badges
- `font-semibold` -- Section headers (h3), sidebar brand name, kanban phase headers
- `font-bold` -- KPI values, Gewerbeart counts, login page title

3 weights total -- within the acceptable range of 2-3.

**Minor issue:** `recent-activity.tsx:52` uses inline Tailwind for badge styling (`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`) instead of the shadcn `<Badge>` component. This creates a visual variant that may drift from the design system.

### Pillar 5: Spacing (3/4)

**Strengths:**
- Consistent page-level spacing: `p-6 space-y-6` on most pages
- Responsive spacing on dashboard: `p-4 sm:p-6`, `space-y-4 sm:space-y-6`, `gap-4 sm:gap-6`
- Kanban board uses consistent `gap-4` between columns and `space-y-3` within
- Card internals use `p-3` consistently for list items

**Arbitrary values found (via `[...px]` / `[...rem]` patterns):**
- `audit-log/page.tsx`: Fixed column widths `w-[150px]`, `w-[120px]`, `w-[110px]`, `w-[180px]`, `max-w-[300px]` -- acceptable for table layout
- `settings/page.tsx:258`: `max-w-[200px]` for TOTP input, `max-w-[300px]` for disable password
- `revenue-chart.tsx:27`: `h-[300px]` for chart container
- `kanban-board.tsx:78`: `min-h-[200px]` for column drop zone

These are all layout-specific constraints where Tailwind's standard scale does not offer exact equivalents. No concerning pattern.

**Minor inconsistency:** The Nutzer page uses `px-6 py-4` for the action bar and `px-6` for the table wrapper (no Card container), while other list pages (Versicherungen, Archiv) wrap content in Cards. This creates a slightly different visual rhythm.

### Pillar 6: Experience Design (3/4)

**Loading states (good coverage):**
- `login/page.tsx`: Button shows "Wird angemeldet..." with disabled state
- `pipeline/[id]/page.tsx:346-351`: Full-screen centered "Laden..." text
- `wiedervorlage/page.tsx:128-129`: "Laden..." placeholder
- `archiv/page.tsx:102-103`: "Laden..." placeholder
- `forgot-password` and `reset-password`: Loading text in buttons

**Empty states (excellent coverage):**
- Every list/table has a dedicated empty state with icon + explanatory text
- Wiedervorlage empty state includes the CalendarCheck icon and helpful subtext
- Archiv distinguishes between "no search results" and "no archived data"
- Activities, Documents, and Contracts sections all have contextual empty states

**Error states (good coverage):**
- Login: Specific error messages for invalid credentials vs. invalid TOTP
- Settings: Password mismatch, minimum length, server error display
- Nutzer: Error display in dialog + alert on delete failure
- API errors caught with fallback messages

**Issues:**
- **No confirmation for destructive actions** except Nutzer delete (`confirm()`):
  - `pipeline/page.tsx:93-95`: `handleDelete` fires DELETE immediately
  - `pipeline/[id]/page.tsx:283-286`: `handleDeleteVertrag` fires DELETE immediately
  - `pipeline/[id]/page.tsx:305-308`: `handleDeleteActivity` fires DELETE immediately
  - `pipeline/[id]/page.tsx:326-328`: `handleDeleteDocument` fires DELETE immediately
  - `versicherungen/page.tsx:179-181`: `handleDelete` fires DELETE immediately
- **No ErrorBoundary component** at the app level -- a rendering error in any component will crash the entire page
- **Pipeline page has no loading state**: `fetchLeads` does not set a loading indicator, so on first load the board appears empty before data arrives
- The Nutzer page uses native `confirm()` and `alert()` instead of a styled dialog, which is inconsistent with the rest of the design system

---

## Registry Safety

Registry audit: `components.json` exists. No UI-SPEC.md with third-party registry declarations found. Skipping third-party registry scan.

---

## Files Audited

- `src/app/globals.css`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/pipeline/page.tsx`
- `src/app/(app)/pipeline/[id]/page.tsx`
- `src/app/(app)/wiedervorlage/page.tsx`
- `src/app/(app)/versicherungen/page.tsx`
- `src/app/(app)/archiv/page.tsx`
- `src/app/(app)/nutzer/page.tsx`
- `src/app/(app)/audit-log/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/login/page.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/header.tsx`
- `src/components/dashboard/kpi-cards.tsx`
- `src/components/dashboard/revenue-chart.tsx`
- `src/components/dashboard/pipeline-funnel.tsx`
- `src/components/dashboard/gewerbeart-chart.tsx`
- `src/components/dashboard/upcoming-appointments.tsx`
- `src/components/dashboard/recent-activity.tsx`
- `src/components/pipeline/kanban-board.tsx`
- `src/components/pipeline/lead-dialog.tsx`
