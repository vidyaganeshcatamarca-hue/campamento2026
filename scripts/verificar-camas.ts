import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verificarCamas() {
    console.log('=== VERIFICANDO PARCELAS (incluyendo camas) ===\n');

    const { data: parcelas, error: parcelasError } = await supabase
        .from('parcelas')
        .select('*')
        .order('nombre_parcela');

    if (parcelasError) {
        console.error('Error:', parcelasError);
    } else {
        console.log('Total parcelas:', parcelas.length);
        console.log('\nParcelas tipo "Cama":');
        const camas = parcelas.filter(p => p.nombre_parcela.toLowerCase().includes('cama'));
        console.table(camas);

        console.log('\nTodas las parcelas:');
        console.table(parcelas.map(p => ({
            id: p.id,
            nombre: p.nombre_parcela,
            estado: p.estado,
            estadia_id: p.estadia_id
        })));
    }

    console.log('\n=== VERIFICANDO COSTOS ===\n');

    const { data: costos, error: costosError } = await supabase
        .from('precios_config')
        .select('*')
        .order('clave');

    if (costosError) {
        console.error('Error:', costosError);
    } else {
        console.table(costos);
    }
}

verificarCamas().catch(console.error);
