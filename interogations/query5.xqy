declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<topCategories>
{
  let $transactions := doc("transactions.xml")/transactions/transaction
  let $expenses := $transactions[type = "Expenses" and year-from-date(xs:date(date)) = 2025]
  let $totalExpenses := sum($expenses/amount)
  let $categories :=
    for $category in distinct-values($expenses/category)
    let $total := sum($expenses[category = $category]/amount)
    let $percentage := ($total * 100) div $totalExpenses
    order by $total ascending
    return
      <category name="{$category}">
        <totalAmount>{format-number($total, '#.00')}</totalAmount>
        <percentage>{format-number($percentage, '#.00')}%</percentage>
      </category>
  return subsequence($categories, 1, 3)
}
</topCategories>
