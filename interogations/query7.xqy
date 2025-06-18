declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<aboveAverageTransactions>
{
  for $t in doc("transactions.xml")/transactions/transaction
  where $t/type = "Expenses" and year-from-date(xs:date($t/date)) = 2025
  let $category := $t/category
  let $avgAmount := avg(doc("transactions.xml")/transactions/transaction[type = "Expenses" and category = $category and year-from-date(xs:date(date)) = 2025]/amount)
  where $t/amount < $avgAmount  (: Negative amounts, so less than average :)
  return
    <transaction>
      <id>{$t/@id}</id>
      <category>{$category}</category>
      <amount>{format-number($t/amount, '#.00')}</amount>
      <averageCategoryAmount>{format-number($avgAmount, '#.00')}</averageCategoryAmount>
    </transaction>
}
</aboveAverageTransactions>