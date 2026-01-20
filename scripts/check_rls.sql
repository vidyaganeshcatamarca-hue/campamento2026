-- DIAGNOSTICO: RLS Policies
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'tarifas_historial';

SELECT * FROM pg_policies WHERE tablename = 'tarifas_historial';

-- Check if we can read as anon/authenticated (simulated by just running select here, assuming user runs this in dashboard)
SELECT count(*) as count_tarifas FROM tarifas_historial;
