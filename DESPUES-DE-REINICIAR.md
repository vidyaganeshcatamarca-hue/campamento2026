# 🔄 Tareas Post-Reinicio

## 1. Limpiar Cache y Reiniciar Servidor

```powershell
cd c:\temp\Antigravity\campamento-vrindavan

# Limpiar cache completamente
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue

# Reiniciar servidor
npm run dev
```

Esperar a que compile (debería tomar 5-10 segundos).

---

## 2. Verificar que Check-in ya NO Crashea

Abrir navegador: **http://localhost:3000** (o el puerto que use)

1. Ir a `/recepcion`
2. Click en tarjeta de "Juan Pérez"
3. **Debe cargar la página de check-in SIN errores**

Si aún crashea, revisar consola del servidor para el error específico.

---

## 3. Completar Tests Pendientes

### Test 2: Check-in Flow (El que falló)
1. En `/checkin/[id]` verificar:
   - Datos pre-cargados
   - Cambiar sillas de 4 a 6
   - Seleccionar parcelas A1 y A2
   - Click "Confirmar Ingreso"
   - Navega a `/liquidacion/[id]`

### Test 3: Liquidación
1. Verificar cálculos:
   - Personas: 3 × 5 noches × $5,000 = $75,000
   - Carpa: 5 días × $3,000 = $15,000
   - Sillas: 5 días × 6 × $500 = $15,000
   - Mesa: 5 días × $800 = $4,000
   - Auto: 5 días × $2,000 = $10,000
   - **Subtotal**: $119,000
2. Aplicar descuento $19,000 → Total $100,000
3. Pagar $50,000
4. Verificar saldo restante: $50,000

### Test 4: Formulario Manual (Lógica de Google Forms)

#### Test 4A: Nuevo Grupo
- Nombre: María Rodríguez
- WhatsApp: 1122334455
- Edad: 28
- Fechas: 12-17 enero (5 noches)
- ☑ Soy el responsable
- Carpas: 1, Sillas: 2
- Vehículo: "Moto ABC123"

**Verificar en Supabase:**
- Nueva estadía creada
- `acumulado_noches_persona = 5`
- `tipo_vehiculo = "moto"`

#### Test 4B: Agregar Integrante
- Nombre: Pedro Rodríguez
- WhatsApp: 5544332211
- Edad: 30
- Fechas: 12-17 enero
- ☐ NO soy responsable
- WhatsApp Responsable: 1122334455

**Verificar:**
- **MISMA** estadía (no crea nueva)
- `cant_personas_total = 2`
- `acumulado_noches_persona = 10` (5 + 5)
- Inventario NO cambió

#### Test 4C: Persona con Riesgo por Edad
- Nombre: Doña Carmen
- Edad: 75 (>= 70 años)
- ☐ Riesgo médico desmarcado
- Enfermedades: "Ninguna"

**Verificar:**
- `es_persona_riesgo = TRUE` (por edad)
- Aparece con borde rojo en recepción

---

## 4. Si Todo Funciona: Continuar con Módulos Restantes

### Fase 3: Gestión Diaria
- Módulo 5: Dashboard de Estadías Activas
- Módulo 6: Gestión de Recursos
- Módulo 7: Extensión de Estadía
- Módulo 8: Consulta de Saldo y Pagos
- Módulo 9: Centro de Comunicaciones

---

## 🐛 Problemas Conocidos

1. **Turbopack Cache**: Si vuelve a crashear, eliminar `.next/` siempre
2. **Puerto ocupado**: Si usa puerto 3001, hay proceso en 3000
3. **Webhook n8n**: No configurado, ver console logs para mensajes fallidos

---

## 📊 Estado Actual

### ✅ Completado
- Configuración base y diseño Vrindavan
- Módulo 1: Recepción (100%)
- Módulo 3A: Visitantes Diarios (100%)
- Formulario Manual con lógica Google Forms (código listo)

### 🟡 Parcial
- Módulo 2: Check-in (bloqueado por crash)
- Módulo 3B: Liquidación (no testeado)

### ⏳ Pendiente
- Módulos 5-12 (Fase 3 y 4)
