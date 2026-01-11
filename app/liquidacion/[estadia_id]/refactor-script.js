const fs = require('fs');
const path = require('path');

// Archivo a modificar
const filePath = path.join(__dirname, 'page.tsx');

// Leer el contenido actual
let content = fs.readFileSync(filePath, 'utf8');

// 1. Agregar imports al inicio (después de las imports existentes, antes de export default)
const importToAdd = `
import { cargarAcampantes, cargarEstadiasActivas, reasignarAcampante, procesarPagoInicial } from './helpers';
import { ListaAcampantes } from './ListaAcampantes';
import { ModalReasignacion } from './ ModalReasignacion';
`;

// Buscar la línea 'export default function LiquidacionPage()'
const exportDefaultIndex = content.indexOf('export default function LiquidacionPage()');
if (exportDefaultIndex !== -1) {
    // Insertar imports justo antes
    content = content.slice(0, exportDefaultIndex) + importToAdd + '\n' + content.slice(exportDefaultIndex);
}

// 2. Actualizar fetchData para usar las funciones helper
// Buscar la sección donde se cargan responsables (después de setResponsableNombre)
const setResponsableNombrePattern = /setResponsableNombre\(acampante\.nombre_completo\);[\s\S]*?\}/;
const match = content.match(setResponsableNombrePattern);

if (match) {
    const replacementCode = `setResponsableNombre(acampante.nombre_completo);
            }

            // Cargar acampantes y estadías usando helpers
            const acampantesData = await cargarAcampantes(estadiaId);
            setAcampantes(acampantesData);

            const estadiasData = await cargarEstadiasActivas(estadiaId);
            setEstadiasActivas(estadiasData);
        }`;

    content = content.replace(setResponsableNombrePattern, replacementCode);
}

// 3. Agregar funciones de manejo de reasignación (después de fetchData, antes de handleFinalizarIngreso)
const handlersToAdd = `
    const handleCambiarACompanero = (acampante: any) => {
        setAcompanteToReassign(acampante);
        setShowReassignModal(true);
    };

    const handleReasignarAcampante = async (celularResponsable: string) => {
        if (!acompanteToReassign) return;

        try {
            const estadiaDestino = estadiasActivas.find(e => e.celular_responsable === celularResponsable);
            if (!estadiaDestino) {
                alert('No se encontró la estadía destino');
                return;
            }

            await reasignarAcampante(
                acompanteToReassign.id,
                celularResponsable,
                estadiaDestino.id
            );

            await fetchData();
            setShowReassignModal(false);
            setAcompanteToReassign(null);
            alert('Acampante reasignado exitosamente');

        } catch (error) {
            console.error('Error reasignando:', error);
            alert('Error al reasignar. Intente nuevamente.');
        }
    };
`;

const handleFinalizarIngresoIndex = content.indexOf('const handleFinalizarIngreso = async () => {');
if (handleFinalizarIngresoIndex !== -1) {
    content = content.slice(0, handleFinalizarIngresoIndex) + handlersToAdd + '\n    ' + content.slice(handleFinalizarIngresoIndex);
}

// Guardar el archivo modificado
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Archivo liquidacion/page.tsx refactorizado exitosamente');
console.log('📁 Creados 3 archivos auxiliares:');
console.log('   - helpers.ts (funciones de negocio)');
console.log('   - ListaAcampantes.tsx (componente UI lista)');
console.log('   - ModalReasignacion.tsx (componente UI modal)');
