const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Eliminar import de FusionEstadiasSelector
content = content.replace(/import { FusionEstadiasSelector } from '@\/components\/checkin\/FusionEstadiasSelector';?\r?\n?/g, '');

// Eliminar uso del componente (buscar el JSX)
content = content.replace(/<FusionEstadiasSelector[\s\S]*?\/>/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ FusionEstadiasSelector eliminado de check-in');
