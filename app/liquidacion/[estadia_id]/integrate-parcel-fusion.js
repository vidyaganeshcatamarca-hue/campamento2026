const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Agregar imports
const importsToAdd = `
import { ParcelaSelector } from '@/components/liquidacion/ParcelaSelector';
import { asignarParcelas, FusionInfo } from '@/lib/estadias-fusion';
`;

const existingImports = content.indexOf("from '@/lib/utils';");
if (existingImports !== -1) {
    const afterImports = content.indexOf('\n', existingImports);
    content = content.slice(0, afterImports + 1) + importsToAdd + content.slice(afterImports + 1);
}

// 2. Agregar estado para fusión
const stateSection = content.indexOf('const [fechaPromesa, setFechaPromesa]');
if (stateSection !== -1) {
    const afterState = content.indexOf('\n', stateSection);
    content = content.slice(0, afterState + 1) +
        '    const [fusionInfo, setFusionInfo] = useState<FusionInfo | undefined>();\n' +
        content.slice(afterState + 1);
}

// 3. Agregar función de manejo de parcelas
const handleFinalizarIndex = content.indexOf('const handleFinalizarIngreso = async () => {');
if (handleFinalizarIndex !== -1) {
    const functionToAdd = `
    const handleParcelasSeleccionadas = async (parcelaIds: number[], fusion?: FusionInfo) => {
        setFusionInfo(fusion);
        // Las parcelas se asignarán en handleFinalizarIngreso
        if (fusion?.debeFusionar) {
            alert(\`Se fusionará con la estadía de \${fusion.responsableNombre}. Los recursos se sumarán automáticamente.\`);
        }
        // Guardar en localStorage temporalmente
        localStorage.setItem(\`parcelas_\${estadiaId}\`, JSON.stringify(parcelaIds));
    };

    `;
    content = content.slice(0, handleFinalizarIndex) + functionToAdd + content.slice(handleFinalizarIndex);
}

// 4. Actualizar handleFinalizarIngreso para usar asignarParcelas
// Buscar la sección donde se asignan parcelas manualmente y reemplazarla
const parcelasSection = /\/\/ \d\. Asignar parcelas[\s\S]*?localStorage\.removeItem\(`parcelas_\$\{estadiaId\}`\);/;
if (parcelasSection.test(content)) {
    const replacement = `// 3. Asignar parcelas (con fusión si es necesario)
            const parcelasSeleccionadasStr = localStorage.getItem(\`parcelas_\${estadiaId}\`);
            if (parcelasSeleccionadasStr) {
                const parcelasSeleccionadas = JSON.parse(parcelasSeleccionadasStr);
                
                const result = await asignarParcelas(estadiaId, parcelasSeleccionadas, fusionInfo);
                
                if (!result.success) {
                    throw new Error(result.error || 'Error asignando parcelas');
                }

                if (result.fusionada) {
                    // Si se fusionó, redirigir a recepción directamente
                    alert('✅ Estadías fusionadas y pago registrado exitosamente');
                    localStorage.removeItem(\`parcelas_\${estadiaId}\`);
                    router.push('/recepcion');
                    return;
                }
                
                localStorage.removeItem(\`parcelas_\${estadiaId}\`);
            }`;

    content = content.replace(parcelasSection, replacement);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ ParcelaSelector con fusión integrado en liquidación');
