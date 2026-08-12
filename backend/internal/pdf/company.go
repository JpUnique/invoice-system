package pdf

// PetroData's static letterhead + payment details. These match the two
// sample invoices exactly; once Phase 6 adds multi-bank-account support
// this should move into the database instead of being hardcoded.
var Company = CompanyInfo{
	Name:         "PetroData Management Service Limited",
	AddressLine1: "Plot 7, Dortemag Close, Magboro Opp. Mountain Top University",
	AddressLine2: "Lagos-Ibadan Expressway",
	Phone:        "08033083322",
	Email:        "info@petrodata.net",
	Website:      "www.petrodata.net",
	TIN:          "00157207-0001",
	RCNumber:     "255016",
}

var DefaultBank = BankDetails{
	BankName:                   "Access Bank",
	AccountName:                "Petrodata Management Services Ltd",
	AccountNumber:              "0696782512",
	SwiftCode:                  "ABNGNGLA",
	BankAddress:                "11A Adeola Odeku Street, Victoria Island Lagos",
	CorrespondentBank:          "Citibank, New York",
	CorrespondentAccountNumber: "36145842",
	CorrespondentBankAddress:   "New York N.Y 100043",
	CorrespondentSwiftCode:     "CITIUS33",
	CorrespondentRoutingNumber: "21000089",
	CorrespondentAccountName:   "Access Bank PLC",
	Purpose:                    "Services Rendered",
}
