# Dhwani SI Deployment Guide

**Production deployment guide for Vanni Voice Intelligence Platform**

---

## 🚀 Quick Deployment (5 minutes)

### Prerequisites

- Docker & Docker Compose installed
- Production API keys (Sarvam, Gemini, Exotel)
- Domain name with SSL certificate
- PostgreSQL database (or Supabase account)

### 1. Clone & Configure

```bash
git clone <repository-url>
cd vaani-si

# Copy environment template
cp .env.example .env

# Edit with your production credentials
nano .env
```

### 2. Set Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Voice APIs (REQUIRED)
SARVAM_API_KEY=sarvam_live_your_key_here
GEMINI_API_KEY=AIzayour_gemini_key_here

# Telephony (REQUIRED for production calls)
EXOTEL_ACCOUNT_SID=your_exotel_sid
EXOTEL_API_KEY=your_exotel_key
EXOTEL_API_TOKEN=your_exotel_token

# Billing (REQUIRED for subscriptions)
RAZORPAY_KEY_ID=rzp_live_your_key
RAZORPAY_KEY_SECRET=your_secret

# Security
COOKIE_SECRET=random-32-char-string
```

### 3. Deploy with Docker

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f api-server

# Verify health
curl http://localhost:4100/health
```

### 4. Run Database Migrations

```bash
# If using Supabase
npx supabase db push

# If using self-hosted PostgreSQL
psql $DATABASE_URL < supabase/migrations/*.sql
```

### 5. Verify Deployment

```bash
# API Server
curl http://localhost:4100/health

# Voice Gateway
curl http://localhost:4200/health

# WebSocket test
wscat -c ws://localhost:4200/ws/voice-stream
```

---

## 🏗️ Production Deployment Options

### Option A: Docker Compose (Recommended for Pilot)

**Pros:**
- Simple setup
- All services in one place
- Easy to debug

**Cons:**
- Single point of failure
- Manual scaling

**Steps:**
```bash
# 1. Configure production .env
# 2. Pull images
docker-compose pull

# 3. Start services
docker-compose up -d

# 4. Enable SSL with Caddy/Traefik
# 5. Monitor logs
docker-compose logs -f
```

### Option B: Kubernetes (Recommended for Scale)

**Pros:**
- Auto-scaling
- High availability
- Rolling updates

**Cons:**
- Complex setup
- Higher operational cost

**Steps:**
```bash
# 1. Create namespace
kubectl create namespace vanni

# 2. Create secrets
kubectl create secret generic vanni-secrets \
  --from-literal=SARVAM_API_KEY=your_key \
  --from-literal=GEMINI_API_KEY=your_key \
  --from-literal=DATABASE_URL=your_url \
  -n vanni

# 3. Apply Kubernetes manifests
kubectl apply -f k8s/ -n vanni

# 4. Verify deployment
kubectl get pods -n vanni
```

### Option C: Cloud Platforms

#### AWS (EKS + RDS + ElastiCache)
```bash
# 1. Create EKS cluster
eksctl create cluster --name=vanni-cluster

# 2. Deploy with Helm
helm install vanni ./helm-chart

# 3. Configure Route53 for DNS
# 4. Enable AWS Certificate Manager for SSL
```

#### Google Cloud (GKE + Cloud SQL)
```bash
# 1. Create GKE cluster
gcloud container clusters create vanni-cluster

# 2. Deploy services
kubectl apply -f k8s/

# 3. Configure Cloud SQL proxy
```

#### DigitalOcean (App Platform)
```bash
# 1. Connect GitHub repo
# 2. Configure environment variables
# 3. Enable auto-deploy
```

---

## 🔒 Security Checklist

### Before Deployment

- [ ] All secrets in environment variables (never in code)
- [ ] Database has strong password
- [ ] SSL/TLS enabled
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] API keys have minimal permissions
- [ ] Firewall rules configured

### After Deployment

- [ ] Test authentication flow
- [ ] Verify multi-tenant isolation
- [ ] Check audit logs
- [ ] Test webhook signatures
- [ ] Verify HTTPS redirects
- [ ] Run security scan

---

## 📊 Monitoring Setup

### 1. Health Checks

```bash
# API Server
GET https://your-domain.com/health

# Expected response:
{
  "status": "ok",
  "service": "vanni-api-server",
  "version": "1.0.0"
}
```

### 2. Metrics Endpoint

```bash
# Prometheus metrics
GET https://your-domain.com/metrics
```

### 3. Latency Monitoring

```bash
# Check invariant compliance
GET https://your-domain.com/api/observability/latency

# Expected:
{
  "avgTotal": 620,
  "p95Total": 710,
  "complianceRate": 98.5
}
```

### 4. Alerting (PagerDuty/Slack)

```yaml
# Example PagerDuty integration
alerts:
  - type: latency_violation
    threshold: 750ms
    action: notify_pagerduty
  
  - type: error_rate_high
    threshold: 5%
    action: notify_slack
```

---

## 🧪 Testing Production

### Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run tests/load/voice-pipeline.js

# Monitor results
# - Latency should stay <750ms
# - No 5xx errors
# - Memory stable
```

### Integration Testing

```bash
# Run E2E tests with production URLs
TEST_URL=https://your-domain.com npm run test:e2e
```

### Voice Pipeline Test

```bash
# Test actual call flow
curl -X POST https://your-domain.com/api/test/voice \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"message": "Namaskara"}'
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check firewall
# PostgreSQL requires port 5432 open
```

#### 2. WebSocket Connection Refused

```bash
# Check if port 4200 is open
netstat -tulpn | grep 4200

# Check logs
docker-compose logs voice-gateway

# Verify CORS
curl -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  http://localhost:4200/health
```

#### 3. High Latency (>750ms)

```bash
# Check component latencies
curl https://your-domain.com/api/observability/latency

# Common causes:
# - Large audio buffers
# - Slow LLM responses
# - Network issues
# - Database queries

# Solutions:
# - Enable caching
# - Optimize prompts
# - Use CDN for static assets
```

#### 4. Authentication Issues

```bash
# Check cookie settings
curl -v https://your-domain.com/api/auth/login

# Verify COOKIE_SECRET is set
echo $COOKIE_SECRET

# Check HTTPS
curl -k https://your-domain.com/api/auth/session
```

---

## 📈 Scaling Guide

### Vertical Scaling

```yaml
# docker-compose.yml
services:
  api-server:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
```

### Horizontal Scaling

```yaml
# Kubernetes
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vanni-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vanni-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 💾 Backup & Recovery

### Database Backup

```bash
# Daily backup script
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20261006.sql
```

### Configuration Backup

```bash
# Backup environment variables
cp .env .env.backup

# Store in secret manager
aws secretsmanager create-secret \
  --name vanni/prod/env \
  --secret-string file://.env
```

---

## 🔧 Maintenance

### Regular Tasks

**Daily:**
- Check error logs
- Monitor latency metrics
- Verify backup completion

**Weekly:**
- Update dependencies
- Review security alerts
- Check API usage limits

**Monthly:**
- Rotate API keys
- Update SSL certificates
- Review cost optimization

---

## 📞 Support

**Documentation:** `/docs`  
**Issues:** GitHub Issues  
**Emergency:** +91-XXXX-XXXXXX

**SLA:** 99.9% uptime  
**Response time:** <1 hour for critical issues

---

**Deployment checklist:** See `PROJECT_STATUS.md` for production readiness.
