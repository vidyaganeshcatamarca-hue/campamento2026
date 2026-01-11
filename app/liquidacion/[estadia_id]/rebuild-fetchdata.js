const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Buscar y reemplazar toda la función fetchData que está corrupta
const fetchDataStart = content.indexOf('const fetchData = async () => {');
const fetchDataEnd = content.indexOf('};', fetchDataStart) + 2;

if (fetchDataStart === -1 || fetchDataEnd === -1) {
    console.log('❌ No se encontró fetchData');
    process.exit(1);
}

const newFetchData = `const fetchData = async () => {
        try {
            // Cargar vista calculada
            const { data, error } = await supabase
                .from('vista_estadias_con_totales')
                .select('*')
                .eq('id', estadiaId)
                .single();

            if (error) throw error;
            setVistaEstadia(data);

            // Cargar nombre del responsable
            const { data: acampante } = await supabase
                .from('acampantes')
                .select('nombre_completo')
                .eq('estadia_id', estadiaId)
                .eq('es_responsable_pago', true)
                .single();

            if (acampante) {
                setResponsableNombre(acampante.nombre_completo);
            }

            // Cargar acampantes
            const acampantesData = await cargarAcampantes(estadiaId);
            setAcampantes(acampantesData);

            // Cargar estadías activas
            const estadiasData = await cargarEstadiasActivas(estadiaId);
            setEstadiasActivas(estadiasData);

        } catch (error) {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar datos financieros.');
            router.push('/recepcion');
        } finally {
            setLoading(false);
        }
    };`;

content = content.substring(0, fetchDataStart) + newFetchData + content.substring(fetchDataEnd);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ fetchData reconstruida correctamente');
