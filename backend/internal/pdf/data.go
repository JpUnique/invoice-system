package pdf

import "html/template"

type CompanyInfo struct {
	Name         string
	AddressLine1 string
	AddressLine2 string
	Phone        string
	Email        string
	Website      string
	TIN          string
	RCNumber     string
	LogoDataURI  template.URL
}

type BankDetails struct {
	BankName                   string
	AccountName                string
	AccountNumber              string
	SwiftCode                  string
	CorrespondentBank          string
	CorrespondentAccountNumber string
	Purpose                    string
}

type ClientView struct {
	Name           string
	Code           string
	BillingAddress string
	AttentionName  string
	ContactEmail   string
	LogoDataURI    template.URL
}

type LineItemView struct {
	ItemCode    string
	Description string
	Quantity    float64
	Rate        float64
	Amount      float64
}

type SectionView struct {
	Title string
	Items []LineItemView
}

type PreparedByView struct {
	Name string
	Role string
}

type InvoiceView struct {
	InvoiceNo     string
	Type          string
	Status        string
	Currency      string
	InvoiceDate   string
	DueDate       string
	ContractNo    string
	PoNumber      string
	VendorCode    string
	InvoicePeriod string
	Subtotal      float64
	VATRate       float64
	VATAmount     float64
	GrandTotal    float64
	AmountInWords string
	Notes         string
	Sections      []SectionView
	Client        ClientView
	Company       CompanyInfo
	Bank          BankDetails
	PreparedBy    PreparedByView
}

type TransmittalItemView struct {
	SN           int
	Description  string
	FormatMedium string
	Quantity     float64
	Remarks      string
}

type TransmittalView struct {
	TransmittalNo    string
	TransmittalDate  string
	RelatedInvoiceNo string
	Purpose          string
	ModeOfDispatch   string
	DispatchedByName string
	ReceivedByName   string
	Remarks          string
	Items            []TransmittalItemView
	Client           ClientView
	Company          CompanyInfo
}
