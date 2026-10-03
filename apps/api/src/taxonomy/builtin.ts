// Small public-domain lists the app carries itself (P6-04): the SOC 2018 major groups (the browse tree for O*NET
// occupations) and the NAICS 2022 sectors (industries).

export const SOC_VERSION = "soc-2018";
export const SOC_MAJOR_GROUPS: [string, string][] = [
  ["11", "Management"], ["13", "Business and Financial Operations"], ["15", "Computer and Mathematical"],
  ["17", "Architecture and Engineering"], ["19", "Life, Physical, and Social Science"], ["21", "Community and Social Service"],
  ["23", "Legal"], ["25", "Educational Instruction and Library"], ["27", "Arts, Design, Entertainment, Sports, and Media"],
  ["29", "Healthcare Practitioners and Technical"], ["31", "Healthcare Support"], ["33", "Protective Service"],
  ["35", "Food Preparation and Serving Related"], ["37", "Building and Grounds Cleaning and Maintenance"],
  ["39", "Personal Care and Service"], ["41", "Sales and Related"], ["43", "Office and Administrative Support"],
  ["45", "Farming, Fishing, and Forestry"], ["47", "Construction and Extraction"], ["49", "Installation, Maintenance, and Repair"],
  ["51", "Production"], ["53", "Transportation and Material Moving"], ["55", "Military Specific"],
];
export const socGroupCode = (major: string) => `soc:${major}-0000`;

export const NAICS_VERSION = "naics-2022";
export const NAICS_SECTORS: [string, string][] = [
  ["11", "Agriculture, Forestry, Fishing and Hunting"], ["21", "Mining, Quarrying, and Oil and Gas Extraction"], ["22", "Utilities"],
  ["23", "Construction"], ["31-33", "Manufacturing"], ["42", "Wholesale Trade"], ["44-45", "Retail Trade"],
  ["48-49", "Transportation and Warehousing"], ["51", "Information"], ["52", "Finance and Insurance"],
  ["53", "Real Estate and Rental and Leasing"], ["54", "Professional, Scientific, and Technical Services"],
  ["55", "Management of Companies and Enterprises"], ["56", "Administrative and Support and Waste Management and Remediation Services"],
  ["61", "Educational Services"], ["62", "Health Care and Social Assistance"], ["71", "Arts, Entertainment, and Recreation"],
  ["72", "Accommodation and Food Services"], ["81", "Other Services (except Public Administration)"], ["92", "Public Administration"],
];
