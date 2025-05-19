for $t in doc("transactions.xml")/transactions/transaction
where $t/type = "Expenses"
return $t