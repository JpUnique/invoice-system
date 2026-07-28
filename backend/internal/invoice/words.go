package invoice

import (
	"fmt"
	"math"
	"strings"
)

var ones = []string{
	"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
	"Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
	"Seventeen", "Eighteen", "Nineteen",
}

var tens = []string{
	"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
}

var scales = []string{"", "Thousand", "Million", "Billion"}

var currencyNames = map[string]struct{ Singular, Plural, Cents string }{
	"USD": {"Dollar", "Dollars", "Cents"},
	"NGN": {"Naira", "Naira", "Kobo"},
	"EUR": {"Euro", "Euros", "Cents"},
	"GBP": {"Pound", "Pounds", "Pence"},
}

// AmountInWords renders a monetary amount as words, e.g.
// "Eighty-Nine Thousand Six Hundred Eighty Dollars and Eighty Cents Only."
func AmountInWords(amount float64, currency string) string {
	totalCents := int64(math.Round(amount * 100))
	if totalCents < 0 {
		totalCents = -totalCents
	}
	whole := totalCents / 100
	cents := totalCents % 100

	names, ok := currencyNames[strings.ToUpper(currency)]
	if !ok {
		names = struct{ Singular, Plural, Cents string }{currency, currency, "Cents"}
	}

	unit := names.Plural
	if whole == 1 {
		unit = names.Singular
	}

	wholeWords := "Zero"
	if whole > 0 {
		wholeWords = integerToWords(whole)
	}

	result := fmt.Sprintf("%s %s", wholeWords, unit)
	if cents > 0 {
		result += fmt.Sprintf(" and %s %s", integerToWords(cents), names.Cents)
	}
	return result + " Only."
}

func integerToWords(n int64) string {
	if n == 0 {
		return "Zero"
	}

	var groups []int64
	for n > 0 {
		groups = append(groups, n%1000)
		n /= 1000
	}

	var parts []string
	for i := len(groups) - 1; i >= 0; i-- {
		if groups[i] == 0 {
			continue
		}
		chunk := threeDigitsToWords(groups[i])
		if scales[i] != "" {
			chunk += " " + scales[i]
		}
		parts = append(parts, chunk)
	}
	return strings.Join(parts, " ")
}

func threeDigitsToWords(n int64) string {
	var parts []string
	if n >= 100 {
		parts = append(parts, ones[n/100]+" Hundred")
		n %= 100
	}
	if n >= 20 {
		tensWord := tens[n/10]
		if n%10 != 0 {
			tensWord += "-" + ones[n%10]
		}
		parts = append(parts, tensWord)
	} else if n > 0 {
		parts = append(parts, ones[n])
	}
	return strings.Join(parts, " ")
}
