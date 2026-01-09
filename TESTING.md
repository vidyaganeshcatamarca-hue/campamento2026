# Guía de Testing - Sistema Campamento Vrindavan

## Paso 1: Popular Datos de Prueba en Supabase

1. Abre Supabase en tu navegador: https://supabase.com/dashboard
2. Ve a tu proyecto y selecciona "SQL Editor"
3. Copia y pega el contenido del archivo `datos-prueba.sql`
4. Ejecuta el script

**Este script creará:**
- 6 precios en `precios_config`
- 20 parcelas libres (A1-A3, B1-B3, etc.)
- **Familia Pérez** (3 personas, check-in pendiente)
  - Juan Pérez (responsable, 35 años)
  - Ana Pérez (esposa, 30 años)
  - Carlos Pérez (hijo, 8 años)
  - Estadía: 10-15 enero, 1 carpa, 4 sillas, 1 mesa, auto
- **Roberto González** (persona de riesgo - diabético, 72 años)
  - Estadía individual: 12-14 enero

---

## Paso 2: Verificar el Servidor

El servidor debe estar corriendo en **http://localhost:3001**

Si no está corriendo:
```powershell
cd c:\temp\Antigravity\campamento-vrindavan
npm run dev
```

---

## Paso 3: Testear Flujo Completo de Check-in

### Test 1: Recepción - Ver Lista de Pendientes

1. Abre http://localhost:3001/recepcion
2. **Verificar**:
   - ✓ Debe mostrar "2 personas pendientes de check-in"
   - ✓ Tarjeta de "Juan Pérez" (normal)
   - ✓ Tarjeta de "Roberto González (Diabético)" con **borde rojo** y alerta de riesgo
3. **Probar búsqueda**:
   - Escribe "Roberto" → Debe mostrar solo a Roberto
   - Escribe "1234567890" → Debe mostrar solo a Juan Pérez
   - Limpia búsqueda → Muestra ambos

### Test 2: Check-in - Validación y Asignación

1. Click en la tarjeta de "Juan Pérez"
2. **Verificar** en `/checkin/[id]`:
   - ✓ Datos pre-cargados (nombre, celular, edad 35)
   - ✓ Recursos: 1 carpa, 0 vehículos, 4 sillas, 1 mesa
   - ✓ Selector de parcelas muestra ~20 opciones
3. **Modificar**:
   - Cambiar cantidad de sillas a 6
   - Seleccionar parcelas A1, A2
4. **Confirmar Ingreso**
5. Debe navegar a `/liquidacion/[id]`

### Test 3: Liquidación - Cálculo y Pago

En la página de liquidación:

1. **Verificar cálculos**:
   - ✓ Personas: 3 × 5 noches × $5,000 = $75,000
   - ✓ Carpa: 5 días × $3,000 = $15,000
   - ✓ Sillas: 5 días × 6 × $500 = $15,000
   - ✓ Mesa: 5 días × $800 = $4,000
   - ✓ Auto: 5 días × $2,000 = $10,000
   - ✓ **Subtotal**: ~$119,000

2. **Aplicar descuento**:
   - Descuento Especial: $19,000
   - Total con descuento: $100,000

3. **Registrar pago**:
   - Monto a Abonar: $50,000
   - Método: Efectivo
   - **Saldo Restante**: $50,000

4. **Finalizar Ingreso**
   - ✓ Debe enviar notificación WhatsApp (revisar console si webhook no está configurado)
   - ✓ Debe volver a Recepción
5. **Verificar**: Juan Pérez ya NO debe aparecer en la lista

---

## Paso 4: Testear Formulario Manual con Lógica de Google Forms

### Test 4A: Nuevo Grupo (Primera Persona)

1. En Recepción, click "Registrar sin Formulario"
2. **Llenar**:
   - Nombre: "María Rodríguez"
   - WhatsApp: "1122334455"
   - Edad: 28
   - Fecha ingreso: 2026-01-12
   - Fecha salida: 2026-01-17
   - ☑ Soy el responsable del pago
   - Carpas: 1
   - Sillas: 2
   - Vehículo: "Moto ABC123"
   - Enfermedades: "Ninguna"
   - Contacto Emergencia: "Pedro Rodríguez - 5544332211"

3. **Registrar Pre-Ingreso**
4. **Verificar en Supabase**:
   - Nueva estadía con `celular_responsable = "1122334455"`
   - `acumulado_noches_persona = 5` (17-12 = 5 noches)
   - `tipo_vehiculo = "moto"`
   - Nuevo acampante María con `es_responsable_pago = TRUE`

### Test 4B: Agregar Integrante al Grupo de María

