const express = require("express");
const { syllable } = require("syllable");
const { Hashery } = require("hashery");
const path = require('path');
const db = require("better-sqlite3")("haiku575.db");
db.pragma("journal_mode = WAL");
const app = express();

// generate setup start - bucket the word bank by syllable count once at startup,
// so /generate can pick words that fit a line's remaining syllable budget quickly
const wordBank = require('./wordbank.json');

const syllableBuckets = (function () {
    const buckets = {};
    wordBank.forEach(function (word) {
        const count = syllable(word);
        if (count < 1) return; // skip anything the estimator couldn't parse
        if (!buckets[count]) buckets[count] = [];
        buckets[count].push(word);
    });
    return buckets;
})();

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// assembles one line by repeatedly picking a random word whose syllable count
// fits what's left, until the target is hit exactly. Retries the whole line a
// few times in case it paints itself into a corner (e.g. 1 syllable left, no
// word available to close the gap).
function buildLine(targetSyllables, maxAttempts) {
    maxAttempts = maxAttempts || 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const words = [];
        let remaining = targetSyllables;
        let stuck = false;

        while (remaining > 0) {
            const availableCounts = Object.keys(syllableBuckets)
                .map(Number)
                .filter(function (count) { return count <= remaining && syllableBuckets[count].length; });

            if (!availableCounts.length) {
                stuck = true;
                break;
            }

            const chosenCount = pickRandom(availableCounts);
            words.push(pickRandom(syllableBuckets[chosenCount]));
            remaining -= chosenCount;
        }

        if (!stuck && remaining === 0) {
            return words.join(' ');
        }
    }

    return null;
}

function generateHaiku() {
    const lineOne = buildLine(5);
    const lineTwo = buildLine(7);
    const lineThree = buildLine(5);

    if (!lineOne || !lineTwo || !lineThree) return null;

    return { lineOne, lineTwo, lineThree };
}
// generate setup end

// db setup start
const createTables = db.transaction(() =>{
    db.prepare(`
        CREATE TABLE IF NOT EXISTS poems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lineOne STRING NOT NULL,
        lineTwo STRING NOT NULL,
        lineThree STRING NOT NULL,
        authorTag STRING,
        authorName STRING,
        haikuId STRING NOT NULL)`).run()

    // migrate an existing table created under the old schema (author -> authorTag, add authorName)
    const columns = db.prepare("PRAGMA table_info(poems)").all().map(c => c.name);
    if (columns.includes('author') && !columns.includes('authorTag')) {
        db.prepare("ALTER TABLE poems RENAME COLUMN author TO authorTag").run();
    }
    if (!columns.includes('authorName')) {
        db.prepare("ALTER TABLE poems ADD COLUMN authorName STRING").run();
    }
});

createTables();
// db setup end

app.set("view engine", "ejs");
app.set('trust proxy', true);
app.use(express.urlencoded({extended:false}));
//app.use(express.static("public"));
app.use(express.static(path.join(__dirname, 'public')));



// example of middleware, research this more
app.use(function (req, res, next){
    // create a global errors array and use locals to make it available to homepage
    // without this homepage will error as it is trying to access an error response that does not exist
    res.locals.errors = [];
    next();
})

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "img-src 'self'",
      "script-src 'self' 'unsafe-inline' https://esm.sh",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
    ].join("; ")
  );
  next();
});

app.get("/", (req, res) => {
    res.render("homepage");
})

