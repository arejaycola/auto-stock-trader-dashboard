# Frontend Guideline Document: auto-stock-trader-dashboard

This document explains how the frontend of the **auto-stock-trader-dashboard** is built and organized. It covers the main architecture, design principles, styles, components, state management, routing, performance optimizations, testing strategies, and more. By following these guidelines, any developer (even without deep technical background) can understand and work with the frontend codebase smoothly.

## 1. Frontend Architecture

### 1.1 Overview
- **Framework**: We use **Next.js** (App Router) to build a React-based web application. This gives us server-side rendering (SSR), static site generation (SSG), and client-side navigation out of the box.
- **Language**: **TypeScript** for type safety and better developer experience.
- **API Routes**: Built-in Next.js `/app/api/` routes serve as a Backend-for-Frontend (BFF) layer. They handle authentication and proxy calls to external trading services.

### 1.2 How It Supports Key Goals
- **Scalability**: Folder-based routing and API routes let us add new pages or endpoints simply by creating new files or folders.
- **Maintainability**: Component-based structure, TypeScript types, and clear separation between pages, layouts, styles, and APIs keep the code organized.
- **Performance**: SSR/SSG, code splitting, and lazy loading mean fast initial loads and smooth navigation.

## 2. Design Principles

1. **Usability**: Simple, intuitive interfaces. Clear labels, straightforward forms, and easy-to-read charts.
2. **Accessibility**: Follow WCAG guidelines—keyboard navigation, proper ARIA labels, focus states, and sufficient color contrast.
3. **Responsiveness**: Layouts and components adapt gracefully from mobile screens to large desktop monitors.
4. **Consistency**: Unified look and feel across pages using shared styles, components, and a theme system.

### Applying These Principles
- Buttons, inputs, and charts use consistent spacing, colors, and typography.
- All interactive elements have hover/focus styles and ARIA attributes.
- Layouts collapse or stack on smaller screens and expand on larger ones.

## 3. Styling and Theming

### 3.1 Styling Approach
- **CSS Modules** for component-scoped styles (e.g., `Component.module.css`).
- **Global CSS** files (`globals.css`, `theme.css`) for base styles, CSS variables, and resets.
- **PostCSS** and **Autoprefixer** configured in Next.js to ensure cross-browser support.

### 3.2 Theming
- We use **CSS variables** to define light and dark themes.
- Users can switch themes; the app persists their choice in `localStorage` and applies it at runtime.

### 3.3 Visual Style
- **Style**: Modern flat design with subtle glassmorphism touches on dashboard panels (frosted backgrounds with gentle blur).
- **Font**: "Inter" (Google Fonts) for clean, readable text.

### 3.4 Color Palette
Primary and secondary colors for branding, plus semantic colors for data states.

| Role              | Light Mode    | Dark Mode     |
|-------------------|---------------|---------------|
| Background (main) | #F3F4F6       | #111827       |
| Surface (cards)   | rgba(255,255,255,0.8) (glass) | rgba(17,24,39,0.8) (glass) |
| Primary           | #2563EB       | #3B82F6       |
| Secondary         | #10B981       | #34D399       |
| Text (default)    | #111827       | #F9FAFB       |
| Text (muted)      | #6B7280       | #9CA3AF       |
| Success (gain)    | #16A34A       | #22C55E       |
| Error (loss)      | #DC2626       | #EF4444       |
| Warning           | #F59E0B       | #FBBF24       |

## 4. Component Structure

- **Pages**: Under `/app/[pageName]/page.tsx`. Each folder in `/app` maps to a route.
- **Layouts**: Global layout at `/app/layout.tsx`; dashboard-specific layout at `/app/dashboard/layout.tsx`.
- **Shared Components**: Placed in `/components/` (e.g., `Button`, `Card`, `Chart`). Each component has its folder: `ComponentName/ComponentName.tsx` and `ComponentName.module.css`.
- **Reuse**: Common UI pieces (modals, forms, tables) live in `/components/ui/` for easy import everywhere.

Benefits of this approach:
- Clear separation of concerns.
- Easy to find, update, and test individual pieces.
- Reduces duplication and keeps the UI consistent.

## 5. State Management

- **Authentication Context**: A React Context (`AuthContext`) holds user info, login/logout functions, and auth token.
- **Data Fetching & Cache**: We use **SWR** (from Vercel) for fetching, caching, and revalidation of trading data and user settings. SWR keeps data fresh and handles loading/error states gracefully.
- **Local Component State**: `useState` and `useReducer` for form controls, modals, and transient UI state.

This mix ensures:
- Global state (user session) is always available.
- Server data is fetched efficiently and stays up-to-date.
- Local UI state remains simple and isolated.

## 6. Routing and Navigation

- **Next.js App Router** handles routing by folder and file names under `/app`.
- **Link** component from `next/link` for client-side navigation.
- **Protected Routes**: Dashboard pages guard access by checking `AuthContext`; unauthenticated users are redirected to `/sign-in`.
- **Navigation Layout**: The dashboard layout includes a sidebar or top nav with links to overview, history, strategy settings, and notifications.

## 7. Performance Optimization

1. **Code Splitting & Dynamic Imports**: Use `next/dynamic` to lazy-load heavy or rarely used components (e.g., charting library).
2. **Image Optimization**: Use `next/image` for any static or dynamic images.
3. **SSR & ISR**: Critical pages use server-side rendering for up-to-date data; less critical or static parts use incremental static regeneration for faster loads.
4. **Asset Optimization**: Minified CSS, JS, and optimized SVG icons.
5. **Memoization**: `React.memo`, `useMemo`, and `useCallback` to prevent unnecessary renders.
6. **Virtualized Lists/Tables**: For large data sets, use libraries like `react-window`.

These strategies ensure quick load times and a smooth, responsive interface.

## 8. Testing and Quality Assurance

- **Unit Tests**: Jest + React Testing Library for components, hooks, and utility functions.
- **Integration Tests**: Test interaction between components and data fetching using mocked API routes.
- **End-to-End (E2E) Tests**: Cypress (or Playwright) to simulate user flows—sign-in, view dashboard, update strategy, etc.
- **Linting & Formatting**: ESLint (with TypeScript plugin) and Prettier enforce code style and catch errors early.
- **Continuous Integration**: GitHub Actions runs linting, tests, and type checks on every pull request.

## 9. Conclusion and Overall Frontend Summary

The **auto-stock-trader-dashboard** frontend is built on Next.js with TypeScript, following a clear, component-based structure. It emphasizes usability, accessibility, and performance while offering a modern, flat design with glassmorphism touches. Styling is handled via CSS Modules and global CSS variables for easy theming. State is managed through React Context and SWR for real-time data, and routing is seamlessly handled by the Next.js App Router. Performance optimizations, comprehensive testing, and consistent coding standards ensure a reliable, maintainable codebase. Together, these guidelines align the implementation with project goals—delivering a fast, user-friendly dashboard for automated stock trading.  