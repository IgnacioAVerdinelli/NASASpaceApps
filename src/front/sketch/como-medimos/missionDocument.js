export const missionDocument = {
  pdf: new URL('../../../../docs/references/OCHMO-STD-100.1A_RevA_2024-09-09.pdf', import.meta.url).href,
  source: 'https://www.nasa.gov/wp-content/uploads/2023/04/ochmo-std-100.1a.pdf',
  title: "NASA Space Flight Medical Selection, Recertification and Mission Evaluation Standards",
  revision: "OCHMO-STD-100.1A · Revision A · September 2024",
};

export const missionReference = {
  id: 'referencia', kind: 'document', title: "What guides our health check plan",
  image: new URL('./assets/nasa-medical-cover.webp', import.meta.url).href,
  alt: "Cover of NASA medical standard OCHMO-STD-100.1A: Office of the Chief Health and Medical Officer, NASA Space Flight Medical Selection, Recertification and Mission Evaluation Standards.",
  model: missionDocument.revision,
  text: "We draw on NASA's medical standard because it brings together the assessments needed at different stages of a mission. We use its sample schedule for a 180-day stay aboard the International Space Station as a starting point. It helps us organize health checks before, during and after the journey, while recognizing that each mission needs its own plan.",
};
