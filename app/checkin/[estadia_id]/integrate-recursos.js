const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Agregar import
const importLine = "import { RecursosEditor } from '@/components/checkin/RecursosEditor';";
const lucideImportIndex = content.indexOf("from 'lucide-react';");
if (lucideImportIndex !== -1) {
    const afterLucide = content.indexOf('\n', lucideImportIndex);
    content = content.slice(0, afterLucide + 1) + importLine + '\n' + content.slice(afterLucide + 1);
}

// 2. Agregar componente RecursosEditor antes de "Sección 1: Datos del Acampante" o similar
const seccion1Pattern = /{\/\* Sección 1: Datos/;
const match = content.search(seccion1Pattern);

if (match !== -1) {
    const componentToAdd = `
                {/* Editor de Recursos */}
                <RecursosEditor
                    estadiaId={estadiaId}
                    recursos={{
                        cant_parcelas_total: estadia.cant_parcelas_total || 1,
                        cant_sillas_total: estadia.cant_sillas_total || 0,
                        cant_mesas_total: estadia.cant_mesas_total || 0,
                        tipo_vehiculo: estadia.tipo_vehiculo || 'ninguno'
                    }}
                    cantPersonas={estadia.cant_personas_total || 1}
                    onActualizar={fetchData}
                />

                `;

    content = content.slice(0, match) + componentToAdd + content.slice(match);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ RecursosEditor integrado en check-in');
