const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Buscar donde está "Descuento y Pago" y agregar ParcelaSelector justo antes
const targetString = '{/* Descuento y Pago */}';
const parcelaSelectorComponent = `                {/* Selector de Parcelas */}
                <ParcelaSelector
                    estadiaId={estadiaId}
                    cantParcelas={vistaEstadia.cant_parcelas_total || 1}
                    onParcelasSeleccionadas={handleParcelasSeleccionadas}
                />

                `;

const index = content.indexOf(targetString);
if (index !== -1) {
    content = content.slice(0, index) + parcelaSelectorComponent + content.slice(index);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ ParcelaSelector agregado a liquidación');
} else {
    console.log('❌ No se encontró la ubicación');
}
