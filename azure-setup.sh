#!/bin/bash
# ==============================================================================
# VANNI SI: AZURE B1s FREE TIER VOICE GATEWAY SETUP SCRIPT
# Run this script on your Azure Ubuntu VM to run the WebSocket voice gateway
# ==============================================================================

set -e

echo "1. Updating system & installing Docker & Node.js..."
sudo apt-get update -y
sudo apt-get install -y git curl ufw

if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  sudo usermod -aG docker $USER
fi

echo "2. Configuring Firewall for WebSocket Voice Traffic (Port 4200)..."
sudo ufw allow 22/tcp
sudo ufw allow 4200/tcp
sudo ufw --force enable || true

echo "3. Cloning/Updating Repository..."
if [ ! -d "vaani-si" ]; then
  git clone https://github.com/BitmAura/vaani-si.git
fi
cd vaani-si

echo "4. Building Voice Gateway Docker Container..."
docker build -t vanni-voice-gateway -f apps/voice-gateway/Dockerfile .

echo "5. Running Voice Gateway Container on Port 4200..."
docker stop vanni-voice-gateway 2>/dev/null || true
docker rm vanni-voice-gateway 2>/dev/null || true

docker run -d \
  --name vanni-voice-gateway \
  --restart unless-stopped \
  -p 4200:4200 \
  -e NODE_ENV=production \
  -e PORT=4200 \
  -e SARVAM_API_KEY="${SARVAM_API_KEY}" \
  -e SUPABASE_URL="${SUPABASE_URL:-https://qwmxgqpmcbuvkhrsbibz.supabase.co}" \
  -e SUPABASE_SECRET_KEY="${SUPABASE_SECRET_KEY}" \
  vanni-voice-gateway

echo "=================================================================="
echo "✓ VAANI VOICE GATEWAY IS NOW RUNNING ON AZURE!"
echo "Public WebSocket Endpoint: ws://$(curl -s ifconfig.me):4200/ws/audio-stream"
echo "=================================================================="
