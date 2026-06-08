const fs = require('fs');
let code = fs.readFileSync('src/pages/Tasks.ts', 'utf8');

// Use regex to carefully remove the debugHtml definition and usage
code = code.replace(
    /const debugHtml = `[\s\S]*?`;/,
    ''
);
code = code.replace(
    /container\.innerHTML = debugHtml \+ renderTasksTable\(sorted, userRole\);/,
    'container.innerHTML = renderTasksTable(sorted, userRole);'
);
code = code.replace(
    /\/\/ Async fetch total reports for debugging[\s\S]*?\}\);[\s\S]*?\}\);[\s\S]*?\}\);/,
    ''
);

fs.writeFileSync('src/pages/Tasks.ts', code, 'utf8');
