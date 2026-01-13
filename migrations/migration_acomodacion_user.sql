-- Crear usuario 'acomodacion'
-- Rol: acomodacion (Solo lectura de Ocupación)
-- Contraseña por defecto: acomodacion123
-- Permisos: Acceso read-only a módulo Ocupación y Check-in (para ver detalles).

INSERT INTO usuarios_sistema (username, password, role, nombre_completo)
VALUES ('acomodacion', 'acomodacion123', 'acomodacion', 'Usuario Acomodacion')
ON CONFLICT (username) DO UPDATE 
SET role = 'acomodacion', password = 'acomodacion123';
