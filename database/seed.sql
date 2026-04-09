-- ============================================================
-- Entrenamiento Comunicativo — Seed Data
-- 40 exercises across 7 categories + 16 filler words
-- ============================================================

-- ── Filler words ─────────────────────────────────────────────
INSERT IGNORE INTO filler_words (word, source, suggested_alternative) VALUES
('bueno', 'seed', 'en efecto, en este sentido'),
('o sea', 'seed', 'es decir, en otras palabras'),
('en plan', 'seed', 'a modo de, como'),
('este', 'seed', 'ehm, [pausa intencional]'),
('a ver', 'seed', 'en efecto, considerando esto'),
('pues', 'seed', 'por tanto, en consecuencia'),
('y nada', 'seed', '[pausa intencional]'),
('tipo', 'seed', 'como, similar a'),
('es que', 'seed', 'dado que, puesto que'),
('o sea que', 'seed', 'por tanto, en consecuencia'),
('mmm', 'seed', '[pausa intencional]'),
('eh', 'seed', '[pausa intencional]'),
('ahh', 'seed', '[pausa intencional]'),
('eeeh', 'seed', '[pausa intencional]'),
('umm', 'seed', '[pausa intencional]'),
('osea', 'seed', 'es decir, en otras palabras');

-- ── Lectura Controlada (7 exercises) ─────────────────────────
INSERT INTO exercise_prompts (category, level_required, title_es, description_es, duration_target_seconds, prompt_text_es, difficulty) VALUES
('Lectura Controlada', 1, 'Lectura neutra 1 minuto',
 'Lee el texto en voz alta de forma neutra y clara durante 1 minuto. Mantén un ritmo constante y pronunciación precisa.',
 60,
 'La comunicación efectiva es la base del éxito profesional. Cuando hablamos con claridad y confianza, transmitimos nuestras ideas de manera precisa y generamos confianza en nuestros interlocutores. La voz es nuestra carta de presentación más poderosa.',
 'short'),

('Lectura Controlada', 1, 'Lectura clara 2 minutos',
 'Lee el texto con pronunciación clara y pausas naturales durante 2 minutos. Presta atención a cada coma y punto.',
 120,
 'El arte de la oratoria ha sido fundamental en la historia de la humanidad. Grandes líderes han utilizado el poder de la palabra para inspirar, convencer y movilizar a sus audiencias hacia objetivos comunes. La claridad en el discurso construye puentes entre personas y hace posible el entendimiento mutuo.',
 'short'),

('Lectura Controlada', 1, 'Lectura expresiva 3 minutos',
 'Lee el texto expresivamente, variando el tono según el contenido durante 3 minutos. Dale vida a cada párrafo.',
 180,
 'La voz es el instrumento más poderoso que poseemos. Su modulación, ritmo y proyección determinan en gran medida cómo somos percibidos por los demás. Una voz bien entrenada transmite autoridad y credibilidad. Los oradores más efectivos dominan el arte de variar su tono, velocidad y volumen para mantener la atención de su audiencia a lo largo del discurso.',
 'medium'),

('Lectura Controlada', 2, 'Lectura larga 5 minutos',
 'Lectura sostenida de 5 minutos manteniendo el ritmo, la expresividad y la proyección vocal constantes.',
 300,
 'En el ámbito profesional, la capacidad de comunicar con claridad y persuasión es una habilidad diferencial. Los equipos liderados por comunicadores efectivos alcanzan sus objetivos con mayor eficiencia y cohesión interna. La comunicación no verbal, incluyendo el lenguaje corporal y el contacto visual, complementa y refuerza el mensaje verbal. Desarrollar estas competencias requiere práctica sistemática, retroalimentación constante y una actitud de mejora continua.',
 'medium'),

('Lectura Controlada', 2, 'Lectura técnica 4 minutos',
 'Lee un texto técnico con terminología específica manteniendo fluidez y claridad a lo largo de 4 minutos.',
 240,
 'Los sistemas de información empresarial integran múltiples módulos funcionales: gestión de recursos humanos, contabilidad financiera, control de inventarios y análisis de datos. La implementación correcta de estos sistemas requiere planificación metodológica, formación continua del personal y protocolos de seguridad robustos. La transformación digital no es solo tecnología, es un cambio cultural profundo en la organización que afecta a todos sus niveles.',
 'medium'),

