const fetchPagos = async () => {
    setLoading(true);
    try {
        // Implementación exacta del SQL requerido:
        // SELECT p.*, a.nombre_completo, a.dni, a.celular
        // FROM pagos p
        // INNER JOIN estadias e ON p.estadia_id = e.id
        // LEFT JOIN acampantes a ON e.id = a.estadia_id AND a.es_responsable_pago = true

        // Paso 1: Obtener pagos con filtro de transferencia y fechas
        const { data: pagosData, error: pagosError } = await supabase
            .from('pagos')
            .select('id, monto_abonado, fecha_pago, metodo_pago, estadia_id, recibo_emitido')
            .ilike('metodo_pago', 'transferencia')
            .gte('fecha_pago', fechaDesde + ' 12:00:00')
            .lte('fecha_pago', fechaHasta + ' 12:00:00')
            .order('fecha_pago', { ascending: false });

        if (pagosError) {
            console.error("Error fetching pagos:", pagosError);
            throw pagosError;
        }

        if (!pagosData || pagosData.length === 0) {
            setPagos([]);
            return;
        }

        console.log("Pagos fetched:", pagosData.length);

        // Paso 2: Obtener estadias IDs únicos (INNER JOIN)
        const estadiaIds = [...new Set(pagosData.map(p => p.estadia_id).filter(Boolean))];

        // Paso 3: Obtener acampantes responsables (LEFT JOIN con filtro es_responsable_pago = true)
        const { data: acampantesData } = await supabase
            .from('acampantes')
            .select('estadia_id, nombre_completo, dni, celular')
            .in('estadia_id', estadiaIds)
            .eq('es_responsable_pago', true);

        // Paso 4: Crear mapa de acampantes por estadia_id
        const acampantesMap = new Map();
        (acampantesData || []).forEach(a => {
            acampantesMap.set(a.estadia_id, a);
        });

        // Paso 5: Enriquecer pagos con datos de acampantes (LEFT JOIN result)
        const pagosEnriquecidos = pagosData.map((pago: any) => {
            const acampante = acampantesMap.get(pago.estadia_id);

            return {
                id: pago.id,
                monto_abonado: pago.monto_abonado,
                fecha_pago: pago.fecha_pago,
                metodo_pago: pago.metodo_pago,
                estadia_id: pago.estadia_id,
                responsable_nombre: acampante?.nombre_completo || 'Desconocido',
                responsable_dni: acampante?.dni || '-',
                responsable_celular: acampante?.celular || '-',
                recibo_emitido: pago.recibo_emitido || false
            };
        });

        setPagos(pagosEnriquecidos);

    } catch (error) {
        console.error('Error cargando reporte:', error);
        toast.error('Error al cargar los pagos');
    } finally {
        setLoading(false);
    }
};
