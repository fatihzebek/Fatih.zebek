import * as fs from 'fs';
const html = fs.readFileSync('src/components/ReportTemplate.ts', 'utf-8');
let depth = 0;
const regex = /<\/?div/g;
let match;
while((match = regex.exec(html)) !== null) {
  if(match[0] === '<div') depth++;
  else if(match[0] === '</div') depth--;
  console.log('Depth at', match.index, 'is', depth, match[0]);
}