1. Click "Registrar sin Formulario" nuevamente
2. **Llenar**:
   - Nombre: "Pedro Rodríguez"
   - WhatsApp: "5544332211"
   - Edad: 30
   - Fecha ingreso: 2026-01-12  
   - Fecha salida: 2026-01-17
   - ☐ Soy el responsable (DESMARCAR)
   - WhatsApp del Responsable: "1122334455"
   - Enfermedades: "Ninguna"
   - Contacto Emergencia: "María Rodríguez - 1122334455"

3. **Registrar Pre-Ingreso**
4. **Verificar en Supabase**:
   - **MISMA** estadía (no se creó nueva)
   - `cant_personas_total = 2` (sumó 1)
   - `acumulado_noches_persona = 10` (5 + 5)
   - `tipo_vehiculo`, carpas, sillas NO cambiaron (Pedro no es responsable)
   - Nuevo acampante Pedro con `es_responsable_pago = FALSE`

### Test 4C: Persona con Salida Anticipada

1. Click "Registrar sin Formulario"
2. **Llenar**:
   - Nombre: "Luis Rodríguez (hijo)"
   - WhatsApp: "1122334456"
   - Edad: 10
   - Fecha ingreso: 2026-01-12
   - Fecha salida: 2026-01-14 (sale 3 días antes!)
   - ☐ Soy el responsable
   - WhatsApp del Responsable: "1122334455"

3. **Verificar en Supabase**:
   - **MISMA** estadía
   - `cant_personas_total = 3`
   - `acumulado_noches_persona = 12` (10 + 2 noches de Luis)
   - `fecha_egreso_programada` sigue siendo 2026-01-17 (NO se reduce, solo se expande)

### Test 4D: Persona de Riesgo Automático (Edad >= 70)

1. Click "Registrar sin Formulario"
2. **Llenar**:
   - Nombre: "Doña Carmen"
   - WhatsApp: "9988776655"
   - Edad: **75** (>= 70 años)
   - Fecha ingreso: 2026-01-13
   - Fecha salida: 2026-01-15
   - ☑ Soy el responsable
   - ☐ ¿Riesgo médico? (DEJAR DESMARCADO)
   - Enfermedades: "Ninguna"

3. **Verificar en Supabase**:
   - Nuevo acampante con `es_persona_riesgo = TRUE` (por edad >= 70)
   - Debe aparecer en Recepción con **borde rojo**

### Test 4E: Persona de Riesgo por Enfermedad

1. **Llenar**:
   - Nombre: "Jorge Martínez"
   - WhatsApp: "4433221100"
   - Edad: 40
   - ☑ Soy el responsable
   - Enfermedades: "Asma crónica" (≠ "ninguna")

2. **Verificar**:
   - `es_persona_riesgo = TRUE` (por enfermedad)
   - Borde rojo en Recepción

---

## Paso 5: Testear Visitantes Diarios

1. Ir a http://localhost:3001/visitantes
2. **Llenar**:
   - Nombre: "Visitante de Prueba"
   - Celular: "3344556677"
   - Patente: "DEF456"
   - Monto: $3,500
   - Observaciones: "Día de campo familiar"

3. **Registrar**
4. **Verificar**:
   - Formulario se limpia automáticamente
   - En Supabase tabla `visitas_diarias` debe tener el registro

---

## Errores Comunes y Soluciones

### Error: "Cannot apply unknown utility class"
**Solución**: Ya está corregido en  `globals.css`. Si persiste, limpiar cache:
```powershell
Remove-Item -Path ".next" -Recurse -Force
npm run dev
```

### Error: Puerto 3000 en uso
**Normal**: El servidor usa puerto 3001 automáticamente

### No se ven datos de prueba
Asegúrate de ejecutar el script SQL en Supabase SQL Editor

---

## Checklist de Funcionalidades

- [ ] Lista de recepción muestra pre-registrados
- [ ] Búsqueda funciona en tiempo real
- [ ] Indicador de riesgo (borde rojo) funciona
- [ ] Check-in permite editar datos
- [ ] Asignación de parcelas funciona
- [ ] Liquidación calcula correctamente
- [ ] Descuento se aplica
- [ ] Registro de pago guarda en DB
- [ ] Formulario manual SUMA a estadía existente
- [ ] Formulario manual expande fechas correctamente
- [ ] Solo responsable puede cambiar inventario
- [ ] Riesgo automático por edad >= 70
- [ ] Riesgo automático por enfermedad != "ninguna"
- [ ] Manejo de celular duplicado (sufijo -R)
- [ ] Visitantes diarios se registran correctamente

---

## Siguiente: Fase 3

Una vez validado todo lo anterior, podemos continuar con:
- Módulo 4: Dashboard de Estadías Activas
- Módulo 5: Gestión de Recursos e Integrantes
- Etc.
