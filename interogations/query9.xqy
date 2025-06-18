declare option saxon:output "method=xml";
declare option saxon:output "indent=yes";
declare option saxon:output "omit-xml-declaration=no";

<consecutiveHighRatings>
{
  for tumbling window $w in doc("transactions.xml")/transactions/transaction
      start $s when true()
      only end $e when xs:date($e/date) - xs:date($s/date) gt xs:dayTimeDuration("P1D")
  let $count := count($w)
  let $allHigh := every $t in $w 
                  satisfies normalize-space($t/rating) != '' 
                            and xs:integer($t/rating) ge 4
  where $count = 2 and $allHigh
  return
    <pair>
      <first>
        <id>{$w[1]/@id}</id>
        <date>{$w[1]/date}</date>
        <category>{$w[1]/category}</category>
        <rating>{$w[1]/rating}</rating>
      </first>
      <second>
        <id>{$w[2]/@id}</id>
        <date>{$w[2]/date}</date>
        <category>{$w[2]/category}</category>
        <rating>{$w[2]/rating}</rating>
      </second>
    </pair>
}
</consecutiveHighRatings>

