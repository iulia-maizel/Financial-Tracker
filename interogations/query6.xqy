declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<monthlyComparison>
{
  let $months := distinct-values(
    for $t in doc("transactions.xml")/transactions/transaction
    let $date := xs:date($t/date)
    return concat(year-from-date($date), '-', format-number(month-from-date($date), '00'))
  )
  for $month in $months
  where starts-with($month, '2025')
  let $income := sum(doc("transactions.xml")/transactions/transaction[type = "Income" and concat(year-from-date(xs:date(date)), '-', format-number(month-from-date(xs:date(date)), '00')) = $month]/amount)
  let $expenses := sum(doc("transactions.xml")/transactions/transaction[type = "Expenses" and concat(year-from-date(xs:date(date)), '-', format-number(month-from-date(xs:date(date)), '00')) = $month]/amount)
  let $net := $income + $expenses
  order by $month
  return
    <month year-month="{$month}">
      <income>{format-number($income, '#.00')}</income>
      <expenses>{format-number($expenses, '#.00')}</expenses>
      <netBalance>{format-number($net, '#.00')}</netBalance>
    </month>
}
</monthlyComparison>