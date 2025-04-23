const pdf = require("html-pdf");

const path = require("node:path");

const { parentPort, workerData } = require("node:worker_threads");

const { session } = workerData;

if (!session || !session.market || !session.stake) {
  throw new Error("Invalid session data");
}

const filename = `./src/docs/pdf/Statement (${session.username.username}).pdf`;

const imgSrc = "";
console.log("IMG", imgSrc);

let table = "";

table += `

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

const options = {
  format: "A3",
  orientation: "portrait",
  border: "0",
  timeout: "120000",
  // Zooming option, can be used to scale images if `options.type` is not pdf
  zoomFactor: "1", // default is 1

  // File options
  type: "pdf", // allowed file types: png, jpeg, pdf
  quality: "100", // only used for types png & jpeg

  paginationOffset: 1, // Override the initial pagination number
  header: {
    height: "0",
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

pdf.create(table, options).toFile(filename, (err, result) => {
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
      message: "PDF Generated!",
    });
    console.log("PDF", result);
  }
});
