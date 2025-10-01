// Simple test script to verify tool calling functionality
const { detectToolsFromQuery, getToolSuggestions } = require('./src/lib/tools/index.ts');

console.log('Testing tool detection...\n');

const testQueries = [
  "What's the weather in London?",
  "Latest news about AI",
  "Apple stock price",
  "What time is it in Tokyo?",
  "Calculate 2 + 2"
];

testQueries.forEach(query => {
  console.log(`Query: "${query}"`);
  try {
    const detected = detectToolsFromQuery(query);
    const suggestions = getToolSuggestions(query);

    console.log(`  Detected tools: ${detected.join(', ')}`);
    console.log(`  Suggestions: ${suggestions.map(s => `${s.tool} (${s.confidence})`).join(', ')}`);
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
  console.log('');
});

console.log('Tool detection test completed!');