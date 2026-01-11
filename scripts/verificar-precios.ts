// Script para verificar precios en Supabase
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarPrecios() {
    console.log('🔍 Verificando precios en precios_config...\n');

    const { data, error } = await supabase
        .from('precios_config')
        .select('*')
        .order('clave');

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log('📋 Precios configurados:');
    console.log('========================');
    data?.forEach(precio => {
        console.log(`Clave: "${precio.clave}" → Valor: $${precio.valor_por_dia}`);
    });

    // Buscar específicamente la clave de cama/habitación
    console.log('\n🔎 Buscando precio de habitación...');
    const camaKeys = data?.filter(p =>
        p.clave.toLowerCase().includes('cama') ||
        p.clave.toLowerCase().includes('habit')
    );

    if (camaKeys && camaKeys.length > 0) {
        console.log('\n✅ Claves encontradas relacionadas con habitación:');
        camaKeys.forEach(k => {
            console.log(`   "${k.clave}" = $${k.valor_por_dia}`);
        });
    } else {
        console.log('\n⚠️ NO se encontró ninguna clave con "cama" o "habitacion"');
    }
}

verificarPrecios();
