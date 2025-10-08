# Backend Structure Document

## 1. Backend Architecture

**Overall Design:**
- A Backend-for-Frontend (BFF) layer built with Next.js API routes handles authentication, session management and acts as a gateway between the React-based dashboard and core services.
- Core trading logic and data processing are separated into dedicated microservices (Node.js or Python) to isolate heavy computation and ensure scalability.
- A service-oriented pattern is used:
  - **Controllers/Routes:** Define API endpoints in Next.js for user-driven requests.
  - **Service Layer:** Encapsulates business logic (authentication, trade execution, data aggregation).
  - **Data Access Layer:** Uses an ORM (e.g., Prisma) to interact with the database.
  - **Message Broker:** Handles real-time event distribution (e.g., trade updates).

**Scalability & Performance:**
- Stateless API servers behind a load balancer allow horizontal scaling.
- Microservices can be deployed independently, each scaled according to CPU/network needs.
- Caching layer (Redis) reduces repeat database queries for hot data.
- CDN (Vercel/CloudFront) serves static assets and offloads traffic from origin.

**Maintainability:**
- Clear module boundaries: each service owns its domain models and APIs.
- TypeScript across codebase ensures type safety and predictable refactoring.
- Shared utility libraries for logging, error handling, and configuration.

## 2. Database Management

**Technologies Used:**
- SQL Database: PostgreSQL (primary data store)
- In-memory Cache: Redis (caching, pub/sub)
- Optional NoSQL: MongoDB (audit logs, unstructured notifications)

**Data Organization:**
- Relational tables for users, portfolios, trades, strategies, and alerts.
- Redis for session storage, rate-limiting tokens, and real-time publish/subscribe channels.
- MongoDB collection(s) for append-only audit log entries and system events.

**Data Practices:**
- Automated daily backups of PostgreSQL to object storage (Amazon S3).
- Read replicas for reporting and analytics workloads.
- Database migrations managed via Prisma Migrate or Flyway.
- Connection pooling and query timeouts to protect against overload.

## 3. Database Schema

**Human-Readable Overview:**
- **Users:** Accounts with credentials, profile info, and role-based access.
- **Portfolios:** Each user’s set of holdings, linked to trades and performance metrics.
- **Trades:** Records of executed buy/sell orders, timestamps, and outcome details.
- **Strategies:** User-configured algorithm parameters (entry/exit rules, risk limits).
- **Alerts:** Thresholds for price, performance, and system notifications.
- **AuditLogs (MongoDB):** Time-stamped events capturing user actions and errors.

