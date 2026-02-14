const express = require("express");
const app = express();

app.set("view engine", "ejs")
app.use(express.urlencoded({extended:false}))
app.use(express.static("public"))

app.get("/", (req, res) => {
    res.render("homepage")
})

app.post("/submit", (req, res) => {
    console.log(req.body)
    res.send("submit received")
})

app.listen(3000);