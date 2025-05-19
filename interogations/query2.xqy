for $c in distinct-values(doc("transactions.xml")/transactions/transaction[type = "Expenses"]/category)
let $total := sum(doc("transactions.xml")/transactions/transaction[type = "Expenses" and category = $c]/amount)
order by $total descending
return <category name="{$c}" total="{$total}"/>