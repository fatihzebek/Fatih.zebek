const fs = require('fs');
const content = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/replacement_block.ts', 'utf8');

const testCode = 'const html = `' + content;

try {
    const vm = require('vm');
    const script = new vm.Script(testCode);
    console.log('Syntax is OK');
} catch (e) {
    console.error('Syntax error:', e);
}
