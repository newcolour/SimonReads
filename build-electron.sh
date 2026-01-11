#!/bin/bash

# Build electron TypeScript files
npx tsc -p electron/tsconfig.json

# Fix require paths in emailService.js to point to ../src/ subdirectory
if [ -f "dist-electron/electron/emailService.js" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's/require("\.\/src\/types")/require("..\/src\/types")/g' dist-electron/electron/emailService.js
        sed -i '' 's/require("\.\/src\/summaryService")/require("..\/src\/summaryService")/g' dist-electron/electron/emailService.js
        sed -i '' 's/require("\.\/src\/pdfService")/require("..\/src\/pdfService")/g' dist-electron/electron/emailService.js
    else
        # Linux/Other
        sed -i 's/require("\.\/src\/types")/require("..\/src\/types")/g' dist-electron/electron/emailService.js
        sed -i 's/require("\.\/src\/summaryService")/require("..\/src\/summaryService")/g' dist-electron/electron/emailService.js
        sed -i 's/require("\.\/src\/pdfService")/require("..\/src\/pdfService")/g' dist-electron/electron/emailService.js
    fi
    echo "✓ Fixed require paths in emailService.js"
fi
