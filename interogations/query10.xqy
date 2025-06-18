declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<categoryPatterns>
{
  for $category in distinct-values(doc("transactions.xml")/transactions/transaction[type = "Expenses" and year-from-date(xs:date(date)) = 2025]/category)
  let $transactions := doc("transactions.xml")/transactions/transaction[type = "Expenses" and category = $category and year-from-date(xs:date(date)) = 2025]
  let $maxAmount := min($transactions/amount)  (: Most negative for expenses :)
  let $minAmount := max($transactions/amount)  (: Least negative :)
  let $maxTrans := $transactions[amount = $maxAmount][1]
  let $minTrans := $transactions[amount = $minAmount][1]
  return
    <category name="{$category}">
      <highestSpending>
        <id>{$maxTrans/@id}</id>
        <date>{$maxTrans/date}</date>
        <description>{$maxTrans/description}</description>
        <amount>{format-number($maxTrans/amount, '#.00')}</amount>
      </highestSpending>
      <lowestSpending>
        <id>{$minTrans/@id}</id>
        <date>{$minTrans/date}</date>
        <description>{$minTrans/description}</description>
        <amount>{format-number($minTrans/amount, '#.00')}</amount>
      </lowestSpending>
    </category>
}
</categoryPatterns>