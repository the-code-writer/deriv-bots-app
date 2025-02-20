const pdf = require("html-pdf");

const { parentPort, workerData } = require("worker_threads");

const { session } = workerData;

if (!session || !session.market || !session.stake) {
  throw new Error("Invalid session data");
}

const filename = `./src/docs/pdf/Statement (${session.username.username}).pdf`;

let table = "";

table += `
<!DOCTYPE html>
<html>
    <head>
        <title>Reporting demo</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="css/styles.css" />
        <link rel="stylesheet" href="css/statement.css" />
        <link rel="stylesheet" href="css/addendum.css" />
 
        <style type="text/css">

.statement,
.addendum {
    break-after: page;
}

.statement {
    page: statement;
}

.statement-cgls {
    page: statement-cgls;
}


.addendum {
    page: addendum;
}

/* general page size and margins */

@page {
    size: 8.5in 11in;
    margin-bottom: 20.26pt;
    margin-top: 105.38pt;
}

/* First statement page has a custom margin-top */
@page :first {
    margin-top: 20.26pt;
}

/* same for CGLS page */
@page statement-cgls {
    margin-top: 20.26pt;
}

/* ATT: page 1 is usually a right page. But for the statements
 * page 1 should be left page that's why we swap :right and :left
 * in order to get left/right margins on left/right pages right
 */

@page :right{
    margin-left: 73.22pt;
    margin-right: 36.14pt;
}

@page :left {
    margin-left: 36.14pt;
    margin-right: 73.22pt;
}

body {
    font-size: 8pt;
    font-family: Arial;
}

.head1-left {
    position: absolute;
    top: 0;
    /* left indent for image */
    left: -30pt; 
}

.head1-left img {
    /* Width of top-left 50% table (investor information) */
    max-width: 245.40pt;
    height: auto;
}

/* text in box should vertically aligned bottom with a height of 51.63pt.
 * Using 'top' here should have the same effect.
 */
.head1-right {
    position: absolute;
    text-align: right;
    top: 14pt;
    right: 0;
    vertical-align: bottom;
}

.head-title {
    font-family: "Lucida Grande";
    font-size: 16pt;
    font-weight: bold;
    font-style: italic;
    margin-bottom: 0.5em;
}

.head-date {
    font-family: "Lucida Grande";
    font-size: 10pt;
}

.head2-left {
    position: absolute;
    top: 4cm;
    left: 0;
    width: 40%;
    font-family: Arial;
    font-size: 9pt;
}

.head2-right {
    position: absolute;
    text-align: right;
    top: 93.40pt;
    right: 0;
    font-family: "Lucida Grande"
}
/* vertical spacer on first page where the tables start.
 * Address, advisor etc. have an absolute positioning.
 */
.spacer {
    height: 264.25pt;
}

/* Vertical spacer on CGLS page */
.spacer2 {
    height: 30mm;
}

/* turn .footer into a running element */
.footer {
    position: running(footer);
    font-size: 9pt;
    font-family: Arial;
}

.advisor {
    border-right: 1pt solid grey;
    text-transform: uppercase;
    margin-right: -5px;
    padding-right: 3px;
    font-size: 9pt;
    line-height: 1.4em;
}

.advisor-title {
    font-weight: bold;
    font-style: italic;
    font-size: 11pt;
    margin-bottom: 0.25em;
}

.sequence-number {
    font-family: Arial;
    color: grey;
    font-size: 6pt; 
    text-align: right;
}

table.accounting {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 25.81pt;
    font-family: Arial;
    font-size: 8pt;
    margin-bottom: 25.81pt;
    break-inside: avoid;
}

table.layout-fixed {
    table-layout: fixed;
}

table.accounting tr {
    padding: 0;
    margin: 0;
}

table.accounting th,
table.accounting td {
    max-width: 20%;
}

table.accounting caption {
    text-align: left;
    border-top: 0.6pt solid red;
    margin-bottom: 1em;
}

table.accounting caption span {
    font-family: goudyoldstylet;
    background: red;
    font-weight: bold;
    font-size: 10pt;
    color: white;
    display: inline-block;
    padding-right: 0.25em;
    padding-left: 0.25em;
    padding-top: 0.25em;
    padding-bottom: 0.25em;
}

table.accounting .headers th {
    font-family: "Lucida Grande";
    font-weight: bold;
    font-style: italic;
}

table.accounting td {
    padding-top: 1px;
    padding-bottom: 2px;
}

table.accounting tfoot td {
    padding-top: 1em;
}

/* Investor/Account information 50|50 tables implemented
 * as left/right float within their #two-tables container
 */

.two-tables .table-left {
    float: left;
    width: 245.40pt;
}

.two-tables .table-right {
    float: right;
    width: 245.40pt;
}

/* general table cell decoration with borders */

.border-top td {
    border-top: 1px solid black;
}

.border-bottom td {
    border-bottom: 1px solid black;
}

/* text alignment within a cell */

table.accounting .text-left {
    text-align: left
}

table.accounting .text-right {
    text-align: right;
}

table.accounting .text-center {
    text-align: center;
}

table.accounting .extra-top-padding {
    padding-top: 1em;
}


table.accounting .extra-bottom-padding {
    padding-bottom: 1em;
}

table.width-50 {
    width: 245.40pt;
}

/* defines font classes by pt size for general usage */

.text-7 {
    font-size: 7pt;
}

.text-8 {
    font-size: 8pt;
}

.text-9 {
    font-size: 10pt;
}


.text-10 {
    font-size: 10pt;
}

/* text/font decorations */

.bold {
    font-weight: bold;
}

.italic {
    font-style: italic;
}

/* needed for Weasyprint (#1062)*/
table::before {
    content: target-counter(url(#end), page);
    display: none;
}

.chart {
    border-bottom: 1px solid black;
    margin-bottom: 2em;
}

.chart img {
    max-width: 100%
}

.footnote-marker {
    display: inline-block;
    width: 0.5em;
}

.cgls-head {
    margin-bottom: 4em;
}

@page statement {

    margin-bottom: 30mm;

    @bottom-left {
        content: element(footer);
        vertical-align: bottom;
        display: table-cell;
        border-bottom: 1pt solid grey;
        font-family: Arial;
        margin-bottom: 1cm;
        height: 1.5cm;
    }
    @bottom-right {
        font-family: Arial;
        font-size: 8pt;
        border-bottom: 1pt solid grey;
        vertical-align: bottom;
        width: 3cm;
        height: 1.5cm;
        display: table-cell;
        content: "Page " counter(page) " of " counter(pages);
        margin-bottom: 1cm;
    }
}

@page statement-cgls {

    margin-bottom: 30mm;

    @bottom-left {
        content: element(footer);
        vertical-align: bottom;
        display: table-cell;
        border-bottom: 1pt solid grey;
        font-family: Arial;
        margin-bottom: 1cm;
        height: 1.5cm;
    }
}

@page {
  size: 8.5in 11in;
  margin: 0.5in;
  margin-top: 1in;
}

body {
  font-size: 9pt;
}

.letter {
  font-family: "Lucida Grande";
}

h1 {
  font-size: 9pt;
  text-align: center;
  font-weight: bold;
  break-after: avoid;
}

h2 {
  font-size: 8pt;
  font-weight: bold;
  break-after: avoid;
}

p {
  text-align: justify;
  hyphens: auto;
}

.footer-link {
  color: #be945b;
}

div.letter {
  line-height: 1.6em;
}

.letter-logo {
  position: running(letter-logo);
  text-align: center;
}

.letter-logo img {
  width: 30mm;
  height: auto;
}

.letter-footer {
  position: running(letter-footer);
  font-size: 8pt;
  font-family: "Lucida Grande";
  text-align: center;
}

.letter-signature {
  width: 3cm;
  display: block;
}

.letter p {
  break-inside: avoid;
}

.letter-closing {
  break-inside: avoid;
}

@page addendum {
  @bottom-center {
    content: element(letter-footer);
  }

  @top-center {
    content: element(letter-logo);
  }
}

.addendum-images img {
    width: 100%;
}


            @page statement {
                @bottom-right {
                    content: "Page " counter(page) " of " target-counter(url("#end"), page);
                }
            }
        </style>
    </head>
 
    <body lang="en">
         
            <article>
    <section class="statement">
        <div>
    <div class="footer">
        <div>ZOPYX Global Enterprise<br/>Phone: (+49) 7071 793376, Fax: (+49) 7071 793376,  Website: www.zopyx.com<br />Email: info@zopyx.com</div>
    </div>
 
    <div class="head1-left">
        <!--
            <img src="logo.png" />
        -->
        <img src="assets/LogoSizingSample.png" />
    </div>
 
    <div class="head1-right">
        <div class="head-title">Statement of Account</div>
        <div class="head-date">January 01, 2019 to March 31, 2019</div>
    </div>
 
    <div class="head2-left">
        <div class="sequence-number">000024</div>
        <div>HHKO MFIU</div>
        <div>2888 XMYVFEJ FI</div>
        <div>AXYDTPL QP  G4I 2U8</div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
    </div>
 
    <div class="head2-right">
        <div class="advisor-title" xpath=".//YFAS_TITLE">Your Financial Advisor</div>
        <div class="advisor-outer">
            <div class="advisor">
                <div>JOHN SMITH</div>
                <div>BIG BUSINESS INC</div>
                <div>123 ARLINGTON ST</div>
                <div>NANAIMO BC B1A 2CB</div>
                <div></div>
                <div></div>
                <div>Telephone Number</div>
                <div>(299)  555-1234</div>
            </div>
        </div>
    </div>
 
    <div class="spacer">&nbsp;</div>
 
    <div class="two-tables">
        <table class="accounting table-left">
    <caption>
        <span>Investor Information</span>
    </caption>
    <thead>
        <tr class="headers">
            <th class="text-left">Account Type</th>
            <th class="text-left">Account Number</th>
        </tr>
    </thead>
    <tbody>
        <tr class="headers border-bottom" >
            <td class="text-left text-10 bold">Self-Directed Tax Free Savings Acct</td>
            <td class="text-left text-10 bold">19570</td>
        </tr>
    </tbody>
    <tfoot>
        
            <tr class="border-bottom">
                <td colspan="2">
                    <div class="text-left bold">Administrator Account Number</div>
                    <div class="text-left">N1F4011Q</div>
                    These investments are registered in the name of FIDELITY CLEARING CANADA ULC on your behalf.
                </td>
            </tr>
        
        
        
    </tfoot>
</table>
        <table class="accounting table-right">
    <caption>
        <span>Account Value</span>
    </caption>
    <tbody>
        <tr class="border-bottom">
            <td class="text-left text-10">
              Closing Market Value This<br />Period
            </td>
            <td class="text-right text-10">
              $7,047.73
            </td>
        </tr>
        <tr class="border-bottom">
            <td class="text-left">
              Opening Balance
            </td>
            <td class="text-right">
              $6,070.12
            </td>
        </tr>
        <tr class="border-bottom">
            <td class="text-left">
              Book Cost
            </td>
            <td class="text-right">
              $6,390.75
            </td>
        </tr>
    </tbody>
</table>
        <div style="clear: both"></div>
    </div>
 
    <table class="accounting account-summary">
    <caption>
        <span>Account Summary</span>
    </caption>
    <thead>
        <tr class="headers border-bottom">
            <th class="text-left">Fund Name</th>
            <th class="text-center">DSC</th>
            <th class="text-right">Book<br />Cost ($)</th>
            <th class="text-right">Average<br />Cost ($)</th>
            <th class="text-right">Unit<br />Balance</th>
            <th class="text-right">Unit<br />Price ($)</th>
            <th class="text-right">Market<br />Value ($)</th>
        </tr>
    </thead>
    <tbody>
        <tr class="border-bottom">
            <td colspan="7" class="text-7 text-left">Canadian $ Investments</td>
        </tr>
        
        <tr class="border-bottom">
            <td class="text-left">ACEME Small Cap Fund Series F ACM401</td>
            <td class="text-center">N</td>
            <td class="text-right">6,390.75</td>
            <td class="text-right">15.9821</td>
            <td class="text-right">399.869</td>
            <td class="text-right">17.6251</td>
            <td class="text-right">7,047.73</td>
        </tr>
        <tr class="border-bottom">
            <td class="text-left" colspan="2"></td>
            <td class="text-right" colspan="1"></td>
            <td class="text-right" colspan="4"></td>
        </tr>
    </tbody>
    <tfoot>
        <tr>
            <td class="text-7" colspan="7">"<b>Book cost</b>" means the total amount paid to purchase an investment, including any transaction charges related to the purchase, adjusted for reinvested distributions, return of capital and corporate reorganizations.<br />The book (original) cost shown in this statement may not be suitable for income tax purposes, as it may not reflect all required adjustments. It is important for you to keep records of all of your investment transactions and consult your income tax advisor to properly determine your gains and losses for income tax purposes.<br /><br />"<b>Market value</b>" is the price at which an investment can be sold on the open market at a specific point in time. The market value of an investment fund is its<br />"<b>Net Asset Value</b>". This is usually calculated by investment managers once per day/week/month.</td>
        </tr>
    </tfoot>
</table>
 
    
 
    
 
    <table class="accounting transaction-summary">
    <caption>
        <span>Transaction Summary</span>
    </caption>
    <thead>
        <tr class="headers">
            <th class="text-left">Fund Name</th>
            <th class="text-right">Purchases &<br />Transfers-In ($)</th>
            <th class="text-right">Redemptions &<br />Transfers-Out ($)</th>
            <th class="text-right">Income<br />Distribution ($)</th>
            <th class="text-right">Capital Gain<br />Distribution ($)</th>
        </tr>
    </thead>
    <tbody>
        
            <tr class="border-bottom">
                <td class="text-7 text-left">ACEME Small Cap Fund Series F ACM401</td>
                <td class="text-7 text-right">0.00</td>
                <td class="text-7 text-right">0.00</td>
                <td class="text-7 text-right">0.00</td>
                <td class="text-7 text-right">217.65</td>
            </tr>
        
    </tbody>
    <tfoot>
        <tr class="border-bottom">
            <td class="text-7" colspan="5">Any switch activity within your account is reported in the transaction details section of your statement.</td>
        </tr>
    </tfoot>
</table>
    <table class="accounting transaction-details layout-fixed">
    <caption>
        <span>Transaction Details</span>
    </caption>
    <thead>
        <tr class="headers">
            <th class="text-left">Trade Date</th>
            <th class="text-left" style="width: 25%">Transaction Type</th>
            <th class="text-right">Gross<br />Amount ($)</th>
            <th class="text-right">Deductions<br />Amount ($)</th>
            <th class="text-right">Net<br />Amount ($)</th>
            <th class="text-right">Unit<br />Price ($)</th>
            <th class="text-right">Transaction<br />Units</th>
            <th class="text-right">Unit<br />Balance</th>
        </tr>
    </thead>
    <tbody>
 
        
            <tr>
                <td colspan="8" class="text-10 bold extra-top-padding extra-bottom-padding">ACME Small Cap Fund Series F ACM401</td>
            </tr>
            
 
                
                    <tr class="border-bottom">
                        <td colspan="7" class="text-left" >
                            <span class="footnote-marker"> </span>
                            Opening Balance
                        </td>
                        <td class="text-right">387.491</td>
                    </tr>
                
            
 
                
                    <tr class="border-bottom">
                        <td class="text-left" >
                            <span class="footnote-marker"> </span>
                            02/27/2019
                        </td>
                        <td class="text-left">Capital Gain Distribution</td>
                        <td class="text-right">217.65</td>
                        <td class="text-right">0.00</td>
                        <td class="text-right">217.65</td>
                        <td class="text-right">17.5834</td>
                        <td class="text-right">12.378</td>
                        <td class="text-right">399.869</td>
                    </tr>
 
                
            
 
                
                    <tr class="border-top border-bottom">
                        <td colspan="7" class="text-left" >
                            <span class="footnote-marker"> </span>
                            Closing Balance
                        </td>
                        <td class="text-right">399.869</td>
                    </tr>
                
            
        
    </tbody>
    <tfoot>
        <tr class="">
            <td class="text-7" colspan="8"></td>
        </tr>
    </tfoot>
</table>
 
    <div>Please review your statement of account carefully.  If there is any information that does not match your records, contact your Financial Advisor or our Client Services department within 60 days.</div>
    <div></div>
    <div></div>
 
</div>
        <div id="end"></div>
    </section>
 
    
 
 
    <!-- MAT.PDF as two images
    <div class="addendum-images">
        <img src="MAT_INSERT_20190331_V1-0.png"/>
        <img src="MAT_INSERT_20190331_V1-1.png"/>
    </div>
    -->
 
</article> 
        
    </body>
</html>
`;

