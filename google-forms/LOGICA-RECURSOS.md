# Lógica Corregida de Agregación de Recursos en Formulario

## Problema Original
Cuando dos personas comparten carpa y ambas llenan el formulario, los recursos se manejaban incorrectamente.

## Lógica Correcta Implementada

### 1. Carpas (Parcelas)
**Operación: MIN**
```javascript
"cant_parcelas_total": Math.min(parseInt(est.cant_parcelas_total) || 0, carpasPersona || 0)
```
- Persona A dice: 1 carpa
- Persona B dice: 1 carpa  
- **Resultado: 1 carpa** (comparten la misma)

### 2. Sillas
**Operación: SUMA**
```javascript
"cant_sillas_total": (parseInt(est.cant_sillas_total) || 0) + sillasPersona
```
- Persona A dice: 2 sillas
- Persona B dice: 3 sillas
- **Resultado: 5 sillas** (cada uno trae las suyas)

### 3. Mesas
**Operación: SUMA**
```javascript
"cant_mesas_total": (parseInt(est.cant_mesas_total) || 0) + mesasPersona
```
- Persona A dice: 1 mesa
- Persona B dice: 1 mesa
- **Resultado: 2 mesas** (cada uno trae la suya)

### 4. Vehículos
**Operación: PRIORIDAD (auto > moto > ninguno)**
```javascript
if (tipoVehiculoPersona === "auto" || vehiculoActual === "auto") {
    vehiculoFinal = "auto";
} else if (tipoVehiculoPersona === "moto" || vehiculoActual === "moto") {
    vehiculoFinal = "moto";
}
```
- Si alguien tiene auto → queda "auto"
- Si nadie tiene auto pero alguien tiene moto → queda "moto"
- Si nadie tiene vehículo → queda "ninguno"

## Ejemplo Completo

**Persona A (Responsable):**
- 1 carpa
- 2 sillas
- 1 mesa
- 1 auto

**Persona B (Acompañante):**
- 1 carpa
- 3 sillas
- 0 mesas
- 1 moto

**Resultado Final:**
- Carpas: MIN(1, 1) = **1**
- Sillas: 2 + 3 = **5**
- Mesas: 1 + 0 = **1**
- Vehículo: auto > moto = **auto**

## Archivo Actualizado

El código corregido está en:
`google-forms/onFormSubmit-CORREGIDO.js`

Reemplazar el código actual del trigger `onFormSubmit` en Google Apps Script con este archivo.
