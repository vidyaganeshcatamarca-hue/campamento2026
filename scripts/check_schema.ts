
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking schema...');

    // Try to select the column
    const { data, error } = await supabase
        .from('estadias')
        .select('recursos_extra')
        .limit(1);

    if (error) {
        console.error('Error selecting column:', error.message);
        if (error.message.includes('does not exist') || error.message.includes('column')) {
            console.log('CONCLUSION: Column likely missing.');
        }
    } else {
        console.log('Success! Column exists.');
    }
}

checkSchema();