**PostgreSQL Schema (SQL):**
```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolios
CREATE TABLE portfolios (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trades
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(4) NOT NULL, -- 'buy' or 'sell'
  quantity NUMERIC(20,8) NOT NULL,
  price NUMERIC(20,8) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL,
  strategy_id INTEGER REFERENCES strategies(id)
);

-- Strategies
CREATE TABLE strategies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  config JSONB NOT NULL, -- stores rules and parameters
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  criteria JSONB NOT NULL,
  is_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 4. API Design and Endpoints

**Approach:**
- RESTful API design via Next.js API routes.
- JSON over HTTPS as the transport format.
- Consistent response envelope: `{ success: boolean, data: ..., error?: string }`.

**Key Endpoints:**

- **Authentication** (`/api/auth/*`):
  - `POST /api/auth/signup` → Register a new user.
  - `POST /api/auth/login` → Obtain JWT access & refresh tokens.
  - `POST /api/auth/logout` → Invalidate active session.
  - `GET /api/auth/me` → Retrieve current user’s profile.

- **Portfolio & Trades** (`/api/portfolio/*` & `/api/trades/*`):
  - `GET /api/portfolio` → List user’s portfolios.
  - `POST /api/portfolio` → Create new portfolio.
  - `GET /api/portfolio/:id` → Details and performance metrics.
  - `GET /api/trades?portfolioId=:id` → List trades for a portfolio.
  - `POST /api/trades` → Submit a new trade request.

- **Strategies** (`/api/strategies/*`):
  - `GET /api/strategies` → User’s saved strategies.
  - `POST /api/strategies` → Create or update strategy config.
  - `PATCH /api/strategies/:id/activate` → Toggle strategy on/off.

- **Alerts & Notifications** (`/api/alerts/*`):
  - `GET /api/alerts` → Fetch active alerts.
  - `POST /api/alerts` → Define a new alert.

- **Real-Time Updates:**
  - WebSocket or Server-Sent Events endpoint (e.g., `/api/realtime`) for live price/portfolio streams.

## 5. Hosting Solutions

**Frontend & BFF (Next.js):**
- Deployed on Vercel for automatic scaling, global edge network, and zero-config SSL.

**Core Services & Databases:**
- **AWS Elastic Container Service (ECS) Fargate** for microservices.
- **Amazon RDS (PostgreSQL)** Multi-AZ for high availability.
- **Amazon ElastiCache (Redis)** Cluster mode enabled.
- **MongoDB Atlas** for managed audit log storage.

**Benefits:**
- Pay-as-you-go, auto-scaling on demand.
- High uptime SLAs and automated backups.
- Global distribution for lowest-latency access.

## 6. Infrastructure Components

- **Load Balancer:** AWS Application Load Balancer routes traffic to ECS tasks.
- **CDN:** Vercel’s edge network (or AWS CloudFront) caches static assets and API responses where appropriate.
- **Caching Layer:** Redis for session data, rate limiting, and pub/sub events.
- **Message Broker:** Redis pub/sub or RabbitMQ for distributing real-time updates to connected dashboards.
- **CI/CD Pipeline:** GitHub Actions builds, tests, and deploys on merge to `main`.
- **Secrets Management:** AWS Secrets Manager (or Vercel Environment Variables) for credentials and API keys.

## 7. Security Measures

- **Authentication & Authorization:**
  - JWT access and refresh tokens with short lifespans.
  - Role-based access control enforced in API middleware.
- **Encryption:**
  - HTTPS/TLS for all in-transit data.
  - AES-256 encryption at rest for RDS volumes and S3 buckets.
- **Input Validation & Sanitization:**
  - Joi or Zod for request schema validation.
  - ORM parameterization to prevent SQL injection.
- **API Protection:**
  - Rate limiting per IP or API key.
  - CORS policies restricted to allowed origins.
- **Vulnerability Management:**
  - Regular dependency audits (npm audit).
  - OWASP Top 10 compliance checks.

## 8. Monitoring and Maintenance

- **Logging & Error Tracking:**
  - Application logs forwarded to AWS CloudWatch.
  - Sentry for real-time error alerts and stack traces.
- **Metrics & Dashboards:**
  - Prometheus/Grafana or DataDog for CPU, memory, latency, and custom business metrics.
  - Alerts configured for high error rates or resource exhaustion.
- **Backup & Recovery:**
  - Automated nightly snapshots of PostgreSQL with point-in-time recovery.
  - Test restore procedures quarterly.
- **Maintenance Strategy:**
  - Rolling deployments to avoid downtime.
  - Dependency updates on a monthly cadence.
  - Security patching windows scheduled off-peak.

## 9. Conclusion and Overall Backend Summary

The backend is a modular, scalable system designed to power an automated stock trading dashboard. A Next.js BFF layer provides secure, low-latency APIs to the React frontend, while isolated microservices manage compute-intensive trading logic. A robust PostgreSQL foundation—augmented by Redis caching and MongoDB for logging—ensures data integrity, performance, and auditability. Hosted across Vercel and AWS with automated CI/CD, monitoring, and security best practices, the infrastructure aligns with the project’s goals: real-time trading insights, responsive user experience, and reliable operations at scale. Interactive features like WebSockets for live updates and flexible strategy configuration further differentiate this setup, delivering a comprehensive and enterprise-ready trading dashboard.