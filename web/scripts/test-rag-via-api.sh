#!/bin/bash

# RAG Pipeline End-to-End Test via API
# Tests the complete RAG flow by simulating LINE webhook calls
#
# Prerequisites:
# 1. Deploy to Vercel or run locally with `npm run dev`
# 2. Have at least one tenant and channel account in the database
#
# Usage:
#   bash scripts/test-rag-via-api.sh

set -e

# Configuration
BASE_URL="${BASE_URL:-https://csflow.vercel.app}"
LINE_WEBHOOK_URL="$BASE_URL/api/webhooks/line"

# Test data (replace with actual values from your database)
CHANNEL_ID="2008754781"  # LINE Channel ID from .env
CHANNEL_SECRET="4d6ed56d04080afca0d60e42464ec49b"  # LINE Channel Secret
USER_ID="U1234567890abcdef"  # Test LINE user ID
REPLY_TOKEN="test-reply-token-$(date +%s)"  # Simulated reply token

echo ""
echo "🧪 ═══════════════════════════════════════════════════════════"
echo "📊 RAG Pipeline End-to-End Test (via API)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📍 Target: $BASE_URL"
echo ""

# Helper function to send LINE message webhook
send_line_message() {
  local message_text="$1"
  local test_name="$2"

  echo "🧪 $test_name"
  echo "───────────────────────────────────────"
  echo "📝 Query: \"$message_text\""
  echo ""

  # Create LINE webhook payload
  local payload=$(cat <<EOF
{
  "events": [
    {
      "type": "message",
      "replyToken": "$REPLY_TOKEN",
      "source": {
        "userId": "$USER_ID",
        "type": "user"
      },
      "timestamp": $(date +%s)000,
      "message": {
        "type": "text",
        "id": "test-msg-$(date +%s)",
        "text": "$message_text"
      }
    }
  ],
  "destination": "$CHANNEL_ID"
}
EOF
)

  # Send webhook
  echo "📤 Sending LINE webhook..."
  response=$(curl -s -X POST "$LINE_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-line-signature: test-signature" \
    -d "$payload" \
    -w "\n%{http_code}")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    echo "✅ Webhook processed successfully (HTTP 200)"
  else
    echo "❌ Webhook failed (HTTP $http_code)"
    echo "Response: $body"
  fi

  echo ""
  echo "⏳ Waiting 3 seconds for RAG processing..."
  sleep 3
  echo ""
}

# ──────────────────────────────────────────────────────────────────
# Test 1: Knowledge Base Query (should auto-respond)
# ──────────────────────────────────────────────────────────────────
send_line_message "라식 수술 가격이 얼마인가요?" "Test 1: Knowledge Base Query (FAQ)"

# ──────────────────────────────────────────────────────────────────
# Test 2: Missing Knowledge (should escalate with KB recommendation)
# ──────────────────────────────────────────────────────────────────
send_line_message "스마일라식 회복 기간은 얼마나 걸리나요?" "Test 2: Missing Knowledge (should escalate)"

# ──────────────────────────────────────────────────────────────────
# Test 3: Tenant Info Query (should escalate with tenant_info recommendation)
# ──────────────────────────────────────────────────────────────────
send_line_message "영업 시간이 언제인가요?" "Test 3: Tenant Info Query (operational info)"

# ──────────────────────────────────────────────────────────────────
# Check escalations via API
# ──────────────────────────────────────────────────────────────────
echo "🧪 Verification: Check Escalations API"
echo "───────────────────────────────────────"
echo "📡 Fetching escalations from API..."
echo ""

escalations_response=$(curl -s "$BASE_URL/api/escalations")
escalations_count=$(echo "$escalations_response" | grep -o '"id"' | wc -l | tr -d ' ')

echo "✅ Found $escalations_count escalations in the system"
echo ""

# Pretty print the last 3 escalations (if jq is available)
if command -v jq &> /dev/null; then
  echo "📊 Recent Escalations:"
  echo "$escalations_response" | jq -r '.escalations[:3] | .[] | "  ID: \(.id)\n  Customer: \(.customer.name)\n  Question: \(.customerQuestion)\n  AI Reasoning: \(.aiReasoning)\n  Recommended Action: \(.recommendedAction // "N/A")\n  Missing Info: \(.missingInfo // [] | join(", "))\n  Status: \(.status)\n  ---"'
else
  echo "💡 Tip: Install 'jq' to see pretty-printed JSON output"
fi

echo ""
echo "📊 ═══════════════════════════════════════════════════════════"
echo "🏁 Test Complete"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ Next Steps:"
echo "   1. Check escalations page: $BASE_URL/escalations"
echo "   2. Verify customer questions are showing correctly"
echo "   3. Check AI recommendations (KB vs Tenant DB)"
echo "   4. Update KB via the UI and re-test with same questions"
echo ""
