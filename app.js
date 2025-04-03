const meriExpress = require("./express")
const app = meriExpress()

// Middleware
app.use((req, res, next) => {
  console.log("Middleware running")
  next()
})

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to MeriExpress!")
})

app.get("/users/:id", (req, res) => {
  res.json({ userId: req.params.id })
})

app.post("/data", (req, res) => {
  console.log(req.body)
  res.status(201).send("Data received")
})

// Static files
app.use(app.static("public"))

app.listen(3000, () => {
  console.log("Server running on port 3000")
})
