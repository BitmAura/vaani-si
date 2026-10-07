# Website Ingestion Engine

## 1. Overview

The website ingestion module (`WebsiteIngestor`) allows businesses to ingest marketing pages, service descriptions, and pricing tables from their public websites into searchable knowledge chunks.

## 2. Ingestion Workflow

```
User provides URL (e.g., https://apollo-clinic.com/about)
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 1. Pre-Flight SSRF Validation                          │
│ • Protocol check (HTTP/HTTPS only)                     │
│ • Hostname check (No localhost/internal)               │
│ • DNS pre-resolution (No RFC 1918 or 169.254.x.x IPs)  │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 2. Safe HTTP Fetch with Timeout & Size Limits          │
│ • AbortController 10-second timeout                    │
│ • 2 MB maximum response buffer limit                   │
│ • Content-Type verification (text/html)                │
│ • Redirect destination post-flight validation          │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 3. HTML Cleaning & Text Extraction                     │
│ • Strips <script>, <style>, <nav>, <footer>, <svg>     │
│ • Extracts <title> and heading tags (h1-h3)            │
│ • Normalizes whitespace and line breaks                │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ 4. Passage to Ingestion Pipeline                       │
│ • Chunking -> Embedding -> Vector Index                │
│ • Record source last_synced_at timestamp               │
└────────────────────────────────────────────────────────┘
```

## 3. Crawler Boundaries & Guardrails

To prevent accidental resource exhaustion or uncontrolled recursive crawling:
- **Scope Limit**: Single page or bounded depth of 1 (same origin).
- **Concurrency Limit**: Maximum 2 concurrent page fetches per tenant.
- **Rate Limit**: Enforces a minimum 1.5-second politeness delay between fetches of the same domain.
- **Sync Model**: Manual "Sync Now" trigger per source; automated cron synchronization will be introduced in future background worker releases.
