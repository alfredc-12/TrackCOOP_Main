// PSGC labels: https://psa.gov.ph/classification/psgc/citimuni/0401000000
export const BATANGAS_MUNICIPALITIES: Record<number, string> = {
  401001000: "Agoncillo", 401002000: "Alitagtag", 401003000: "Balayan",
  401004000: "Balete", 401005000: "Batangas City", 401006000: "Bauan",
  401007000: "City of Calaca", 401008000: "Calatagan", 401009000: "Cuenca",
  401010000: "Ibaan", 401011000: "Laurel", 401012000: "Lemery",
  401013000: "Lian", 401014000: "City of Lipa", 401015000: "Lobo",
  401016000: "Mabini", 401017000: "Malvar", 401018000: "Mataasnakahoy",
  401019000: "Nasugbu", 401020000: "Padre Garcia", 401021000: "Rosario",
  401022000: "San Jose", 401023000: "San Juan", 401024000: "San Luis",
  401025000: "San Nicolas", 401026000: "San Pascual", 401027000: "Santa Teresita",
  401028000: "City of Sto. Tomas", 401029000: "Taal", 401030000: "Talisay",
  401031000: "City of Tanauan", 401032000: "Taysan", 401033000: "Tingloy",
  401034000: "Tuy",
};

export function normalizeMunicipality(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bcity of\b|\bcity\b|\bmunicipality of\b/g, " ")
    .replace(/\bsto\.?\b/g, "santo").replace(/[.,-]/g, " ")
    .replace(/\s+/g, " ").trim();
}
