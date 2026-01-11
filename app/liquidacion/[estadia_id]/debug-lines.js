const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Ver exactamente qué hay en las líneas 99-107
const lines = content.split('\n');
console.log('Líneas 99-107:');
for (let i = 98; i < 107; i++) {
    console.log(`${i + 1}: "${lines[i]}"`);
}
