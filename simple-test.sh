#!/bin/bash

echo "🔍 Simple CV Search Test"
echo "========================"
echo ""

API_URL="http://localhost:3001/api/search"

echo "Test 1: Display mobile developer names"
echo "---------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"iOS Android Flutter React Native mobile app developers"}' | \
  jq -r '.results[] | "\(.rank). \(.name) - \(.role) (\(.language))"'

echo ""
echo "Test 2: Top 5 iOS developers"
echo "-----------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"top 5 iOS Swift developers"}' | \
  jq -r '.results[] | "\(.rank). \(.name) - \(.role)"'

echo ""
echo "Test 3: Android developers"
echo "--------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"Android Kotlin developers"}' | \
  jq -r '.results[] | "\(.rank). \(.name) - \(.role)"'

echo ""
echo "✅ Test complete!"