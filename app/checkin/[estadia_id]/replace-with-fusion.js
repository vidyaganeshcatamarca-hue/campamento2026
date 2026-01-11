const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Reemplazar import de RecursosEditor por FusionEstadiasSelector
content = content.replace(
    "import { RecursosEditor } from '@/components/checkin/RecursosEditor';",
    "import { FusionEstadiasSelector } from '@/components/checkin/FusionEstadiasSelector';"
);

// 2. Reemplazar uso de RecursosEditor por FusionEstadiasSelector
const recursosEditorPattern = /<RecursosEditor[\s\S]*?\/>/;
const replacement = `<FusionEstadiasSelector
                    estadiaActual={{
                        id: estadiaId,
                        celular_responsable: estadia.celular_responsable || '',
                        cant_personas_total: estadia.cant_personas_total || 1,
                        cant_parcelas_total: estadia.cant_parcelas_total || 1,
                        cant_sillas_total: estadia.cant_sillas_total || 0,
                        cant_mesas_total: estadia.cant_mesas_total || 0,
                        tipo_vehiculo: estadia.tipo_vehiculo || 'ninguno',
                        acampantes: acampante ? [{
                            id: acampante.id,
                            nombre_completo: acampante.nombre_completo,
                            celular: acampante.celular,
                            es_responsable_pago: acampante.es_responsable_pago
                        }] : []
                    }}
                    onFusionCompleta={fetchData}
                />`;

content = content.replace(recursosEditorPattern, replacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ FusionEstadiasSelector integrado en check-in');
