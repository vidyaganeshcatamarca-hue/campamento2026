import { supabase } from '@/lib/supabase';

async function inspect() {
    console.log('Inspecting acampantes table...');
    const { data, error } = await supabase.from('acampantes').select('*').limit(1);
    if (error) console.error(error);
    else console.log('Keys:', data && data.length > 0 ? Object.keys(data[0]) : 'Table empty');
}

inspect();