app.post("/submit", (req, res) => {
    const errors = [];

    // get the user ip and convert it to hash for unique author tag
    const ip = req.ip;
    const hashery = new Hashery();
    const authorTag = hashery.toHashSync(ip);

    // empty entry if it is not a string
    if (typeof req.body.lineOne !== "string") req.body.lineOne = "";
    if (typeof req.body.lineTwo !== "string") req.body.lineTwo = "";
    if (typeof req.body.lineThree !== "string") req.body.lineThree = "";
    if (typeof req.body.authorName !== "string") req.body.authorName = "";

    // trim whitespace
    req.body.lineOne = req.body.lineOne.trim();
    req.body.lineTwo = req.body.lineTwo.trim();
    req.body.lineThree = req.body.lineThree.trim();
    req.body.authorName = req.body.authorName.trim();
    
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
    if (req.body.authorName && !req.body.authorName.match(/^([a-zA-Z ]*)$/)) errors.push("Author name can only contain letters and spaces.");

    if (errors.length){
        return res.status(400).json({errors});
    }

    // generate unique has id for each poem
    const lineOneHash = hashery.toHashSync(req.body.lineOne);
    const lineTwoHash = hashery.toHashSync(req.body.lineTwo);
    const lineThreeHash = hashery.toHashSync(req.body.lineThree);
    const haikuHash = lineOneHash + lineTwoHash + lineThreeHash;

    // log the user in by giving them a cookie (change this prevent dual submissions??)
    res.cookie("submittedId", haikuHash, {
        httpOnly: true, // client side js cannot access cookies in browser
        secure: true, // browser will only send cookies over https
        sameSite: "strict", // prevents cross site forgery attacks
        maxAge: 1000 * 60 * 60 * 24, // cookie is good for 1 day
    })

    // look up info from our db
    const lookupStatement = db.prepare("SELECT count(*) AS count FROM poems WHERE haikuId=?")
    const row = lookupStatement.get(haikuHash)

    if (row.count < 1){
        // save entry into the db
        const dbStatement = db.prepare("INSERT INTO poems (lineOne, lineTwo, lineThree, authorTag, authorName, haikuId) VALUES(?, ?, ?, ?, ?, ?)");
        dbStatement.run(req.body.lineOne, req.body.lineTwo, req.body.lineThree, authorTag, req.body.authorName, haikuHash);
        return res.json({success: true});
    }

    return res.status(409).json({errors: ["This haiku has already been submitted."]});





})

// tracks the haikuId of the last poem sent to /load, so the next call can avoid repeating it
let lastLoadedHaikuId = null;

app.get("/load", (req, res) => {
    const countRow = db.prepare("SELECT count(*) AS count FROM poems").get();

    if (countRow.count === 0) {
        return res.status(404).json({success: false, errors: ["No haikus have been submitted yet."]});
    }

    if (countRow.count === 1) {
        return res.status(409).json({success: false, errors: ["Only one haiku exists — submit another to enable loading."]});
    }

    // exclude the last loaded haiku so the same one can't come up twice in a row
    const lookupStatement = lastLoadedHaikuId === null
        ? db.prepare("SELECT * FROM poems ORDER BY RANDOM() LIMIT 1").get()
        : db.prepare("SELECT * FROM poems WHERE haikuId != ? ORDER BY RANDOM() LIMIT 1").get(lastLoadedHaikuId);

    lastLoadedHaikuId = lookupStatement.haikuId;

    return res.json({
        success: true,
        haikuId: lookupStatement.haikuId,
        lineOne: lookupStatement.lineOne,
        lineTwo: lookupStatement.lineTwo,
        lineThree: lookupStatement.lineThree,
        authorTag: lookupStatement.authorTag,
        authorName: lookupStatement.authorName
    })
});

app.delete("/delete/:haikuId", (req, res) => {
    const haikuId = req.params.haikuId;

    const lookupStatement = db.prepare("SELECT count(*) AS count FROM poems WHERE haikuId=?")
    const row = lookupStatement.get(haikuId)

    if (row.count < 1){
        return res.status(404).json({success: false, errors: ["That haiku no longer exists."]});
    }

    db.prepare("DELETE FROM poems WHERE haikuId=?").run(haikuId);

    // if the deleted haiku was the one being excluded from repeats, clear that so
    // the next /load isn't comparing against an id that no longer exists
    if (lastLoadedHaikuId === haikuId) {
        lastLoadedHaikuId = null;
    }

    return res.json({success: true});
});

app.get("/generate", (req, res) => {
    const haiku = generateHaiku();

    if (!haiku) {
        return res.status(500).json({success: false, errors: ["Couldn't generate a haiku right now — try again."]});
    }

    return res.json({
        success: true,
        lineOne: haiku.lineOne,
        lineTwo: haiku.lineTwo,
        lineThree: haiku.lineThree
    });
});

app.listen(3000);