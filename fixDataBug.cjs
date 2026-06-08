const fs = require('fs');
let code = fs.readFileSync('src/components/ReportTemplate.ts', 'utf8');

code = code.replace(
    /if \(item\.advancedData && item\.advancedData\.length > 0\) \{/g,
    "if (item.measurementConfig && item.measurementConfig.type !== 'standard' && item.measurementValues && item.measurementValues.length > 0) {"
);

code = code.replace(
    /const vals = item\.advancedData;/g,
    "const vals = item.measurementValues;"
);

fs.writeFileSync('src/components/ReportTemplate.ts', code, 'utf8');
console.log('Fixed ReportTemplate');
