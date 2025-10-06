#!/bin/bash

# Test script for semantic CV search
echo "🔍 Testing Semantic CV Search System"
echo "===================================="
echo ""

API_URL="http://localhost:3001/api/search"

echo "Test 1: Show me top 5 mobile developers"
echo "----------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"Show me top 5 mobile developers"}' | \
  jq -r '.candidates[] | "  \(.rank). \(.profile_type) (\(.language)) - Score: \(.score | . * 100 | floor)%"'

echo ""
echo "Test 2: Find iOS specialists"
echo "----------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"Find iOS specialists"}' | \
  jq -r '.candidates[] | "  \(.rank). \(.profile_type) (\(.language)) - Score: \(.score | . * 100 | floor)%"'

echo ""
echo "Test 3: Backend developers with API experience"
echo "----------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"Backend developers with API experience"}' | \
  jq -r '.candidates[] | "  \(.rank). \(.profile_type) (\(.language)) - Score: \(.score | . * 100 | floor)%"'

echo ""
echo "Test 4: mobile app developers (without 'top N')"
echo "-----------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"mobile app developers"}' | \
  jq -r '.candidates[] | "  \(.rank). \(.profile_type) (\(.language)) - Score: \(.score | . * 100 | floor)%"'

echo ""
echo "✅ Testing complete!"