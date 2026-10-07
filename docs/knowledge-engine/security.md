# Knowledge Engine Security & Threat Model

## 1. Multi-Tenant Isolation & RLS

Every data item in the Knowledge Engine (`knowledge_sources`, `knowledge_documents`, `knowledge_chunks`, `knowledge_ingestion_jobs`) contains a mandatory `organization_id UUID` column with foreign key constraints.

### PostgreSQL Row Level Security (RLS)
The database migration (`005_knowledge_ingestion_and_retrieval.sql`) enforces tenant isolation directly inside the Postgres engine:
- Tenant users can only read chunks where `organization_id = (SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid() AND status = 'ACTIVE')`.
- Write/update operations are restricted to `OWNER`, `ADMIN`, or `MANAGER` roles.
- Cross-tenant queries are blocked at the database engine level, even if an application bug bypasses API filtering.

---

## 2. Server-Side Request Forgery (SSRF) Defense

The website ingestion module connects to external URLs supplied by users. To prevent attackers from scanning private infrastructure or querying cloud metadata endpoints, `SsrfValidator` enforces a multi-layer defense:

### 2.1 Protocol and Port Whitelist
- Allowed protocols: `http:`, `https:` only (blocks `file:`, `ftp:`, `gopher:`, `javascript:`, `data:`).
- Allowed ports: `80`, `443`, or standard empty default (blocks internal services on ports 22, 3306, 5432, 6379, 8080).

### 2.2 Hostname Blocklist
Blocks `localhost`, `*.localhost`, `*.local`, `*.internal`, `*.corp`, `metadata.google.internal`, and `instance-data`.

### 2.3 IP Range & CIDR Blocklist
Blocks direct IP URLs and resolves hostnames via DNS lookup to verify destination IPs:
- `127.0.0.0/8` (Loopback)
- `10.0.0.0/8` (RFC 1918 Private Class A)
- `172.16.0.0/12` (RFC 1918 Private Class B)
- `192.168.0.0/16` (RFC 1918 Private Class C)
- `169.254.0.0/16` (Link-Local & Cloud Metadata: AWS/GCP/Azure `169.254.169.254`)
- `0.0.0.0/8`, `100.64.0.0/10` (Carrier-grade NAT), `224.0.0.0/4` (Multicast), `255.255.255.255` (Broadcast)
- IPv6: `::1`, `::`, `fe80::/10`, `fc00::/7`, `fd00::/8`, and IPv4-mapped IPv6 `::ffff:127.0.0.1`.

### 2.4 Redirect Validation
When fetching a remote URL, the HTTP client follows redirects manually or validates the `response.url` against `isRedirectSafe()`. This prevents a malicious server from accepting a safe public URL (e.g. `https://attacker.com/redirect`) and issuing a 302 redirect to `http://169.254.169.254/latest/meta-data`.

---

## 3. Safe File Handling & Sandbox Rules

1. **No Native Binary Execution**: File extraction uses pure Node.js libraries (`zlib` and stream decoders). No external child processes (e.g., `pdftotext`, `poppler`, or shell commands) are spawned, eliminating arbitrary command execution vectors.
2. **File Size Limits**:
   - PDF uploads: Capped at 15 MB.
   - Text uploads: Capped at 5 MB.
   - Website HTML responses: Capped at 2 MB.
3. **MIME Type & Content Verification**: Files must pass both extension and content signature verification before parser execution.
4. **HTML Sanitization**: Remote HTML is parsed into pure DOM trees; script tags and style tags are completely dropped prior to normalization. JavaScript is never executed.
5. **Private Signed Storage**: Uploaded original files are stored under tenant-isolated paths (`organizations/{organizationId}/knowledge/{sourceId}/...`). Raw files are never exposed through public, unauthenticated URLs.
