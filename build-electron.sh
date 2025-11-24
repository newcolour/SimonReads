#!/bin/bash

# Build electron TypeScript files
npx tsc -p electron/tsconfig.json

# Fix require paths in emailService.js to point to ./src/ subdirectory
if [ -f "dist-electron/emailService.js" ]; then
    # macOS sed syntax
    sed -i '' 's/require("\.\/types")/require(".\/src\/types")/g' dist-electron/emailService.js
    sed -i '' 's/require("\.\/summaryService")/require(".\/src\/summaryService")/g' dist-electron/emailService.js
    sed -i '' 's/require("\.\/pdfService")/require(".\/src\/pdfService")/g' dist-electron/emailService.js
    echo "✓ Fixed require paths in emailService.js"
fi
