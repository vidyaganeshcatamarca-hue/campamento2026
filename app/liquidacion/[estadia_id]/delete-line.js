const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Eliminar línea 17 (índice 17 en array 0-indexed)
lines.splice(17, 1);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('✅ Línea 18 eliminada');
