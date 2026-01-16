const fetchPagos = async () => {
    setLoading(true);
    try {
        // Consulta directa con JOIN - trae todo en una sola query
        const { data: pagosData, error: pagosError } = await supabase
            .from('pagos')
            .select(`
                    id,
                    monto_abonado,
                    fecha_pago,
                    metodo_pago,
                    estadia_id,
                    recibo_emitido,
                    estadias!inner (
                        id,
                        celular_responsable,
                        acampantes (
                            nombre_completo,
                            dni,
                            celular,
                            es_responsable_pago
                        )
                    )
                `)
            .ilike('metodo_pago', 'transferencia')
            .gte('fecha_pago', fechaDesde + ' 00:00:00')
            .lte('fecha_pago', fechaHasta + ' 23:59:59')
            .order('fecha_pago', { ascending: false });

        if (pagosError) {
            console.error("Error fetching pagos:", pagosError);
            throw pagosError;
        }

        if (!pagosData || pagosData.length === 0) {
            setPagos([]);
            return;
        }

        console.log("Pagos fetched with JOIN:", pagosData.length);

        // Procesar los datos del JOIN
        const pagosEnriquecidos = pagosData.map((pago: any) => {
            let nombre = 'Desconocido';
            let dni = '-';
            let celular = '-';

            // Extraer datos del JOIN
            const estadia = pago.estadias;
            if (estadia && estadia.acampantes && estadia.acampantes.length > 0) {
                // Buscar el responsable de pago primero
                const responsable = estadia.acampantes.find((a: any) => a.es_responsable_pago);
                const candidato = responsable || estadia.acampantes[0];

                nombre = candidato.nombre_completo || 'Sin Nombre';
                dni = candidato.dni || '-';
                celular = candidato.celular || estadia.celular_responsable || '-';
            } else if (estadia) {
                // Fallback al celular de la estadía
                celular = estadia.celular_responsable || '-';
            }

            return {
                id: pago.id,
                monto_abonado: pago.monto_abonado,
                fecha_pago: pago.fecha_pago,
                metodo_pago: pago.metodo_pago,
                estadia_id: pago.estadia_id,
                responsable_nombre: nombre,
                responsable_dni: dni,
                responsable_celular: celular,
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