rows = [
  {
    key_one: "John",
    key_two: "Doe",
    key_three: "555-123-0001",
    key_four: "john.doe@example.com",
  },
  {
    key_one: "Jane",
    key_two: "Smith",
    key_three: "555-123-0002",
    key_four: "jane.smith@example.com",
  },
  {
    key_one: "Michael",
    key_two: "Johnson",
    key_three: "555-123-0003",
    key_four: "michael.johnson@example.com",
  },
  {
    key_one: "Emily",
    key_two: "Davis",
    key_three: "555-123-0004",
    key_four: "emily.davis@example.com",
  },
  {
    key_one: "Chris",
    key_two: "Brown",
    key_three: "555-123-0005",
    key_four: "chris.brown@example.com",
  },
  {
    key_one: "Sarah",
    key_two: "Wilson",
    key_three: "555-123-0006",
    key_four: "sarah.wilson@example.com",
  },
  {
    key_one: "David",
    key_two: "Taylor",
    key_three: "555-123-0007",
    key_four: "david.taylor@example.com",
  },
  {
    key_one: "Laura",
    key_two: "Anderson",
    key_three: "555-123-0008",
    key_four: "laura.anderson@example.com",
  },
  {
    key_one: "James",
    key_two: "Thomas",
    key_three: "555-123-0009",
    key_four: "james.thomas@example.com",
  },
  {
    key_one: "Olivia",
    key_two: "Moore",
    key_three: "555-123-0010",
    key_four: "olivia.moore@example.com",
  },
  {
    key_one: "Daniel",
    key_two: "Martin",
    key_three: "555-123-0011",
    key_four: "daniel.martin@example.com",
  },
  {
    key_one: "Sophia",
    key_two: "Jackson",
    key_three: "555-123-0012",
    key_four: "sophia.jackson@example.com",
  },
  {
    key_one: "Matthew",
    key_two: "White",
    key_three: "555-123-0013",
    key_four: "matthew.white@example.com",
  },
  {
    key_one: "Isabella",
    key_two: "Harris",
    key_three: "555-123-0014",
    key_four: "isabella.harris@example.com",
  },
  {
    key_one: "Andrew",
    key_two: "Clark",
    key_three: "555-123-0015",
    key_four: "andrew.clark@example.com",
  },
  {
    key_one: "Mia",
    key_two: "Lewis",
    key_three: "555-123-0016",
    key_four: "mia.lewis@example.com",
  },
  {
    key_one: "Joshua",
    key_two: "Walker",
    key_three: "555-123-0017",
    key_four: "joshua.walker@example.com",
  },
  {
    key_one: "Charlotte",
    key_two: "Hall",
    key_three: "555-123-0018",
    key_four: "charlotte.hall@example.com",
  },
  {
    key_one: "Ethan",
    key_two: "Allen",
    key_three: "555-123-0019",
    key_four: "ethan.allen@example.com",
  },
  {
    key_one: "Amelia",
    key_two: "Young",
    key_three: "555-123-0020",
    key_four: "amelia.young@example.com",
  },
];

