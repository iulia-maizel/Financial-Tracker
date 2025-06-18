declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<monthlyExpenses>
{
  for $t in doc("transactions.xml")/transactions/transaction
  where $t/type = "Expenses"
  let $date := xs:date($t/date)
  let $year-month := concat(year-from-date($date), '-', format-number(month-from-date($date), '00'))
  group by $year-month
  let $total := sum($t/amount)
  let $count := count($t)
  let $average := $total div $count
  order by $year-month descending
  return
    <month year-month="{$year-month}">
      <totalAmount>{format-number($total, '#.00')}</totalAmount>
      <transactionCount>{$count}</transactionCount>
      <averageAmount>{format-number($average, '#.00')}</averageAmount>
    </month>
}
</monthlyExpenses>