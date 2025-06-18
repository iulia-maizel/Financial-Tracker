declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<highRatedTransactions>
{
  for $t in doc("transactions.xml")/transactions/transaction
  where $t/rating = "5"
  return $t
}
</highRatedTransactions>