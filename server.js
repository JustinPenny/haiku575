const express = require("express");
const { syllable } = require("syllable");
const { Hashery } = require("hashery");
const db = require("better-sqlite3")("haiku575.db");
db.pragma("journal_mode = WAL");
const app = express();

// db setup start
const createTables = db.transaction(() =>{
    db.prepare(`
        CREATE TABLE IF NOT EXISTS poems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lineOne STRING NOT NULL,
        lineTwo STRING NOT NULL,
        lineThree STRING NOT NULL,
        author STRING,
        haikuId STRING NOT NULL)`).run()
});

createTables();
// db setup end

app.set("view engine", "ejs");
app.set('trust proxy', true);
app.use(express.urlencoded({extended:false}));
app.use(express.static("public"));

// example of middleware, research this more
app.use(function (req, res, next){
    // create a global errors array and use locals to make it available to homepage
    // without this homepage will error as it is trying to access an error response that does not exist
    res.locals.errors = [];
    next();
})

app.get("/", (req, res) => {
    res.render("homepage");
})

app.post("/submit", (req, res) => {
    const errors = [];

    // get the user ip and convert it to hash for unique author id
    const ip = req.ip;
    const hashery = new Hashery();
    const authorHash = hashery.toHashSync(ip);

    // empty entry if it is not a string
    if (typeof req.body.lineOne !== "string") req.body.lineOne = "";
    if (typeof req.body.lineTwo !== "string") req.body.lineTwo = "";
    if (typeof req.body.lineThree !== "string") req.body.lineThree = "";

    // trim whitespace
    req.body.lineOne = req.body.lineOne.trim();
    req.body.lineTwo = req.body.lineTwo.trim();
    req.body.lineThree = req.body.lineThree.trim();
    
    // verify syllable count
    if (!req.body.lineOne) errors.push("Line One is empty.");
    if (req.body.lineOne && syllable(req.body.lineOne) != 5) errors.push("Line One must have a syllable count of 5.");
    
    if (!req.body.lineTwo) errors.push("Line Two is empty.");
    if (req.body.lineTwo && syllable(req.body.lineTwo) != 7) errors.push("Line Two must have a syllable count of 7.");

    if (!req.body.lineThree) errors.push("Line Three is empty.");
    if (req.body.lineThree && syllable(req.body.lineThree) != 5) errors.push("Line Three must have a syllable count of 5.");

    // check for illegal characters
    if (req.body.lineOne && !req.body.lineOne.match(/^([a-zA-Z ']*)$/)) errors.push("Entries can only contain letters and apostrophes. [Line One]");
    if (req.body.lineTwo && !req.body.lineTwo.match(/^([a-zA-Z ']*)$/)) errors.push("Entries can only contain letters and apostrophes. [Line Two]");
    if (req.body.lineThree && !req.body.lineThree.match(/^([a-zA-Z ']*)$/)) errors.push("Entries can only contain letters and apostrophes. [Line Three]");

    if (errors.length){
        return res.render("homepage", {errors});
    } 

    // generate unique has id for each poem
    const lineOneHash = hashery.toHashSync(req.body.lineOne);
    const lineTwoHash = hashery.toHashSync(req.body.lineTwo);
    const lineThreeHash = hashery.toHashSync(req.body.lineThree);
    const haikuHash = lineOneHash + lineTwoHash + lineThreeHash;

    // log the user in by giving them a cookie (change this to prevent dual submissions??)
    res.cookie("submittedId", haikuHash, {
        httpOnly: true, // client side js cannot access cookies in browser
        secure: true, // browser will only send cookies over https
        sameSite: "strict", // prevents cross site forgery attacks
        maxAge: 1000 * 60 * 60 * 24, // cookie is good for 1 day
    })

    // save entry into the db
    const dbStatement = db.prepare("INSERT INTO poems (lineOne, lineTwo, lineThree, author, haikuId) VALUES(?, ?, ?, ?, ?)");
    dbStatement.run(req.body.lineOne, req.body.lineTwo, req.body.lineThree, authorHash, haikuHash);
    res.send("SUBMITTED")



})

app.listen(3000);