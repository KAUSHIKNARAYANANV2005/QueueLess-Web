# E2E Web Selenium Testing Framework for QueueLess

This directory contains the E2E Selenium WebDriver testing framework for the QueueLess web application.

---

## Folder Structure

```
testing/web-tests/
├── config/
│   └── test.config.js               # Framework configuration settings
├── pages/                           # Page Object classes (POM)
│   ├── BasePage.js
│   ├── LoginPage.js
│   ├── CustomerHomePage.js
│   ├── BusinessDashboardPage.js
│   ├── BookingFlowPage.js
│   ├── AdminPage.js
│   └── CommonPage.js
├── tests/                           # Mocha E2E test suites
│   ├── 01-public-routes.test.js
│   ├── 02-auth.test.js
│   ├── 03-customer-flow.test.js
│   ├── 04-business-flow.test.js
│   ├── 05-admin-flow.test.js
│   ├── 06-notifications.test.js
│   ├── 07-smart-route.test.js
│   ├── 08-queuebot.test.js
│   ├── 09-ui-ux.test.js
│   └── 10-deployment-readiness.test.js
├── utils/                           # Test helpers and report generators
│   ├── driver.js
│   ├── reportManager.js
│   ├── screenshot.js
│   └── testData.js
├── reports/                         # Output folder
│   ├── screenshots/                 # Captured failure PNG images
│   └── web-test-report.xlsx         # Generated Excel E2E Report
├── package.json
└── README.md
```

---

## Installation & Setup

1. Make sure the local web app is running in developer mode:
   ```bash
   # In the root project directory
   npm run dev
   ```

2. Navigate into the testing directory:
   ```bash
   cd testing/web-tests
   ```

3. Install testing dependencies:
   ```bash
   npm install
   ```

4. Configure environment variables. Duplicate `.env.example` to `.env` and fill in credentials:
   ```bash
   cp .env.example .env
   ```

---

## Running Tests & Generating Reports

- **Run 10 Smoke Tests + Generate Excel Report** *(recommended quick start)*:
  ```bash
  node run-smoke.js
  ```
  This executes 10 critical smoke tests, runs the Vite build check, and generates the full Excel report at `reports/web-test-report.xlsx`.

- **Run Smoke Tests via Mocha** (public routes only):
  ```bash
  npm run test:smoke
  ```

- **Run All Tests (Headless/CI mode)**:
  ```bash
  npm run test:web
  ```

- **Run All Tests (Headed mode / visible browser)**:
  ```bash
  npm run test:web:headed
  ```

- **Inspect Report Summary**:
  ```bash
  npm run report
  ```

The final test execution results are automatically compiled into **`testing/web-tests/reports/web-test-report.xlsx`** with 5 sheets:
- **Summary** — Execution metadata, totals, build status
- **Test Cases 100+** — All 106 test cases (ID, Module, Steps, Status, Severity)
- **Smoke Execution** — The 10 executed smoke tests with timing & actual results
- **Bugs Found** — Auto-populated only when failures are detected
- **Deployment Readiness** — Build, .env, lock file, viewport checks
