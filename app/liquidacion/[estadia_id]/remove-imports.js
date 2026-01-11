const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Eliminar las líneas con imports inválidos
content = content.replace(/import { ListaAcampantes } from '\.\/ListaAcampantes';?\n?/g, '');
content = content.replace(/import { ModalReasignacion } from '\. ModalReasignacion';?\n?/g, '');
content = content.replace(/import { ModalReasignacion } from '\.\/ModalReasignacion';?\n?/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Imports inválidos eliminados');
