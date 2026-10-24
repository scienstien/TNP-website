/**
 * NIT Tiruchirappalli's published postgraduate programmes (accessed 24 Oct 2026).
 * https://www.nitt.edu/home/academics/programmes/
 * https://www.nitt.edu/home/academics/curriculum/
 * Department pages confirm the owning departments. Process Control and Instrumentation
 * is joint between Chemical Engineering and ICE; it appears under both branches here.
 * This is a display catalogue, not a claim that every programme has placement records.
 */
export const PG_BRANCHES = [
  { code: "chem", name: "Chemical Engineering", specializations: ["Chemical Engineering", "Process Control and Instrumentation"] },
  { code: "civil", name: "Civil Engineering", specializations: ["Construction Technology and Management", "Environmental Engineering", "Geotechnical Engineering", "Structural Engineering", "Transportation Engineering and Management", "Water Resources Engineering and Management"] },
  { code: "cse", name: "Computer Science and Engineering", specializations: ["Computer Science and Engineering"] },
  { code: "eee", name: "Electrical and Electronics Engineering", specializations: ["Power Electronics", "Power Systems"] },
  { code: "ece", name: "Electronics and Communication Engineering", specializations: ["Communication Systems", "VLSI System"] },
  { code: "ice", name: "Instrumentation and Control Engineering", specializations: ["Industrial Automation", "Process Control and Instrumentation"] },
  { code: "mech", name: "Mechanical Engineering", specializations: ["Engineering Design", "Industrial Safety Engineering", "Thermal Power Engineering"] },
  { code: "mme", name: "Metallurgical and Materials Engineering", specializations: ["Industrial Metallurgy", "Materials Science and Engineering", "Welding Engineering"] },
  { code: "prod", name: "Production Engineering", specializations: ["Industrial Engineering and Management", "Manufacturing Technology"] },
  { code: "dee", name: "Energy and Environment", specializations: ["Energy Engineering"] },
  { code: "ca", name: "Computer Applications", specializations: ["Computer Applications", "Computer Science", "Data Analytics"] },
  { code: "physics", name: "Physics", specializations: ["Non-Destructive Testing", "Physics"] },
  { code: "architecture", name: "Architecture and Planning", specializations: ["Energy Efficient and Sustainable Architecture", "Urban Planning"] },
  { code: "chemistry", name: "Chemistry", specializations: ["Chemistry"] },
  { code: "maths", name: "Mathematics", specializations: ["Mathematics"] },
  { code: "humanities", name: "Humanities and Social Sciences", specializations: ["English (Language and Literature)"] },
  { code: "management", name: "Management Studies", specializations: ["Management Studies"] },
] as const;

export type PgBranch = (typeof PG_BRANCHES)[number];
