const fetchPagos = async () => {
    setLoading(true);
    try {
        // Llamar a la función RPC que hace el JOIN correcto en el servidor
        const { data: pagosData, error: pagosError } = await supabase
            .rpc('get_transferencias_report', {
                fecha_desde: fechaDesde,
                fecha_hasta: fechaHasta
            });

        if (pagosError) {
            console.error("Error fetching pagos:", pagosError);
            throw pagosError;
        }

        if (!pagosData || pagosData.length === 0) {
            setPagos([]);
            return;
        }

        // Los datos ya vienen con el JOIN hecho correctamente
        const pagosEnriquecidos = pagosData.map((pago: any) => ({
            id: pago.pago_id,
            monto_abonado: pago.monto_abonado,
            fecha_pago: pago.fecha_pago,
            metodo_pago: pago.metodo_pago,
            estadia_id: pago.estadia_id,
            responsable_nombre: pago.responsable_nombre,
            responsable_dni: pago.responsable_dni,
            responsable_celular: pago.responsable_celular,
            recibo_emitido: pago.recibo_emitido
        }));

        setPagos(pagosEnriquecidos);

    } catch (error) {
        console.error('Error cargando reporte:', error);
        toast.error('Error al cargar los pagos');
    } finally {
        setLoading(false);
    }
};
