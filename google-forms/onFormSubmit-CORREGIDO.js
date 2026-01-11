function onFormSubmit(e) {
    var baseUrl = "https://vbcjqmkmgsacfokphhfs.supabase.co/rest/v1";
    var supabaseKey = "sb_publishable_UIR_A_5ImH6DHo44LnjHDQ_k2-C8sP_";

    var headers = {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    // --- 1. MAPEO ROBUSTO DE RESPUESTAS ---
    var responses = e.response.getItemResponses();
    var res = {};

    function getVal(text) {
        for (var i = 0; i < responses.length; i++) {
            var title = responses[i].getItem().getTitle().trim();
            if (title.toLowerCase().includes(text.toLowerCase())) {
                return responses[i].getResponse();
            }
        }
        return null;
    }

    // --- 2. PROCESAMIENTO DE FECHAS Y TIEMPOS ---
    function obtenerFechaISO(fechaStr) {
        if (!fechaStr) return null;
        var partes = fechaStr.match(/\d+/g);
        if (!partes || partes.length < 3) return null;
        var año = partes[0].length === 4 ? partes[0] : partes[2];
        var mes = ("0" + partes[1]).slice(-2);
        var dia = partes[0].length === 4 ? ("0" + partes[2]).slice(-2) : ("0" + partes[0]).slice(-2);
        return año + "-" + mes + "-" + dia + "T12:00:00-03:00";
    }

    var fInPersona = obtenerFechaISO(getVal("Fecha de TU ingreso"));
    var fOutPersona = obtenerFechaISO(getVal("Fecha de TU salida"));
    var nochesPersona = Math.max(1, Math.round((new Date(fOutPersona) - new Date(fInPersona)) / (1000 * 60 * 60 * 24)));

    var celularPropio = (getVal("Whatsapp") || "").toString().replace(/\s/g, "");
    var respRaw = (getVal("Responsable") || "").toString().toUpperCase();
    var esResponsable = (respRaw.indexOf("SI") !== -1);
    var celularLider = esResponsable ? celularPropio : (getVal("WhatsApp del Responsable") || "").toString().replace(/\s/g, "");

    var vRaw = getVal("Vehiculo") || "Ninguno";
    var tieneVehiculo = /auto|moto/i.test(vRaw);
    var tipoVehiculoPersona = /auto/i.test(vRaw) ? "auto" : (/moto/i.test(vRaw) ? "moto" : "ninguno");

    var carpasPersona = parseInt(getVal("Carpas")) || 0;
    var sillasPersona = parseInt(getVal("sillas")) || 0;
    var mesasPersona = parseInt(getVal("mesas")) || 0;

    var estadiaId = null;

    // --- 3. GESTIÓN DE LA ESTADÍA CON LÓGICA CORRECTA DE RECURSOS ---
    try {
        var searchUrl = baseUrl + "/estadias?celular_responsable=eq." + celularLider + "&estado_estadia=eq.activa&select=id,acumulado_noches_persona,cant_personas_total,fecha_ingreso,fecha_egreso_programada,tipo_vehiculo,cant_parcelas_total,cant_sillas_total,cant_mesas_total";
        var responseSearch = UrlFetchApp.fetch(searchUrl, { "headers": headers });
        var searchResult = JSON.parse(responseSearch.getContentText());

        if (searchResult.length > 0) {
            // ESTADÍA EXISTENTE - Aplicar lógica de agregación
            var est = searchResult[0];
            estadiaId = est.id;

            // Expandir rango de fechas
            var fInFinal = (new Date(fInPersona) < new Date(est.fecha_ingreso)) ? fInPersona : est.fecha_ingreso;
            var fOutFinal = (new Date(fOutPersona) > new Date(est.fecha_egreso_programada)) ? fOutPersona : est.fecha_egreso_programada;

            // LÓGICA CORREGIDA DE RECURSOS:
            // - Carpas: MIN (comparten la misma carpa)
            // - Sillas/Mesas: SUMA (cada uno trae las suyas)
            // - Vehículos: SUMA (se cuentan todos)

            var updatePayload = {
                "cant_personas_total": (parseInt(est.cant_personas_total) || 0) + 1,
                "acumulado_noches_persona": (parseInt(est.acumulado_noches_persona) || 0) + nochesPersona,
                "fecha_ingreso": fInFinal,
                "fecha_egreso_programada": fOutFinal,
                // CARPAS: MIN - tomar el mínimo porque comparten
                "cant_parcelas_total": Math.min(parseInt(est.cant_parcelas_total) || 0, carpasPersona || 0),
                // SILLAS: SUMA
                "cant_sillas_total": (parseInt(est.cant_sillas_total) || 0) + sillasPersona,
                // MESAS: SUMA
                "cant_mesas_total": (parseInt(est.cant_mesas_total) || 0) + mesasPersona
            };

            // VEHÍCULOS: Lógica especial de suma
            // Si la estadía actual tiene vehículo Y esta persona también, priorizar el tipo más grande
            var vehiculoActual = est.tipo_vehiculo || "ninguno";
            var vehiculoFinal = vehiculoActual;

            if (tieneVehiculo) {
                // Si ambos tienen auto, queda auto
                // Si uno tiene auto y otro moto, queda auto
                // Si ambos tienen moto, queda moto
                if (tipoVehiculoPersona === "auto" || vehiculoActual === "auto") {
                    vehiculoFinal = "auto";
                } else if (tipoVehiculoPersona === "moto" || vehiculoActual === "moto") {
                    vehiculoFinal = "moto";
                }
            }

            updatePayload["tipo_vehiculo"] = vehiculoFinal;

            UrlFetchApp.fetch(baseUrl + "/estadias?id=eq." + estadiaId, {
                "method": "patch",
                "headers": headers,
                "payload": JSON.stringify(updatePayload)
            });

        } else {
            // NUEVA ESTADÍA - El primer integrante define los valores base
            var payloadEstadia = {
                "celular_responsable": celularLider,
                "fecha_ingreso": fInPersona,
                "fecha_egreso_programada": fOutPersona,
                "acumulado_noches_persona": nochesPersona,
                "cant_personas_total": 1,
                "tipo_vehiculo": tipoVehiculoPersona,
                "cant_parcelas_total": carpasPersona || 1,
                "cant_sillas_total": sillasPersona,
                "cant_mesas_total": mesasPersona,
                "estado_estadia": "activa"
            };

            var respNew = UrlFetchApp.fetch(baseUrl + "/estadias", {
                "method": "post",
                "headers": headers,
                "payload": JSON.stringify(payloadEstadia)
            });
            estadiaId = JSON.parse(respNew.getContentText())[0].id;
        }
    } catch (err) {
        Logger.log("Error en Estadía: " + err.message);
    }

    // --- 4. LÓGICA DE SALUD (PERSONA DE RIESGO) ---
    var edadNum = parseInt(getVal("Edad")) || 0;
    var enfermedadesStr = (getVal("Enfermedades") || "").toString().toLowerCase().trim();
    var saludRiesgoManual = (getVal("RIESGO") || "").toString().toUpperCase().indexOf("SI") !== -1;

    var esRiesgo = (edadNum >= 70 || saludRiesgoManual || (enfermedadesStr !== "" && enfermedadesStr !== "ninguna"));

    // --- 5. REGISTRO COMPLETO DEL ACAMPANTE ---
    var payloadAcampante = {
        "celular": celularPropio,
        "nombre_completo": getVal("Nombre y Apellido"),
        "dni_pasaporte": getVal("DNI"),
        "edad": edadNum,
        "es_persona_riesgo": esRiesgo,
        "es_responsable_pago": esResponsable,
        "celular_responsable": celularLider,
        "estadia_id": estadiaId,
        "grupo_sanguineo": getVal("Sanguineo") || "S/D",
        "obra_social": getVal("Obra Social") || "Ninguna",
        "enfermedades": getVal("Enfermedades") || "Ninguna",
        "alergias": getVal("Alergias") || "Ninguna",
        "medicacion": getVal("medicacion") || "Ninguna",
        "tratamiento": getVal("tratamiento") || "No",
        "contacto_emergencia": getVal("Emergencia"),
        "fecha_salida_individual": fOutPersona,
        "created_at": new Date().toISOString()
    };

    try {
        UrlFetchApp.fetch(baseUrl + "/acampantes", {
            "method": "post",
            "headers": headers,
            "payload": JSON.stringify(payloadAcampante)
        });
    } catch (err) {
        // Reintento con sufijo si el número ya está registrado
        payloadAcampante.celular = celularPropio + "-R" + Math.floor(Math.random() * 1000);
        UrlFetchApp.fetch(baseUrl + "/acampantes", {
            "method": "post",
            "headers": headers,
            "payload": JSON.stringify(payloadAcampante)
        });
    }
}
