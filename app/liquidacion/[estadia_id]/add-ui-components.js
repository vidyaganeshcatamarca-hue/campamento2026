const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Buscar el cierre de</div> antes de </Layout>
const layoutClosePattern = /(\s+)<\/div>\s+<\/Layout>/;

const componentsToAdd = `
                
                {/* Lista de Acampantes */}
                <ListaAcampantes 
                    acampantes={acampantes}
                    onCambiarACompanero={handleCambiarACompanero}
                />

                {/* Modal de Reasignación */}
                <ModalReasignacion
                    isOpen={showReassignModal}
                    acompante={acompanteToReassign}
                    estadiasActivas={estadiasActivas}
                    onClose={() => setShowReassignModal(false)}
                    onReasignar={handleReasignarAcampante}
                />
            </div>
        </Layout>`;

content = content.replace(layoutClosePattern, componentsToAdd);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Componentes UI agregados exitosamente');
