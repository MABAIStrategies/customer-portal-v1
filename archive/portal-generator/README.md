Here is a fully-loaded, professional `README.md` tailored specifically for your customer portal repository. It aligns with the **Modern Stoic Luxury** aesthetic and establishes a robust architecture for a productized service workflow.

---

# Customer Portal (v1)

### `MAB AI Strategies`

> **Enterprise-Grade Client Infrastructure** > A sleek, high-performance workflow engine and interactive dashboard designed to manage, monitor, and scale autonomous AI agent operations for enterprise clients.

---

## ── System Architecture & Core Stack ──

This portal serves as the primary bridge between complex multi-agent execution layers and client-facing visibility. It acts as the central **Workflow OS** to make disparate systems talk to each other reliably.

* **Frontend Engine:** Next.js (App Router) / React — styled with a highly polished, interactive, mobile-responsive UI.
* **Design Language:** *Modern Stoic Luxury* (Matte Charcoal `#1A1A1A`, Tungsten Gray `#2E2E2E`, and Electric Blue accents `#00E5FF`). **Strictly zero glassmorphism.**
* **Automation & Sync State:** Native hooks into backend node clusters, `n8n`, `Zapier`, and centralized CRM data contracts.
* **Error Layer:** Explicitly structured fallback logic, execution logging, and automated escalation states.

---

## ── Core Feature Matrix ──

| Feature | Condition / Threshold | Automated Action |
| --- | --- | --- |
| **Agent Execution Monitor** | Run state changes to `FAILED` | Trigger instant runner retry; log error payload to main tracking Sheet. |
| **Quota & Usage Counter** | Client hits 90% of monthly API threshold | Render visual dashboard warning + queue automated renewal outreach sequence. |
| **Data Sync Infrastructure** | CRM webhook latency > 2500ms | Failover to secondary queue node; log high-latency event to infrastructure log. |
| **Escalation Protocol** | Client flags priority event via portal | Route ticket instantly via Google Chat space webhook with complete system state payload. |

---

## ── Operational Blueprint (Onboarding Flow) ──

```
[ Client Signed ] ──> [ Workspace Provisioned ] ──> [ Node Token Issued ] ──> [ Portal Live ]

```

1. **Contract Execution:** Package tier is committed, establishing the client data contract boundaries.
2. **Environment Provisioning:** Automatic creation of client-specific Google Sheets tracking logs and dedicated Google Workspace connection hooks.
3. **Secure Token Exchange:** Local compute clusters link securely to the portal via protected API handshakes.
4. **Client Dashboard Initialization:** The interactive tracking environment goes live, exposing real-time agent execution states and output delivery pipelines.

---

## ── Technical Setup & Deployment ──

### Prerequisites

* Node.js (v18+ recommended)
* Access tokens for core automation engines (`n8n` / `Zapier`)
* Google Workspace Service Account credentials

### Build & Installation Instructions

1. **Clone the Infrastructure Repository:**
```bash
git clone https://github.com/MABAIStrategies/customer-portal-v1.git
cd customer-portal-v1

```


2. **Configure Environment Declarations:**
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_PORTAL_THEME=stoic_luxury
CRM_SYNC_SECRET=your_secure_sync_token
GOOGLE_WORKSPACE_CREDENTIALS={"type": "service_account", ...}
LOGGING_LEVEL=VERBOSE

```


3. **Install Dependencies & Initialize Local Runner:**
```bash
npm install
npm run dev

```


*The portal will initialize locally at `http://localhost:3000`.*
4. **Production Deployment Execution:**
```bash
npm run build
npm run start

```



---

## ── Security Posture & Logging ──

* **Isolation Integrity:** Strict separation of client data contracts ensures no cross-tenant visibility of backend agent code packages, prompts, or execution logs.
* **Fallback Reliability:** If a centralized sync pipeline encounters a network drop, local state caches hold transaction histories until communication is validated and restored.
* **Audit Trails:** Every UI action, configuration update, or agent toggle logs a permanent, immutable record to internal monitoring architectures.
