-- Importación controlada del directorio unificado de Las Violetas.
-- Fuente: listado unificado entregado el 2026-10-09.
-- REQUISITO: las migraciones 001 y 003 deben estar aplicadas.
-- Aborta si la tabla ya contiene personas; no duplica ni sobrescribe sin reconciliación.
-- El estado de bautismo se deja NULL porque no consta en el archivo fuente.
BEGIN;

DO $guard$
DECLARE v_existing_count BIGINT;
BEGIN
  IF to_regclass('public.members') IS NULL THEN
    RAISE EXCEPTION 'No existe public.members. Aplica primero las migraciones 001 y 003 en la base de datos Neon correcta.';
  END IF;
  SELECT COUNT(*) INTO v_existing_count FROM public.members;
  IF v_existing_count <> 0 THEN
    RAISE EXCEPTION 'Importación cancelada: public.members ya contiene % registros. No se modificó ningún dato; hace falta reconciliar el directorio previo por identidad.', v_existing_count;
  END IF;
END
$guard$;

INSERT INTO public.members (
  first_name, last_name, gender, appointment, is_regular_pioneer,
  additional_roles, is_active, is_baptized
) VALUES
  ('Abrahán', 'Díaz', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Benjamin', 'Pérez Maestre', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Carlos Mario', 'Cano', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Dúber Antonio', 'Garzón', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Félix Anibal', 'Pérez', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Gonzalo Adolfo', 'Álvarez', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Gonzalo', 'Álvarez Puerta', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Juan Felipe', 'López', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Luis Alberto', 'Ospina Rodríguez', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Luis Enrique', 'Valencia', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, NULL, true, NULL),
  ('Luis Guillermo', 'Castrillo', 'male'::public.gender_enum, 'elder'::public.appointment_enum, false, 'secretario', true, NULL),
  ('Widmar Alberto', 'Grisales', 'male'::public.gender_enum, 'elder'::public.appointment_enum, true, NULL, true, NULL),
  ('Gustavo', 'Ruiz', 'male'::public.gender_enum, 'ministerial_servant'::public.appointment_enum, false, NULL, true, NULL),
  ('Heriberto', 'Hernández', 'male'::public.gender_enum, 'ministerial_servant'::public.appointment_enum, true, NULL, true, NULL),
  ('Jesús Antonio', 'Castaño', 'male'::public.gender_enum, 'ministerial_servant'::public.appointment_enum, false, NULL, true, NULL),
  ('Luis Horacio', 'Castrillón', 'male'::public.gender_enum, 'ministerial_servant'::public.appointment_enum, false, NULL, true, NULL),
  ('Luis Octavio', 'Yepes', 'male'::public.gender_enum, 'ministerial_servant'::public.appointment_enum, false, NULL, true, NULL),
  ('Román Alberto', 'Rodríguez', 'male'::public.gender_enum, 'ministerial_servant'::public.appointment_enum, false, NULL, true, NULL),
  ('Stirwen Yomar', 'Marquez Salazar', 'male'::public.gender_enum, 'ministerial_servant'::public.appointment_enum, true, NULL, true, NULL),
  ('Amparo', 'Pulgarín', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Aura Rosa', 'Tabares de Ospina', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('David', 'Aular', 'male'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Diris Isabel', 'Anaya de Arbeláez', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Emilsen', 'de Castaño', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Gloria', 'Escobar', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Gloria Aleida', 'Valencia', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Lucy', 'Murillo de Cano', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Luz Elena', 'Mejía', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Marilyn', 'Maestre de Pérez', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Martha', 'Muñoz de Alvarez', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Mary', 'Montilla de Marquez', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Olga', 'Álvarez', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Saida', 'Gallardo', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Sandra Maria', 'Suarez de Alvarez', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Viviana Marcela', 'Tabares de Grisales', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Viviana María', 'Álvarez', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Yamile', 'García Yepes', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Yanet', 'Valencia', 'female'::public.gender_enum, 'none'::public.appointment_enum, true, NULL, true, NULL),
  ('Adriana', 'Gómez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Aicardo', 'Arbeláez', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Alejandro', 'Zapata', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Amparo', 'Gómez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('América', 'Quintero', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Ana Cecilia', 'Ospina Yepes', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Ana Cecilia', 'Suárez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Ana Teresa', 'Angel Lopez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Ángela', 'López', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Ángela', 'Ríos', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Antonio', 'Castaño', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Argemiro', 'Murillo Quintero', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Arnulfo', 'Quimbayo', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Astrid', 'Castaño', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Aura Carlina', 'Hurtado', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Aura Rosa', 'Agudelo', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Bernarda Tamayo', 'Penagos', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Catalina', 'Céspedes', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Catalina', 'Yepes', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Diana', 'Mira', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Diana', 'Tobón García', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Diocelina', 'Monzalve', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Eliana Mairene', 'Ochoa', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Emmanuel', 'Pico', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Estiven', 'Díaz', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Flor Marina', 'García', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Francia Nirla', 'Mosquera', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Francisco Javier', 'Castaño', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Fulton', 'Mosquera', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Gabriela', 'Yepes', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Graciela', 'Uribe', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Guillermina', 'Prisco', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Hulton', 'Mosquera', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Ileana', 'Ramírez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Isaac', 'Pérez', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Isabela', 'López', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Iván', 'Castaño', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Jaime', 'García', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Jerónimo', 'Lopez', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Jorge', 'Ballesteros', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('José Miguel', 'Álvarez', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Juan Carlos', 'Gutiérrez', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Julia Elisa', 'Gomez Gutierrez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Karleys', 'Monterrosa', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Lancaster', 'García', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Lucía', 'de García', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Luz Adriana', 'Gómez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Luz Amparo', 'Jaramillo Sánchez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Luz Dary', 'Tobón', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Luz Fanny', 'Valencia', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Luz Mery', 'Rodríguez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Margarita', 'Barrera', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('María Dolly', 'Ardila', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('María Eugenia', 'Marrugo', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('María Leticia', 'Valdez de Yepes', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Marina', 'López Ocampo', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Marina', 'Tobón', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Marisol', 'Luján', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Marlen', 'Perea', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Martha', 'de Castrillón', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Martha Irene', 'Atehortua', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Martha Nubia', 'Pulgarín', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Mary Luz', 'González', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Mary Luz', 'Vásquez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Mery', 'Rodríguez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Nohelia', 'Muñoz', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Olga Patricia', 'Castaño', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Omaira', 'Usuga Oquendo', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Pablo', 'Andrade Valencia', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Rosalba', 'de Castaño', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Rosalba', 'Gómez Gutiérrez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Sandra', 'López', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Sandra Milena', 'Sanamaria', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Sandra', 'Zapata', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Sara', 'Vélez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Sarai', 'Ospina de Castaño', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Saray', 'Castaño', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Silvia Omaira', 'Valencia', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Silvia', 'Tobón García', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Soledad', 'Rodriguez de Gómez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Sonia Patricia', 'Hernandez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Sorangel Soledad', 'Urbina', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Teresa', 'de Valencia', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Teresa', 'Garzón', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('William', 'Monterrosa', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Yeimy Tibisay', 'de Freitas Chacon', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Yenny', 'Cuervo', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Yisel Adriana', 'Contreras de Perez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Yosannis', 'de Diaz', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Zoraida', 'García', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, true, NULL),
  ('Adriana', 'Maestre de Diaz', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Cristian', 'Narvaez', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Jaime', 'Valencia', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Johana', 'Tobon', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Katherine', 'Cardona', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Mariela', 'Maya', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Samuel', 'Rojas', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Santiago', 'Castaño', 'male'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Sonia Maria', 'Gomez Gomez', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Teresa', 'Quintero', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL),
  ('Valentina', 'Ortiz Berrio', 'female'::public.gender_enum, 'none'::public.appointment_enum, false, NULL, false, NULL);

DO $verify$
DECLARE v_total BIGINT; v_elders BIGINT; v_servants BIGINT; v_pioneers BIGINT; v_inactive BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.members;
  SELECT COUNT(*) INTO v_elders FROM public.members WHERE appointment = 'elder'::public.appointment_enum;
  SELECT COUNT(*) INTO v_servants FROM public.members WHERE appointment = 'ministerial_servant'::public.appointment_enum;
  SELECT COUNT(*) INTO v_pioneers FROM public.members WHERE is_regular_pioneer IS TRUE;
  SELECT COUNT(*) INTO v_inactive FROM public.members WHERE is_active IS FALSE;
  IF v_total <> 139 OR v_elders <> 12 OR v_servants <> 7 OR v_pioneers <> 22 OR v_inactive <> 11 THEN
    RAISE EXCEPTION 'Verificación fallida: total %, ancianos %, siervos %, precursores %, inactivos %. Se revierte la transacción.', v_total, v_elders, v_servants, v_pioneers, v_inactive;
  END IF;
END
$verify$;

COMMIT;
