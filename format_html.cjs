const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/extracted_html2.txt', 'utf8');

// The string starts with `return \``
// Wait, we can just find the first `<div` and the last `</div>` inside the backticks.
const startIdx = text.indexOf('<div class="zoom-tablet"');
if (startIdx !== -1) {
    // We want the whole modal part too. Let's find the first `<style>` or `<div id="image-preview-modal"`
    const realStart = text.indexOf('<style>');
    // Let's find the end. It's right before `\`;};const ` or something similar.
    let endIdx = text.lastIndexOf('</div>');
    const result = text.substring(realStart !== -1 ? realStart : startIdx, endIdx + 6);
    fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/pure_html.txt', result);
    console.log('Cleaned HTML saved.');
} else {
    console.log('Could not find start.');
}
