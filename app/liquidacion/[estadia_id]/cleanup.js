const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Limpiar posibles problemas de sintaxis
// 1. Eliminar llaves duplicadas
content = content.replace(/}\s+}\s+\/\/ 4\. Calcular nuevo saldo/g, '}\n\n            // 4. Calcular nuevo saldo');

// 2. Normalizar saltos de línea
content = content.replace(/\r\n/g, '\n');

// 3. Eliminar espacios en blanco extra antes de las llaves de cierre
content = content.split('\n').map(line => {
    // No modificar strings o comentarios
    if (line.trim().startsWith('//') || line.includes('"') || line.includes("'")) {
        return line;
    }
    return line;
}).join('\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Archivo limpiado y normalizado');
