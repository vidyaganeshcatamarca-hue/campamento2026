const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Eliminar componentes JSX que no existen
content = content.replace(/<ListaAcampantes[\s\S]*?\/>/g, '');
content = content.replace(/<ModalReasignacion[\s\S]*?\/>/g, '');

// También eliminar versiones sin self-closing
content = content.replace(/<ListaAcampantes[\s\S]*?<\/ListaAcampantes>/g, '');
content = content.replace(/<ModalReasignacion[\s\S]*?<\/ModalReasignacion>/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Componentes JSX no existentes eliminados');