('Lectura Controlada', 2, 'Lectura con pausas intencionales',
 'Lee realizando pausas deliberadas para enfatizar ideas clave. La pausa es una herramienta retórica fundamental.',
 150,
 'La pausa es una herramienta retórica de gran poder. Cuando callamos en el momento oportuno, permitimos que nuestras palabras resuenen en la mente del oyente. El silencio elocuente vale más que las palabras superfluas. Cada pausa marca el ritmo de tu discurso y refuerza tu presencia como orador ante cualquier audiencia.',
 'short'),

('Lectura Controlada', 3, 'Lectura mirando a cámara',
 'Lee el texto manteniendo contacto visual con la cámara el mayor tiempo posible. Alterna entre leer y mirar.',
 120,
 'El contacto visual establece una conexión directa con tu audiencia. Cuando mantienes la mirada, transmites confianza y compromiso con tu mensaje. Practica memorizar frases cortas antes de levantar la vista hacia tu interlocutor. La conexión ocular es uno de los pilares de la comunicación efectiva y la presencia profesional.',
 'medium'),

-- ── Presentación Personal (6 exercises) ──────────────────────
('Presentación Personal', 5, 'Elevator Pitch 1 minuto',
 'Preséntate profesionalmente en exactamente 1 minuto. Quién eres, qué haces y qué valor aportarías.',
 60, NULL, 'short'),

('Presentación Personal', 5, 'Presentación profesional 3 minutos',
 'Realiza una presentación profesional completa en 3 minutos incluyendo tu trayectoria y objetivos.',
 180, NULL, 'medium'),

('Presentación Personal', 5, 'Presentación completa 5 minutos',
 'Presentación extendida de 5 minutos con contexto profesional, logros cuantificables y proyección futura.',
 300, NULL, 'long'),

('Presentación Personal', 5, 'Explica tu experiencia laboral',
 'Describe tu trayectoria profesional de forma cronológica y coherente en 2-3 minutos destacando los hitos más relevantes.',
 150, NULL, 'medium'),

('Presentación Personal', 5, 'Explica tus fortalezas',
 'Presenta tus principales fortalezas profesionales con ejemplos concretos y métricas cuando sea posible.',
 120, NULL, 'short'),

('Presentación Personal', 5, 'Presentación con límite estricto de tiempo',
 'Presenta tu perfil profesional en exactamente 90 segundos. Ni más ni menos. La precisión temporal es clave.',
 90, NULL, 'short'),

-- ── Entrevista Laboral (8 exercises) ─────────────────────────
('Entrevista Laboral', 6, '¿Por qué quieres este puesto?',
 'Responde esta pregunta clásica con estructura clara, argumentos sólidos y conexión entre tus capacidades y el rol.',
 120, NULL, 'short'),

('Entrevista Laboral', 6, 'Háblame de ti',
 'La pregunta de apertura más frecuente. Prepara una respuesta estructurada, memorable y relevante en 2 minutos.',
 120, NULL, 'short'),

('Entrevista Laboral', 6, 'Reto profesional importante',
 'Describe un desafío profesional significativo que hayas superado, las acciones que tomaste y los resultados obtenidos.',
 180, NULL, 'medium'),

('Entrevista Laboral', 6, '¿Cómo trabajas bajo presión?',
 'Explica tu metodología de trabajo en situaciones de alta exigencia con ejemplos reales y resultados concretos.',
 150, NULL, 'medium'),

('Entrevista Laboral', 7, '¿Por qué deberíamos contratarte?',
 'Argumenta de forma convincente y diferencial por qué eres la persona idónea para el puesto.',
 120, NULL, 'short'),

('Entrevista Laboral', 7, 'Fortalezas y debilidades',
 'Habla con naturalidad sobre tus puntos fuertes y áreas de mejora de forma profesional y honesta.',
 180, NULL, 'medium'),

('Entrevista Laboral', 7, 'Situación difícil resuelta',
 'Narra una situación laboral complicada y cómo la resolviste de forma efectiva usando el método STAR.',
 180, NULL, 'medium'),

('Entrevista Laboral', 7, 'Aportación al equipo',
 'Describe cómo contribuyes al trabajo en equipo, qué rol sueles asumir y con qué resultados.',
 120, NULL, 'short'),

-- ── Estructura Oral (5 exercises) ────────────────────────────
('Estructura Oral', 6, 'Método STAR completo',
 'Practica la técnica STAR (Situación, Tarea, Acción, Resultado) con un ejemplo profesional real y detallado.',
 180, NULL, 'medium'),

