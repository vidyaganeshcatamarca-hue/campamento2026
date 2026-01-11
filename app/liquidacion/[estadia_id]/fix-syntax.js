const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Buscar y corregir las llaves duplicadas después de localStorage.removeItem
// El patrón es: }  seguido de otra } en la siguiente línea
content = content.replace(
    /localStorage\.removeItem\(`parcelas_\$\{estadiaId\}`\);\s+\}\s+\}/,
    `localStorage.removeItem(\`parcelas_\${estadiaId}\`);\n            }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Error de sintaxis corregido');
