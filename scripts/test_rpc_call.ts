
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log('Testing get_transferencias_report_v2...');

    // Use a wide date range to catch everything
    const params = {
        fecha_desde: '2026-01-01T00:00:00',
        fecha_hasta: '2026-12-31T23:59:59'
    };

    console.log('Params:', params);

    const { data, error } = await supabase.rpc('get_transferencias_report_v2', params);

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log(`Success! Found ${data?.length || 0} records.`);
        if (data && data.length > 0) {
            console.log('First 3 records:', data.slice(0, 3));

            // Check specific logic issues
            const pending = data.filter((d: any) => d.recibo_emitido === false);
            console.log(`Pending receipts (recibo_emitido === false): ${pending.length}`);
        }
    }
}

testRpc();