('Estructura Oral', 6, 'Esquema inicio-desarrollo-cierre',
 'Estructura un discurso de 3 minutos con apertura clara, desarrollo argumentado y cierre memorable e impactante.',
 180, NULL, 'medium'),

('Estructura Oral', 6, 'Explica una idea en tres puntos',
 'Elige cualquier idea o concepto y explícalo de forma clara y persuasiva usando exactamente tres argumentos.',
 150, NULL, 'short'),

('Estructura Oral', 6, 'Resume un texto en 60 segundos',
 'Resume con estructura clara los puntos más importantes de cualquier texto en exactamente 1 minuto.',
 60, NULL, 'short'),

('Estructura Oral', 6, 'Responde con límite de 90 segundos',
 'Responde una pregunta compleja de forma estructurada sin exceder los 90 segundos de respuesta.',
 90, NULL, 'short'),

-- ── Soltura y Desinhibición (5 exercises) ────────────────────
('Soltura y Desinhibición', 4, 'Habla 1 minuto sobre un objeto',
 'Elige cualquier objeto que tengas cerca y habla sobre él durante 1 minuto sin preparación previa.',
 60, NULL, 'short'),

('Soltura y Desinhibición', 4, 'Improvisa sobre tema sencillo',
 'Habla durante 2 minutos sobre un tema cotidiano sin preparación previa. El objetivo es la fluidez natural.',
 120, NULL, 'short'),

('Soltura y Desinhibición', 4, 'Describe una imagen 2 minutos',
 'Describe verbalmente una imagen o escena que visualices o recuerdes con detalle durante 2 minutos.',
 120, NULL, 'short'),

('Soltura y Desinhibición', 4, 'Habla a cámara sin leer',
 'Habla directamente a la cámara durante 90 segundos sobre cualquier tema sin apoyarte en notas escritas.',
 90, NULL, 'short'),

('Soltura y Desinhibición', 4, 'Repite la misma prueba 3 veces',
 'Realiza la misma presentación corta de 1 minuto tres veces consecutivas, mejorando y perfeccionando cada vez.',
 60, NULL, 'short'),

-- ── Videoconferencia Profesional (5 exercises) ───────────────
('Videoconferencia Profesional', 8, 'Inicio de reunión',
 'Practica cómo abrir una videoconferencia profesional de forma efectiva: bienvenida, agenda y objetivos en 90 segundos.',
 90, NULL, 'short'),

('Videoconferencia Profesional', 8, 'Cierre profesional de reunión',
 'Practica cómo cerrar una reunión de forma clara, resumiendo acuerdos, responsables y próximos pasos.',
 90, NULL, 'short'),

('Videoconferencia Profesional', 8, 'Presentación ante varias personas',
 'Presenta un proyecto o idea ante un comité virtual en 3 minutos con presencia, claridad y estructura.',
 180, NULL, 'medium'),

('Videoconferencia Profesional', 8, 'Explica una incidencia',
 'Comunica de forma profesional una incidencia técnica o de servicio a un cliente por videollamada.',
 120, NULL, 'short'),

('Videoconferencia Profesional', 8, 'Intervención breve sin monopolizar',
 'Practica hacer intervenciones de 60-90 segundos de forma concisa y efectiva sin acaparar la reunión.',
 75, NULL, 'short'),

-- ── Resistencia Comunicativa (4 exercises) ───────────────────
('Resistencia Comunicativa', 9, 'Discurso sostenido 6 minutos',
 'Habla durante 6 minutos continuos sobre un tema de tu elección manteniendo calidad comunicativa constante.',
 360, NULL, 'long'),

('Resistencia Comunicativa', 9, 'Discurso sostenido 8 minutos',
 'Discurso de 8 minutos con estructura clara, ejemplos concretos y conclusión memorable y motivadora.',
 480, NULL, 'long'),

('Resistencia Comunicativa', 10, 'Discurso sostenido 10 minutos',
 'El máximo desafío: 10 minutos de comunicación continua, fluida y estructurada sin deterioro de calidad.',
 600, NULL, 'long'),

('Resistencia Comunicativa', 10, 'Preguntas consecutivas sin deterioro',
 'Responde 5 preguntas consecutivas en 10 minutos manteniendo la calidad comunicativa en cada intervención.',
 600, NULL, 'long');
