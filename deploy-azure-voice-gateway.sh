# ==============================================================================
# Deploy VANNI SI Voice Gateway to Microsoft Azure Container Apps
# (Uses Microsoft Azure Student Credits)
# ==============================================================================

# Variables
RESOURCE_GROUP="rg-vanni-si"
LOCATION="centralindia"
ACR_NAME="acrvannisi$RANDOM"
ENV_NAME="env-vanni-si"
APP_NAME="vanni-voice-gateway"

echo "1. Creating Azure Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "2. Creating Azure Container Registry..."
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

echo "3. Building & Pushing Voice Gateway Image to ACR..."
az acr build --registry $ACR_NAME --image vanni-voice-gateway:latest -f apps/voice-gateway/Dockerfile .

echo "4. Creating Container Apps Environment..."
az containerapp env create --name $ENV_NAME --resource-group $RESOURCE_GROUP --location $LOCATION

echo "5. Deploying Container App with WebSocket Support..."
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv)

az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENV_NAME \
  --image "$ACR_SERVER/vanni-voice-gateway:latest" \
  --target-port 4200 \
  --ingress external \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_NAME \
  --registry-password $ACR_PASSWORD \
  --query properties.configuration.ingress.fqdn

echo "=================================================================="
echo "DEPLOYMENT COMPLETE!"
echo "Copy the FQDN URL printed above and set VOICE_WS_URL in Vercel:"
echo "VOICE_WS_URL=wss://<YOUR-FQDN>/ws/audio-stream"
echo "=================================================================="
