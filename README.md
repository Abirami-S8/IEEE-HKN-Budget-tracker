
## Project Overview
IEEE-HKN Budget Scheduler is an intelligent financial planning and expense management platform built specifically for IEEE-HKN student chapters. It simplifies yearly budget allocation, real-time expense tracking, deadline management, and financial decision-making for chapter activities and funding. The system allows chapter officers and treasurers to efficiently record transactions, categorize expenses, manage academic-year finances, monitor budget status, and generate visual financial reports.

The platform provides analytics dashboards for tracking income vs expenses over time, category-based spending distribution, and net financial balance calculation. It supports academic-year-based filtering using UNIX timestamp formatting for consistent cross-platform date handling. Users can also export detailed reports in CSV format for submission or documentation purposes during audits, chapter reviews, or funding approvals.

With support for Supabase authentication, secure Row-Level-Security (RLS), receipt storage upload, and role-based user management, the application ensures both data privacy and collaborative financial management. Designed with React + Tailwind + Supabase + Docker, it provides a scalable, deployable, and production-ready solution tailored for IEEE-HKN financial operations.
### Used Technologies
| Category         | Technology                            |
| ---------------- | ------------------------------------- |
| Frontend         | React, TypeScript, Vite               |
| Styling          | TailwindCSS, ShadCN UI                |
| Authentication   | Supabase Auth                         |
| Database         | Supabase PostgreSQL                   |
| Storage          | Supabase Storage (for receipts)       |
| Charts & Reports | Recharts                              |
| Deployment       | Docker & vercel                       |
| Architecture     | Containerized Single-Page Application |

*List the main technologies, frameworks, or tools used in the project.*

- React.js + TypeScript — Frontend UI development

- Supabase — Authentication, database, and storage

- TailwindCSS / Shadcn UI — UI styling components

- Vite — Frontend build tool

- Docker — Containerized deployment

- Vercel — Hosting & deployment platform

### Implemented Features

*List the implemented functionalities and add a brief explanation if they differ from those included in the requirements.*

- Transaction Management (Income & Expenses with categories)

- Analytics Dashboard (visual trends, category charts)

- Deadline Tracking System

- CSV Export for Transactions & Deadlines

- Receipt Upload with Storage

- Academic-year-based Financial Tracking

- Authentication & Role-based access

- Net balance calculation(Actual balance & projected balance)

- Docker Container Deployment

- UNIX Timestamp requirement

## Running the Project

With Docker
```
docker build -t hkn-budget .
docker run -p 5173:80 hkn-budget
```
Then open in browser:
```
http://localhost:5173
```
Deployed link in vercel:
```
https://ieee-hkn-budget-tracker.vercel.app/
```
*List any admin and test credentials."
| Role                                               | Email                                       | Password |
| -------------------------------------------------- | ------------------------------------------- | -------- |
| chapter_treasurer                                  | chapter@ieee.hkn.org                        | abiabi   |                                          


## API

| Endpoint            | Method(s)  | Description                               |
| ------------------- | ---------- | ----------------------------------------- |
| `/transactions`     | **GET**    | Fetch all user transactions               |
| `/transactions`     | **POST**   | Add a new transaction (income/expense)    |
| `/transactions/:id` | **PUT**    | Update an existing transaction            |
| `/transactions/:id` | **DELETE** | Delete a transaction                      |
| `/deadlines`        | **GET**    | Fetch all funding deadlines               |
| `/deadlines`        | **POST**   | Create a new deadline record              |
| `/deadlines/:id`    | **DELETE** | Remove deadline record                    |
| `/reports/monthly`  | **GET**    | Generate monthly income & expense summary |
| `/reports/category` | **GET**    | Generate categorized spending report      |


## Database Structure

**Profiles**
| Column Name | Type        | Key |
| ----------- | ----------- | --- |
| id          | UUID        | PK  |
| username    | TEXT        |     |
| email       | TEXT        |     |
| created_at  | TIMESTAMPTZ |     |
| updated_at  | TIMESTAMPTZ |     |

**User Roles**
| Column Name | Type                 | Key              |
| ----------- | -------------------- | ---------------- |
| id          | UUID                 | PK               |
| user_id     | UUID                 | FK → profiles.id |
| role        | ENUM(`admin`,`user`) |                  |
| created_at  | TIMESTAMPTZ          |                  |

**Academic Years**
| Column Name | Type        | Key |
| ----------- | ----------- | --- |
| id          | UUID        | PK  |
| year_label  | TEXT        |     |
| start_date  | TIMESTAMPTZ |     |
| end_date    | TIMESTAMPTZ |     |
| is_current  | BOOLEAN     |     |
| created_at  | TIMESTAMPTZ |     |

**Transactions**
| Column Name         | Type                                    | Key                    |
| ------------------- | --------------------------------------- | ---------------------- |
| id                  | UUID                                    | PK                     |
| user_id             | UUID                                    | FK → profiles.id       |
| academic_year_id    | UUID                                    | FK → academic_years.id |
| type                | ENUM(`income`,`expense`)                |                        |
| amount              | DECIMAL(12,2)                           |                        |
| category            | TEXT                                    |                        |
| notes               | TEXT                                    |                        |
| status              | ENUM(`completed`,`planned`,`recurring`) |                        |
| transaction_date    | BIGINT (**UNIX timestamp**)             |                        |
| is_recurring        | BOOLEAN                                 |                        |
| recurrence_interval | TEXT                                    |                        |
| receipt_url         | TEXT                                    |                        |
| created_at          | TIMESTAMPTZ                             |                        |
| updated_at          | TIMESTAMPTZ                             |                        |

**Deadlines**
| Column Name      | Type                        | Key                    |
| ---------------- | --------------------------- | ---------------------- |
| id               | UUID                        | PK                     |
| user_id          | UUID                        | FK → profiles.id       |
| academic_year_id | UUID                        | FK → academic_years.id |
| title            | TEXT                        |                        |
| description      | TEXT                        |                        |
| due_date         | BIGINT (**UNIX timestamp**) |                        |
| is_completed     | BOOLEAN                     |                        |
| created_at       | TIMESTAMPTZ                 |                        |
| updated_at       | TIMESTAMPTZ                 |                        |

**Storage (Supabase Bucket: receipts)**
| Field       | Value                 |
| ----------- | --------------------- |
| bucket name | `receipts`            |
| access      | Private (RLS enabled) |
| path style  | `userId/filename.ext` |

**This project provides IEEE-HKN chapters with a complete end-to-end budgeting and reporting tool designed to increase transparency, improve financial planning, and simplify funding workflows using cloud-hosted, containerized deployment.**
