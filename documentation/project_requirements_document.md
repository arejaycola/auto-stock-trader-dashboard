# Project Requirements Document (PRD)

## 1. Project Overview

The Auto Stock Trader Dashboard is a web-based control panel for an automated stock trading system. It brings together user authentication, real-time market data, portfolio metrics, and strategy configuration into a single, easy-to-use interface. Traders can log in, monitor live price feeds and trading activity, adjust algorithm parameters, and view comprehensive performance reports—all without writing code or juggling multiple tools.

This dashboard is being built to make automated trading accessible and transparent. Instead of manually checking broker platforms and spreadsheets, users gain one-click access to their holdings, live charts, and trade logs. Success will be measured by user engagement (daily active users), data freshness (sub-second updates where possible), system reliability (99.9% uptime), and security compliance (OWASP top-10, encrypted credentials).

## 2. In-Scope vs. Out-of-Scope

### In-Scope (Version 1)
- Secure user registration, login, logout, and session management
- Dashboard layout with left-nav and main content area
- Real-time stock price feeds and trade execution updates via WebSockets/SSE
- Portfolio overview: asset allocation chart, profit & loss stats, historical trends
- Strategy configuration UI: entry/exit rules, risk limits, asset filters
- API-for-Frontend layer in Next.js to fetch/proxy data from trading engine
- In-app notifications (banners) and audit log of user actions
- Responsive design with light/dark mode theming
- Basic error handling and form validation

### Out-of-Scope (Later Phases)
- Native mobile apps (iOS/Android)
- Multi-broker integrations or auto-switching between brokers
- AI-driven trade recommendations or signal generation
- Advanced reporting exports (PDF/Excel) beyond audit logs
- Multi-user roles/permissions (admin vs. trader)
- Regulatory compliance modules (tax forms, SEC filings)
- Backtesting environment or paper‐trading simulator

## 3. User Flow

A new user lands on the public homepage and clicks **Sign Up**. They fill out an email/password form, which calls the Next.js API route for registration. Upon success, they’re redirected to the **Sign In** page. After logging in, the dashboard loads with a left-side navigation menu (Dashboard, Portfolio, Strategies, Notifications, Settings) and the main content area showing live price charts and recent trades.

Returning users go straight to the **Sign In** page if not already authenticated. After login, they arrive on the **Dashboard**: real-time price feeds scroll across the top, a summary of today’s P/L sits below, and the navigation lets them jump to **Portfolio** for deeper metrics or **Strategies** to tweak algorithm parameters. Clicking **Notifications** reveals recent alerts, and **Settings** lets users switch themes or update their profile.

## 4. Core Features

- **Authentication & Authorization**: Email/password signup, secure session cookies, JWT or NextAuth.js integration, protected routes.
- **Real-Time Dashboard**: WebSockets or Server-Sent Events to push live price and trade data; fallback polling every 5s.
- **Portfolio Overview**: Pie charts for allocation, tables for holdings, historical line graph of portfolio value.
- **Strategy Configuration**: Form controls to set entry/exit rules, risk thresholds, assets list; save/load strategy presets.
- **API-For-Frontend Layer**: Next.js API routes that abstract calls to the trading engine, handle token injection, and centralize error handling.
- **Notifications & Alerts**: In-app banners for trade executions, threshold breaches; RSS/email toggles for later.
- **Audit Log**: Immutable list of user actions (strategy changes, manual trades) with timestamps.
- **Responsive Design & Theming**: CSS with support for desktop, tablet, mobile; toggleable light/dark themes.
- **Error Handling & Validation**: Client- and server-side form checks, global error boundary component, user-friendly messages.

## 5. Tech Stack & Tools

- **Frontend Framework**: Next.js 13 (App Router), React 18, TypeScript
- **Styling**: CSS Modules or Tailwind CSS, CSS custom properties for theming
- **Backend (BFF)**: Next.js API routes (Node.js, Express-style handlers)
- **Real-Time**: Socket.io or native WebSocket/SSE endpoints
- **Data Fetching**: SWR (stale-while-revalidate) for client caching
- **Database**: PostgreSQL (via Prisma ORM) or MongoDB (via Mongoose)
- **ORM/ODM**: Prisma or Mongoose for schema & migrations
- **Deployment**: Vercel or AWS Amplify
- **Logging & Monitoring**: Sentry for exceptions, LogRocket or DataDog for session/replay
- **Dev Tools**: VS Code, ESLint, Prettier, Husky + lint-staged

## 6. Non-Functional Requirements

- **Performance**: Page load ≤ 2s on 3G; TTFB ≤ 200ms; Charts update < 1s latency
- **Security**: HTTPS only; OWASP Top-10 protections; CSRF tokens; password hashing (bcrypt); encryption at rest for sensitive configs
- **Compliance**: GDPR‐ready (user data deletion, consent banner), audit trail for actions
- **Usability**: WCAG 2.1 AA accessibility; clear error messages; keyboard navigation support
- **Availability**: 99.9% uptime; automatic retry on transient API failures

## 7. Constraints & Assumptions

- The trading engine API is already available and secured (API key + signature).
- Real-time endpoints can handle moderate load (≤ 1,000 concurrent WS connections).
- Users access from modern browsers (latest Chrome, Firefox, Safari).
- Environment variables (API URLs, DB creds) are managed via `.env` and secured in deployment.
- No offline mode or PWA support in v1.

## 8. Known Issues & Potential Pitfalls

- **API Rate Limits**: External trading API may throttle; implement exponential backoff and local caching.
- **Data Consistency**: Real-time updates vs. stale snapshots; use sequence IDs and reconcile on reconnect.
- **Scalability**: Next.js API routes can bottleneck under heavy CPU tasks; offload complex work to microservices.
- **Security Gaps**: Misconfigured CORS or open API routes; lock down endpoints with proper auth middleware.
- **Error States**: WebSocket dropouts; build robust reconnection logic and fallback polling.

---
This PRD provides a clear blueprint for building the Auto Stock Trader Dashboard. Each feature, flow, and constraint is spelled out so that development can proceed without guesswork.