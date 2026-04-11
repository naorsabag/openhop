#!/bin/bash
# FlowScope status check — run before creating/updating flows
# Reports what's working and what needs fixing

STATUS="ok"
ISSUES=""

# Check API server
if curl -s http://localhost:8787/api/flows > /dev/null 2>&1; then
  echo "✓ API server running on :8787"
else
  echo "✗ API server not running"
  ISSUES="$ISSUES\n- Start the API server: cd <flowscope-dir> && npx tsx packages/server/src/index.ts"
  STATUS="error"
fi

# Check frontend
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "✓ Frontend running on :5173"
else
  echo "✗ Frontend not running"
  ISSUES="$ISSUES\n- Start the frontend: cd <flowscope-dir>/packages/web && npm run dev"
  STATUS="error"
fi

# Check if flowscope repo exists in common locations
FOUND=""
for dir in "$HOME/flowscope" "$HOME/dev/flowscope" "$HOME/Documents/dev/flowscope" "./flowscope"; do
  if [ -f "$dir/package.json" ] && grep -q "flowscope" "$dir/package.json" 2>/dev/null; then
    FOUND="$dir"
    break
  fi
done

if [ -n "$FOUND" ]; then
  echo "✓ FlowScope repo found at: $FOUND"

  # Check if deps installed
  if [ -d "$FOUND/node_modules" ]; then
    echo "✓ Dependencies installed"
  else
    echo "✗ Dependencies not installed"
    ISSUES="$ISSUES\n- Run: cd $FOUND && npm install"
    STATUS="error"
  fi
else
  if [ "$STATUS" = "error" ]; then
    echo "✗ FlowScope repo not found"
    ISSUES="$ISSUES\n- Install FlowScope: git clone https://github.com/yourorg/flowscope.git && cd flowscope && npm install"
  fi
fi

# Summary
echo ""
if [ "$STATUS" = "ok" ]; then
  echo "FlowScope is ready. UI at http://localhost:5173"
else
  echo "Issues found. Tell the user to fix:"
  echo -e "$ISSUES"
fi
