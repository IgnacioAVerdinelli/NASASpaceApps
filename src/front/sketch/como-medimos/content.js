const asset = name => new URL(`./assets/${name}.webp`, import.meta.url).href;
const nasa = id => `https://images.nasa.gov/details/${id}`;
export const instruments = [
  {
    id: 'fuerza', title: "Muscle assessment · MARES", image: asset('mares'),
    alt: "Paolo Nespoli seated in MARES, with his legs secured for a Sarcolab-3 ankle assessment in the Columbus laboratory.",
    text: "MARES lets researchers study muscle strength and movement aboard the International Space Station. Here, Paolo Nespoli is preparing for an ankle assessment. We draw on ground-based strength studies to generate simulated measurements and compare them with a pre-mission baseline. This helps us show changes that can inform further checks.",
    model: "ESA · Muscle Atrophy Research and Exercise System (MARES)",
    source: nasa('iss052e024957'), credit: 'NASA · ISS052-E-024957',
    relation: 'Fotografía en vuelo de Sarcolab-3. MARES es referencia funcional, no el Biodex usado en los históricos MR079G ni un instrumento conectado a GraviTal.',
    evidence: 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Columbus/Muscle_Atrophy_Research_and_Exercise_System',
  },
  {
    id: 'composicion', title: "Muscle ultrasound · Ultrasound 2", image: asset('ultrasound'),
    alt: "Mike Fossum scanning his own leg with Ultrasound 2 during the SPRINT study in the Columbus laboratory.",
    text: "Ultrasound lets researchers examine muscles during spaceflight. Here, Mike Fossum uses Ultrasound 2 to scan his leg. We include it as an example of muscle monitoring in orbit; our simulated body composition measurements draw on ground-based studies using DXA scans. We keep that distinction clear because muscle size, lean mass and strength describe different aspects of the body.",
    model: "NASA · Ultrasound 2 (USND-2)",
    source: nasa('iss029e025280'), credit: 'NASA · ISS029-E-025280',
    evidence: 'https://www.nasa.gov/blogs/stationreport/2017/08/31/iss-daily-summary-report-8-31-2017/',
    relation: 'Autoecografía SPRINT en vuelo documentada por NASA. Modelo comercial de la unidad fotografiada sin verificar. La adquisición y el procesamiento de ecografías no están implementados en GraviTal; no sustituye DXA en el ajuste.',
  },
  {
    id: 'esfuerzo', title: "Cycle ergometer", image: asset('cycle'),
    alt: "Luca Parmitano pedaling on CEVIS aboard the International Space Station, with its pedals and support structure visible.",
    text: "CEVIS lets crew members pedal against controlled resistance aboard the International Space Station. We draw on ground-based exercise tests to simulate aerobic capacity and track how it changes. We compare results with a personal baseline to highlight changes and plan further checks when needed. The photograph shows how this type of equipment is used in orbit.",
    model: "CEVIS · Cycle Ergometer with Vibration Isolation System", source: nasa('iss036e015570'), credit: 'NASA · ISS036-E-015570',
    relation: 'Equipo de vuelo documentado. Fabricante y modelo del cicloergómetro específico de MR080G no se verificaron; CEVIS no se presenta como ese equipo.',
  },
  {
    id: 'respiracion', title: "Respiratory gas analyzer", image: asset('gas'),
    alt: "Don Pettit performing a VO₂max test on CEVIS while breathing through the Portable Pulmonary Function System (PPFS).",
    text: "Analyzing the air we breathe during an exercise test reveals how much oxygen the body uses. The photograph shows the portable PPFS system in use aboard the station. We draw on historical test results to generate simulated measurements and compare them with a personal baseline. This helps us track changes in aerobic capacity and plan another assessment when needed.",
    model: "PPFS · Portable Pulmonary Function System", source: nasa('iss030e132542'), credit: 'NASA · ISS030-E-132542',
    relation: 'NASA identifica PPFS, cilindros PFS y bolsa de mezcla en esta sesión. Fabricante y modelo del analizador de MR080G no verificados.',
  },
  {
    id: 'cardiovascular', title: "Heart and blood pressure monitors", image: asset('cardiac'),
    alt: "Cady Coleman wearing electrodes, a Holter Monitor 2 and the Cardio blood pressure unit during cardiovascular research aboard the International Space Station.",
    text: "Heart and blood pressure monitors provide different measurements: heart activity and blood pressure. The photograph shows two devices used aboard the station. We simulate pulse and blood pressure using historical data, then compare them with each person's usual values. This helps us recognize sustained changes and arrange a review.",
    model: "Holter Monitor 2 (HM2) + ESA Cardio blood pressure unit", source: nasa('iss026e015923'), credit: 'NASA · ISS026-E-015923',
    relation: 'Dos instrumentos de ICV identificados en la descripción NASA; no se confirmó el fabricante ni el modelo comercial del equipo de CFT70.',
  },
  {
    id: 'sueno', title: "Activity and sleep watch", image: asset('watch'),
    alt: "Sunita Williams wearing a black Actiwatch on her left wrist while working aboard the International Space Station.",
    text: "Actiwatch records movement to help estimate periods of sleep. Our demo watch brings together simulated pulse readings, sleep duration and perceived restfulness. We look at how these signals change over several days to recognize differences from a person's usual rest patterns and plan follow-up. We also use each night's record to complete a scheduled sleep log.",
    model: "Actiwatch · variant not confirmed in this photograph",
    source: 'https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/', credit: 'NASA · ISS014-E-12135',
    relation: 'Referencia de actigrafía de vuelo. NASA documenta Spectrum en el artículo, pero la foto histórica no identifica su variante; el reloj del simulador es genérico.',
  },
  {
    id: 'signos', title: "Body monitor", image: asset('body'),
    alt: "Jasmin Moghbeli and Loral O’Hara wearing Bio-Monitor sensor headbands aboard the International Space Station.",
    text: "The headbands worn by Jasmin Moghbeli and Loral O’Hara are part of Bio-Monitor, a garment and sensor system for studying physiological signs in space. For our monitoring, we generate simulated daily readings such as pulse, blood pressure and blood oxygen, then compare them with each person's usual values. We use historical data where available and documented assumptions for other signals.",
    model: "Carré Technologies / CSA · Bio-Monitor", source: nasa('iss070e007944'), credit: 'NASA · ISS070-E-007944',
    evidence: 'https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp',
    relation: 'Sistema de prenda, banda y aplicación de tableta documentado por CSA. Los canales sintéticos de GraviTal no son una especificación de capacidades de Bio-Monitor.',
  },
].map(item => ({license: 'Condiciones de uso de imágenes NASA', licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/', ...item}));

export const dataSources = [
  ['MR079G · Fuerza', 'https://doi.org/10.83263/bk5h-r757'],
  ['MR035G · DXA', 'https://doi.org/10.83263/7myc-5j86'],
  ['MR080G · Capacidad aeróbica', 'https://doi.org/10.83263/w056-8t76'],
  ['Calendario NASA · OCHMO-STD-100.1A', 'https://www.nasa.gov/wp-content/uploads/2023/04/ochmo-std-100.1a.pdf'],
];
