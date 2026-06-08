const fs = require('fs');
let t = fs.readFileSync('found_recon.txt', 'utf8');
let idx = t.indexOf('"name": "write_to_file"');
if (idx === -1) idx = t.indexOf('"name":"write_to_file"');
if (idx !== -1) {
    console.log(t.substring(Math.max(0, idx - 200), idx + 2000));
} else {
    console.log('No write_to_file found in found_recon.txt');
}
