const fs = require('fs');
let content = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/replacement_block.ts', 'utf8');

// Strip TypeScript stuff just for syntax check
content = content.replace(/\(window as any\)/g, 'window');
content = content.replace(/as HTMLInputElement/g, '');
content = content.replace(/as HTMLButtonElement/g, '');
content = content.replace(/as any/g, '');
content = content.replace(/e: Event/g, 'e');

const testCode = 'const html = `' + content + '}';

try {
    const vm = require('vm');
    const script = new vm.Script(testCode);
    console.log('Syntax is OK');
} catch (e) {
    console.error('Syntax error:', e);
}