rows = [];

rows.forEach(function (row) {
  table += "<tr>";
  table += "<td>" + row.key_one + "</td>";
  table += "<td>" + row.key_two + "</td>";
  table += "<td>" + row.key_three + "</td>";
  table += "<td>" + row.key_four+ "</td>";
  table += "</tr>";
});
 

var options = {
  format: "A3",
  orientation: "portrait",
  border: "5mm",
  timeout: "120000",
  // Zooming option, can be used to scale images if `options.type` is not pdf
  zoomFactor: "0.25", // default is 1

  // File options
  type: "pdf", // allowed file types: png, jpeg, pdf
  quality: "100", // only used for types png & jpeg

  paginationOffset: 1, // Override the initial pagination number
  header: {
    height: "25mm",
    contents: '<div style="text-align: center;">Author: Marc Bachmann</div>',
  },
  footer: {
    height: "25mm",
    contents: {
      first: "Cover page",
      2: "Second page", // Any page number is working. 1-based index
      default:
        '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>', // fallback value
      last: "Last Page",
    },
  },
};

pdf
  .create(table, options)
  .toFile(filename, function (err, result) {
    if (err) {
      parentPort.postMessage({
        status: "success",
        filename: filename,
        message: `Failed to generate your statement: ${error.message}`,
      });
      console.log("PDF ERROR", result);
    } else {
      parentPort.postMessage({
        status: "success",
        filename: filename,
        message: `PDF Generated!`,
      });
      console.log("PDF", result);
    }
  });
