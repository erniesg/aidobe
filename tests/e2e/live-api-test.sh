#!/bin/bash

# Live API integration test for aidobe
# Requires running dev server: npm run dev
# Set PASSWORD environment variable: export PASSWORD="your-password"
API_URL="http://localhost:8787"
PASSWORD="${PASSWORD:-}"

if [ -z "$PASSWORD" ]; then
  echo "Error: PASSWORD environment variable not set"
  echo "Usage: export PASSWORD='your-password' && ./live-api-test.sh"
  exit 1
fi

echo "Live API Integration Test"
echo "========================="
echo "Testing against: $API_URL"
echo "Ensure dev server is running: npm run dev"
echo ""

echo "Testing aidobe API endpoints..."
echo "================================"

# Test root endpoint
echo -e "\n1. Testing root endpoint (no auth required):"
curl -s $API_URL | jq .

# Test authentication failure
echo -e "\n2. Testing authentication (should fail without token):"
curl -s -X POST $API_URL/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}' | jq .

# Test image generation with OpenAI
echo -e "\n3. Testing image generation with OpenAI:"
curl -s -X POST $API_URL/api/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PASSWORD" \
  -d '{
    "prompt": "A cute robot holding a sign that says Hello Aidobe",
    "enhance": true,
    "provider": "openai",
    "parameters": {
      "size": "1024x1024",
      "quality": "standard"
    }
  }' | jq .

# Test prompt enhancement
echo -e "\n4. Testing prompt enhancement:"
curl -s -X POST $API_URL/api/prompts/enhance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PASSWORD" \
  -d '{
    "prompt": "a sunset",
    "style": "photorealistic"
  }' | jq .

# Test prompt history
echo -e "\n5. Testing prompt history:"
curl -s -X GET "$API_URL/api/prompts/history?limit=10" \
  -H "Authorization: Bearer $PASSWORD" | jq .

echo -e "\nAPI tests completed!"