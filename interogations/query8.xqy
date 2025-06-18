declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<ratingDistribution>
{
  for $type in distinct-values(doc("transactions.xml")/transactions/transaction/type)
  return
    <type name="{$type}">
    {
      for $rating in (1 to 5)
      let $count := count(doc("transactions.xml")/transactions/transaction[type = $type and rating = string($rating)])
      return
        <rating value="{$rating}">
          <count>{$count}</count>
        </rating>
    }
    </type>
}
</ratingDistribution>